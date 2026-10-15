// Attendance Page Controller
let attendanceChart = null;
let studentId = 1;

document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth();
  if (!user) return;
  initLayout();

  studentId = user.studentId || 1;

  if (user.role === 'admin' || user.role === 'faculty') {
    document.getElementById('sidebar-role-badge').textContent = 'ADMIN CONSOLE';
    const actionStrip = document.getElementById('admin-att-action-strip');
    if (actionStrip) actionStrip.style.display = 'flex';
  }

  await loadAttendanceData(studentId);
  if (user.role === 'admin' || user.role === 'faculty') await populateAttendanceSubjects();

  // Form Submission
  const attForm = document.getElementById('att-form');
  if (attForm) {
    attForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const subjectId = parseInt(document.getElementById('modal-att-subject').value, 10);
      const total = parseInt(document.getElementById('modal-att-total').value, 10);
      const attended = parseInt(document.getElementById('modal-att-attended').value, 10);

      try {
        const res = await apiCall('/attendance', 'POST', {
          student_id: studentId,
          subject_id: subjectId,
          total_classes: total,
          attended_classes: attended
        });

        if (res.success) {
          showToast('Attendance records updated successfully.', 'success');
          closeModal('add-att-modal');
          await loadAttendanceData(studentId);
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }
});

async function populateAttendanceSubjects() {
  const select = document.getElementById('modal-att-subject');
  if (!select) return;
  try {
    const result = await apiCall('/subjects');
    select.innerHTML = '<option value="">Select subject</option>' + (result.data || []).map(s =>
      `<option value="${s.id}">${s.name} (${s.code})</option>`).join('');
  } catch (error) { console.error('[Subject Catalog Error]', error); }
}

let allAttendanceRecords = [];
let overallAttendanceMetrics = {};

async function loadAttendanceData(sId) {
  try {
    const res = await apiCall(`/attendance/${sId}`);
    if (!res.success) throw new Error(res.message);

    overallAttendanceMetrics = res;
    allAttendanceRecords = res.data || [];

    const { overallPercentage, overallStatus, totalClasses, attendedClasses, hasRiskAlert, atRiskSubjects, monthlyTrend, data } = res;

    // Update KPI Cards
    document.getElementById('att-overall-pct').textContent = `${overallPercentage.toFixed(1)}%`;
    const statusPill = document.getElementById('att-overall-status');
    statusPill.textContent = overallStatus;
    statusPill.className = overallStatus === 'GOOD' ? 'kpi-pill pill-green' : overallStatus === 'MONITOR' ? 'kpi-pill pill-yellow' : 'kpi-pill pill-red';

    document.getElementById('att-total-classes').textContent = totalClasses;
    document.getElementById('att-attended-classes').textContent = attendedClasses;

    const riskSubjectsCount = atRiskSubjects.length;
    const riskValEl = document.getElementById('att-subjects-at-risk');
    riskValEl.textContent = riskSubjectsCount;
    if (riskSubjectsCount > 0) {
      riskValEl.style.color = '#ef4444';
      document.getElementById('att-risk-icon').textContent = '⚠️';
    } else {
      riskValEl.style.color = '#34d399';
      document.getElementById('att-risk-icon').textContent = '🛡️';
    }

    // Critical Alert Banner
    const alertBanner = document.getElementById('attendance-critical-alert');
    if (hasRiskAlert) {
      alertBanner.style.display = 'block';
      const names = atRiskSubjects.map(s => `${s.subject_name} (${s.percentage}%)`).join(', ');
      document.getElementById('alert-banner-text').textContent = 
        `Warning: Your attendance in ${names || 'core subjects'} is below the mandatory 75% examination threshold! Immediate regular attendance is required.`;
    } else {
      alertBanner.style.display = 'none';
    }

    // Populate Calculator Subject Dropdown
    populateCalculatorDropdown(allAttendanceRecords);

    // Render Table, Recovery Calculator & Chart
    renderAttendanceTable(data);
    updateRecoveryCalculator();
    renderMonthlyChart(monthlyTrend);

  } catch (err) {
    console.error('[Attendance Load Error]', err);
    showToast('Failed to load attendance metrics', 'error');
  }
}

