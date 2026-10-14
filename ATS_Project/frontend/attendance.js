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

async function loadAttendanceData(sId) {
  try {
    const res = await apiCall(`/attendance/${sId}`);
    if (!res.success) throw new Error(res.message);

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

    // Render Table & Chart
    renderAttendanceTable(data);
    renderMonthlyChart(monthlyTrend);

  } catch (err) {
    console.error('[Attendance Load Error]', err);
    showToast('Failed to load attendance metrics', 'error');
  }
}

function renderAttendanceTable(records) {
  const tbody = document.getElementById('attendance-table-body');
  if (!records || records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-dim); padding: 24px;">No attendance logged for this student.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(r => {
    const missed = Math.max(0, r.total_classes - r.attended_classes);
    const statusPill = r.status === 'GOOD' ? 'pill-green' : r.status === 'MONITOR' ? 'pill-yellow' : 'pill-red';
    const barColor = r.status === 'GOOD' ? '#10b981' : r.status === 'MONITOR' ? '#f59e0b' : '#ef4444';
    
    const neededText = r.classesNeededFor85 > 0 
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
        <td>${neededText}</td>
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