function populateCalculatorDropdown(records) {
  const select = document.getElementById('calc-subject-select');
  if (!select) return;
  const currentVal = select.value;
  select.innerHTML = '<option value="OVERALL">Overall Aggregate Attendance</option>' +
    (records || []).map(r => `<option value="${r.subject_id}">${r.subject_name || 'Subject'}</option>`).join('');
  if (currentVal) select.value = currentVal;
}

function updateRecoveryCalculator() {
  const select = document.getElementById('calc-subject-select');
  const scope = select ? select.value : 'OVERALL';

  let total = 0;
  let attended = 0;
  let pct = 0;
  let status = 'GOOD';
  let needed75 = 0;
  let needed85 = 0;
  let bunkBuffer = 0;

  if (scope === 'OVERALL') {
    total = overallAttendanceMetrics.totalClasses || 0;
    attended = overallAttendanceMetrics.attendedClasses || 0;
    pct = overallAttendanceMetrics.overallPercentage || 0;
    status = overallAttendanceMetrics.overallStatus || 'GOOD';
    needed75 = overallAttendanceMetrics.overallClassesNeededFor75 || 0;
    needed85 = overallAttendanceMetrics.overallClassesNeededFor85 || 0;
    bunkBuffer = overallAttendanceMetrics.overallBunkBuffer75 || 0;
  } else {
    const rec = allAttendanceRecords.find(r => String(r.subject_id) === String(scope));
    if (rec) {
      total = rec.total_classes;
      attended = rec.attended_classes;
      pct = rec.percentage;
      status = rec.status;
      needed75 = rec.classesNeededFor75 || 0;
      needed85 = rec.classesNeededFor85 || 0;
      bunkBuffer = rec.bunkBuffer75 || 0;
    }
  }

  // Update Calculator Tiles
  const pctEl = document.getElementById('calc-current-pct');
  const statusEl = document.getElementById('calc-current-status');
  if (pctEl) pctEl.textContent = `${pct.toFixed(1)}%`;
  if (statusEl) {
    statusEl.textContent = status;
    statusEl.className = status === 'GOOD' ? 'kpi-pill pill-green' : status === 'MONITOR' ? 'kpi-pill pill-yellow' : 'kpi-pill pill-red';
  }

  const n75El = document.getElementById('calc-needed-75');
  const d75El = document.getElementById('calc-detail-75');
  if (n75El && d75El) {
    if (needed75 > 0) {
      n75El.textContent = `🚨 +${needed75} consecutive`;
      n75El.style.color = '#ef4444';
      d75El.textContent = `Shortage active: must attend next ${needed75} classes`;
    } else {
      n75El.textContent = 'Eligible ✓';
      n75El.style.color = '#34d399';
      d75El.textContent = 'Condonation & detention threshold cleared';
    }
  }

  const n85El = document.getElementById('calc-needed-85');
  const d85El = document.getElementById('calc-detail-85');
  if (n85El && d85El) {
    if (needed85 > 0) {
      n85El.textContent = `+${needed85} lectures`;
      n85El.style.color = '#38bdf8';
      d85El.textContent = `Required to enter Good Standing (85%)`;
    } else {
      n85El.textContent = 'Target Met ✓';
      n85El.style.color = '#34d399';
      d85El.textContent = 'Maximum continuous assessment points secured';
    }
  }

  const bufEl = document.getElementById('calc-bunk-buffer');
  const dBufEl = document.getElementById('calc-detail-buffer');
  if (bufEl && dBufEl) {
    if (pct < 75) {
      bufEl.textContent = '0 lectures';
      bufEl.style.color = '#ef4444';
      dBufEl.textContent = 'Zero permissible absence margin (detention risk)';
    } else {
      bufEl.textContent = `${bunkBuffer} lecture${bunkBuffer === 1 ? '' : 's'}`;
      bufEl.style.color = '#fbbf24';
      dBufEl.textContent = `Can be missed without dropping below 75%`;
    }
  }

  runWhatIfSimulation();
}

function runWhatIfSimulation() {
  const select = document.getElementById('calc-subject-select');
  const scope = select ? select.value : 'OVERALL';

  let currentTotal = 0;
  let currentAttended = 0;

  if (scope === 'OVERALL') {
    currentTotal = overallAttendanceMetrics.totalClasses || 0;
    currentAttended = overallAttendanceMetrics.attendedClasses || 0;
  } else {
    const rec = allAttendanceRecords.find(r => String(r.subject_id) === String(scope));
    if (rec) {
      currentTotal = rec.total_classes;
      currentAttended = rec.attended_classes;
    }
  }

  const upcoming = parseInt(document.getElementById('sim-upcoming')?.value || 10, 10);
  const willAttend = parseInt(document.getElementById('sim-attend')?.value || 9, 10);

  const safeAttend = Math.min(upcoming, Math.max(0, willAttend));
  const newTotal = currentTotal + upcoming;
  const newAttended = currentAttended + safeAttend;

  const projectedPct = newTotal > 0 ? parseFloat(((newAttended / newTotal) * 100).toFixed(1)) : 0;

  const resPctEl = document.getElementById('sim-result-pct');
  const resStatusEl = document.getElementById('sim-result-status');

  if (resPctEl) resPctEl.textContent = `${projectedPct.toFixed(1)}%`;
  if (resStatusEl) {
    if (projectedPct >= 85) {
      resStatusEl.textContent = 'EXCELLENT';
      resStatusEl.className = 'kpi-pill pill-green';
    } else if (projectedPct >= 75) {
      resStatusEl.textContent = 'SAFE (ELIGIBLE)';
      resStatusEl.className = 'kpi-pill pill-green';
    } else {
      resStatusEl.textContent = 'DETENTION RISK';
      resStatusEl.className = 'kpi-pill pill-red';
    }
  }
}

function renderAttendanceTable(records) {
  const tbody = document.getElementById('attendance-table-body');
  if (!records || records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-dim); padding: 24px;">No attendance logged for this student.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(r => {
    const missed = Math.max(0, r.total_classes - r.attended_classes);
    const statusPill = r.status === 'GOOD' ? 'pill-green' : r.status === 'MONITOR' ? 'pill-yellow' : 'pill-red';
    const barColor = r.status === 'GOOD' ? '#10b981' : r.status === 'MONITOR' ? '#f59e0b' : '#ef4444';
    
    const needed75Text = r.classesNeededFor75 > 0
      ? `<span style="color: #ef4444; font-weight: 700;">🚨 +${r.classesNeededFor75} lectures</span>`
      : `<span style="color: #34d399; font-weight: 600;">✓ Safe (Bunk: ${r.bunkBuffer75} classes)</span>`;

    const needed85Text = r.classesNeededFor85 > 0 
      ? `<span style="color: #fbbf24; font-weight: 600;">+${r.classesNeededFor85} lectures</span>`
      : `<span style="color: #34d399; font-weight: 500;">✓ Target Met</span>`;

    return `
      <tr>
        <td><div style="font-weight: 600; color: #fff;">${r.subject_name || 'Subject'}</div></td>
        <td>${r.total_classes}</td>
        <td><strong style="color: #34d399;">${r.attended_classes}</strong></td>
        <td><span style="color: #f87171;">${missed}</span></td>
        <td>
          <div style="font-size: 0.76rem; color: var(--text-dim); margin-bottom: 2px;">${r.percentage}% Compliance</div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${r.percentage}%; background: ${barColor};"></div>
          </div>
        </td>
        <td><strong>${r.percentage}%</strong></td>
        <td><span class="kpi-pill ${statusPill}">${r.status}</span></td>
        <td>${needed75Text}</td>
        <td>${needed85Text}</td>
      </tr>
    `;
  }).join('');
}

function renderMonthlyChart(trend) {
  const ctx = document.getElementById('monthlyAttendanceChart').getContext('2d');
  if (attendanceChart) attendanceChart.destroy();

  const labels = trend.map(t => t.month);
  const data = trend.map(t => t.percentage);

  attendanceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Student Attendance %',
          data: data,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 5
        },
        {
          label: 'Institutional Detention Line (75%)',
          data: labels.map(() => 75),
          borderColor: '#ef4444',
          borderDash: [6, 6],
          fill: false,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 50,
          max: 100,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', callback: v => `${v}%` }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });
}
