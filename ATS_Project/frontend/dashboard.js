// Student Dashboard Controller
let chartInstances = {};
let allStudentResults = [];
let currentResultsFilter = 'all';
let currentSelectedPaymentMethod = 'UPI Simulation';

document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth('student');
  if (!user) return;
  initLayout();

  const studentId = user.studentId || 1;
  await loadDashboardData(studentId);

  // Activity Submission Form
  const actForm = document.getElementById('activity-submit-form');
  if (actForm) {
    actForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-submit-activity');
      btn.disabled = true;
      btn.textContent = 'Submitting... ⏳';

      const payload = {
        category: document.getElementById('act-category').value,
        title: document.getElementById('act-title').value.trim(),
        organizing_institution: document.getElementById('act-provider').value.trim(),
        event_date: document.getElementById('act-date').value,
        participation_level: document.getElementById('act-level').value,
        description: document.getElementById('act-desc').value.trim()
      };

      try {
        const res = await apiCall('/activities', 'POST', payload);
        showToast(res.message, 'success');
        closeModal('activity-submit-modal');
        actForm.reset();
        await loadDashboardData(studentId);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Submit for Review';
      }
    });
  }

  // Leave Application Form
  const leaveForm = document.getElementById('leave-apply-form');
  if (leaveForm) {
    leaveForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-submit-leave');
      btn.disabled = true;
      btn.textContent = 'Submitting... ⏳';

      const payload = {
        leave_type: document.getElementById('leave-type-select').value,
        start_date: document.getElementById('leave-start-date').value,
        end_date: document.getElementById('leave-end-date').value,
        reason: document.getElementById('leave-reason').value.trim()
      };

      try {
        const res = await apiCall('/leave', 'POST', payload);
        showToast(res.message, 'success');
        closeModal('leave-apply-modal');
        leaveForm.reset();
        await loadDashboardData(studentId);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Submit to Mentor';
      }
    });
  }

  // Demo Payment Form
  const payForm = document.getElementById('demo-payment-form');
  if (payForm) {
    const payAmtInput = document.getElementById('demo-pay-amount');
    if (payAmtInput) {
      payAmtInput.addEventListener('input', () => {
        const amt = Number(payAmtInput.value || 0);
        document.getElementById('demo-pay-display-amt').textContent = `₹${amt.toFixed(2)}`;
        document.getElementById('demo-pay-btn-text').textContent = amt.toFixed(2);
      });
    }

    payForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-confirm-demo-pay');
      btn.disabled = true;
      btn.textContent = 'Processing Demo Payment... ⏳';

      const feeId = parseInt(document.getElementById('demo-pay-fee-id').value, 10);
      const amount = parseFloat(document.getElementById('demo-pay-amount').value);
      const simulateFail = document.getElementById('demo-pay-simulate-fail').checked;

      try {
        const res = await apiCall('/fees/pay', 'POST', {
          fee_id: feeId,
          amount,
          payment_method: currentSelectedPaymentMethod,
          simulate_failure: simulateFail
        });

        showToast(res.message, 'success');
        closeModal('demo-payment-modal');

        // Reload data and show receipt
        await loadDashboardData(studentId);
        if (res.transactionRef) {
          await openReceiptModal(res.transactionRef);
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = `Pay (Demo)`;
      }
    });
  }
});

async function loadDashboardData(studentId) {
  try {
    const res = await apiCall(`/dashboard/${studentId}`);
    if (!res.success) throw new Error(res.message || 'Failed to load dashboard data');

    const {
      student,
      assignedMentor,
      kpi,
      charts,
      feeSummary,
      academicResults,
      activities,
      leaves,
      recentRecommendations
    } = res;

    // Update Banner & Headers
    document.getElementById('banner-student-name').textContent = student.name;
    document.getElementById('header-student-subtitle').textContent = 
      `${student.department} • ${student.year} • ${student.register_number}`;

    // Update Assigned Mentor Card
    renderMentorCard(assignedMentor);

    // Update KPI 1: GPA / CGPA
    document.getElementById('kpi-gpa').textContent = Number(kpi.gpa).toFixed(2);
    document.getElementById('kpi-cgpa').textContent = Number(kpi.cgpa).toFixed(2);

    // Update KPI 2: Attendance
    document.getElementById('kpi-attendance').textContent = `${Number(kpi.attendance).toFixed(0)}%`;
    const attPill = document.getElementById('kpi-attendance-pill');
    if (kpi.attendance >= 85) {
      attPill.className = 'kpi-pill pill-green';
      attPill.textContent = 'GOOD';
    } else if (kpi.attendance >= 75) {
      attPill.className = 'kpi-pill pill-yellow';
      attPill.textContent = 'MONITOR';
    } else {
      attPill.className = 'kpi-pill pill-red';
      attPill.textContent = 'RISK';
    }

    // Update KPI 3: Achievements
    document.getElementById('kpi-achievements').textContent = kpi.achievementsCount;

    // Update KPI 4: Academic Score
    document.getElementById('kpi-score').innerHTML = `${kpi.academicScore}<span style="font-size: 1.1rem; color: var(--text-dim);">/100</span>`;
    if (kpi.academicScoreDetails && kpi.academicScoreDetails.components) {
      const comp = kpi.academicScoreDetails.components;
      document.getElementById('modal-marks-contrib').textContent = `${comp.marks.contribution} pts (${comp.marks.weight})`;
      document.getElementById('modal-att-contrib').textContent = `${comp.attendance.contribution} pts (${comp.attendance.weight})`;
      document.getElementById('modal-ach-contrib').textContent = `${comp.achievements.contribution} pts (${comp.achievements.weight})`;
      document.getElementById('modal-total-score').textContent = `${kpi.academicScore} / 100`;
    }

    // Update KPI 5: Risk Level
    const riskEl = document.getElementById('kpi-risk');
    const riskPill = document.getElementById('kpi-risk-pill');
    riskEl.textContent = kpi.riskLevel;
    if (kpi.riskLevel === 'HIGH') {
      riskEl.style.color = '#ef4444';
      riskPill.className = 'kpi-pill pill-red';
      riskPill.textContent = 'Critical Action';
    } else if (kpi.riskLevel === 'MEDIUM') {
      riskEl.style.color = '#f59e0b';
      riskPill.className = 'kpi-pill pill-yellow';
      riskPill.textContent = 'Monitor Closely';
    } else {
      riskEl.style.color = '#34d399';
      riskPill.className = 'kpi-pill pill-green';
      riskPill.textContent = 'Safe Track';
    }

    // Render Academic Results (3-tier)
    allStudentResults = academicResults || [];
    renderStudentResultsTable();

    // Render Student Activities
    renderStudentActivitiesTable(activities || []);

    // Render Student Leaves
    renderStudentLeavesTable(leaves || []);

    // Load & Render Fees
    await loadStudentFees(studentId);

    // Render Charts
    renderSubjectPerformanceChart(charts.subjectPerformance);
    renderAcademicTrendChart(charts.academicTrend);
    renderAttendanceTrendChart(charts.attendanceTrend);
    renderAchievementDistributionChart(charts.achievementDistribution);

    // Render Recent AI Recommendations
    renderRecommendations(recentRecommendations);

  } catch (err) {
    console.error('[Dashboard Load Error]', err);
    showToast('Failed to load dashboard metrics. Reconnecting...', 'error');
  }
}

function renderMentorCard(mentor) {
  const card = document.getElementById('mentor-display-card');
  if (!mentor) {
    card.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div>
          <span class="kpi-pill pill-yellow" style="margin-bottom: 4px; display: inline-block;">ADVISORY ALLOCATION</span>
          <h3 style="font-size: 1.05rem; font-weight: 700; color: #fff;">Faculty Mentor Allocation In Progress</h3>
          <p style="font-size: 0.82rem; color: var(--text-dim);">Your department HOD is currently assigning your academic mentor.</p>
        </div>
      </div>
    `;
    return;
  }

  const avatarSrc = mentor.avatar || getInitialsAvatar(mentor.name);
  document.getElementById('mentor-avatar-img').src = avatarSrc;
  document.getElementById('mentor-avatar-img').onerror = () => {
    document.getElementById('mentor-avatar-img').src = getInitialsAvatar(mentor.name);
  };
  document.getElementById('mentor-display-name').textContent = mentor.name;
  document.getElementById('mentor-display-dept').textContent = `${mentor.designation || 'Faculty Mentor'} • Academic Advisor`;
  document.getElementById('mentor-display-email').textContent = mentor.email || 'mentor@ats.com';
}

function filterStudentResults(type) {
  currentResultsFilter = type;
  document.querySelectorAll('#student-results-pills .tab-pill').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase().includes(type) || (type === 'all' && btn.textContent.includes('All')));
  });
  renderStudentResultsTable();
}

function renderStudentResultsTable() {
  const tbody = document.getElementById('student-results-table-body');
  let list = allStudentResults;
  if (currentResultsFilter !== 'all') {
    list = allStudentResults.filter(r => r.assessment_type === currentResultsFilter);
  }

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 24px; color: var(--text-dim);">No results published for this assessment category.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(r => {
    const isPass = r.status === 'Pass';
    const pillClass = isPass ? 'pill-green' : 'pill-red';
    const typeLabel = r.assessment_type === 'internal' ? 'Internal Exam' : r.assessment_type === 'lab' ? 'Lab Practical' : 'Semester Exam';

    return `
      <tr>
        <td><span class="kpi-pill pill-blue">${typeLabel}</span></td>
        <td>
          <strong>${r.subject_code || ''}</strong>
          <div style="font-size: 0.75rem; color: var(--text-dim);">${r.subject_name || 'Subject'}</div>
        </td>
        <td>${r.assessment_name || typeLabel}</td>
        <td><strong style="color: ${Number(r.marks_obtained) >= Number(r.max_marks)*0.5 ? '#34d399' : '#f87171'};">${Number(r.marks_obtained).toFixed(1)}</strong></td>
        <td>${Number(r.max_marks).toFixed(1)}</td>
        <td><span class="kpi-pill pill-purple">${r.grade || '—'}</span></td>
        <td><span class="kpi-pill ${pillClass}">${r.status}</span></td>
        <td>${r.academic_year || '2026-2027'}</td>
      </tr>
    `;
  }).join('');
}

function renderStudentActivitiesTable(activities) {
  const tbody = document.getElementById('student-activities-table-body');
  if (activities.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-dim);">No activities submitted yet. Click "Add Submission" to record your achievements!</td></tr>';
    return;
  }

  tbody.innerHTML = activities.map(a => {
    const pillClass = a.status === 'Verified' ? 'pill-green' : a.status === 'Rejected' ? 'pill-red' : 'pill-yellow';

    return `
      <tr>
        <td><span class="kpi-pill pill-blue">${a.category}</span></td>
        <td>
          <strong>${escapeHtml(a.title)}</strong>
          ${a.description ? `<div style="font-size: 0.75rem; color: var(--text-dim);">${escapeHtml(a.description)}</div>` : ''}
        </td>
        <td>${escapeHtml(a.organizing_institution || '—')}</td>
        <td>${a.event_date ? formatDate(a.event_date) : '—'}</td>
        <td>${a.participation_level || 'Participant'}</td>
        <td><span class="kpi-pill ${pillClass}">${a.status}</span></td>
        <td style="font-size: 0.82rem; color: var(--text-dim);">${a.mentor_remarks || 'Awaiting mentor verification'}</td>
      </tr>
    `;
  }).join('');
}

function renderStudentLeavesTable(leaves) {
  const tbody = document.getElementById('student-leave-table-body');
  if (leaves.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-dim);">No leave applications on file.</td></tr>';
    return;
  }

  tbody.innerHTML = leaves.map(l => {
    const pillClass = l.status === 'Approved' ? 'pill-green' : l.status === 'Rejected' ? 'pill-red' : 'pill-yellow';

    return `
      <tr>
        <td><span class="kpi-pill pill-blue">${l.leave_type}</span></td>
        <td>${formatDate(l.start_date)}</td>
        <td>${formatDate(l.end_date)}</td>
        <td style="max-width: 200px; font-size: 0.85rem;">${escapeHtml(l.reason)}</td>
        <td><span class="kpi-pill ${pillClass}">${l.status}</span></td>
        <td>${l.reviewed_by_name || (l.status === 'Pending' ? 'Mentor Advisory Review' : 'Advisor')}</td>
        <td style="font-size: 0.82rem; color: var(--text-dim);">${l.remarks || '—'}</td>
      </tr>
    `;
  }).join('');
}

async function loadStudentFees(studentId) {
  try {
    const res = await apiCall(`/fees/student/${studentId}`);
    const { fees, payments, summary } = res.data;

    document.getElementById('fee-balance-badge').textContent = `Outstanding: ₹${Number(summary.totalBalance).toLocaleString('en-IN')}`;

    const tbody = document.getElementById('student-fees-table-body');
    if (!fees || fees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 24px; color: var(--text-dim);">No active fee obligations registered.</td></tr>';
      return;
    }

    tbody.innerHTML = fees.map(f => {
      const isPaid = f.status === 'Paid';
      const isPart = f.status === 'Partially Paid';
      const pillClass = isPaid ? 'pill-green' : isPart ? 'pill-yellow' : 'pill-red';
      const balance = Number(f.balance_amount || 0);

      const actionHtml = balance > 0
        ? `<button class="btn btn-primary" style="padding: 6px 12px; font-size: 0.78rem;" onclick="openDemoPaymentModal(${f.id}, '${escapeHtml(f.fee_category)}', ${balance})">Pay Now (Demo)</button>`
        : `<span style="color: #34d399; font-size: 0.78rem; font-weight: 700;">✓ Settled</span>`;

      return `
        <tr>
          <td><strong>${f.fee_category}</strong></td>
          <td>${f.academic_year || '2026-2027'}</td>
          <td>${f.semester || 'Semester 1'}</td>
          <td>₹${Number(f.total_amount).toLocaleString('en-IN')}</td>
          <td style="color: #34d399;">₹${Number(f.paid_amount).toLocaleString('en-IN')}</td>
          <td style="color: ${balance > 0 ? '#f87171' : '#34d399'}; font-weight: 700;">₹${balance.toLocaleString('en-IN')}</td>
          <td><span class="kpi-pill ${pillClass}">${f.status}</span></td>
          <td>${f.due_date ? formatDate(f.due_date) : '—'}</td>
          <td>${actionHtml}</td>
        </tr>
      `;
    }).join('');

    // Render payments history
    const pBody = document.getElementById('student-payments-table-body');
    if (!payments || payments.length === 0) {
      pBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 18px; color: var(--text-dim);">No payment transactions recorded yet.</td></tr>';
      return;
    }

    pBody.innerHTML = payments.map(p => {
      return `
        <tr>
          <td><strong style="font-family: monospace; color: var(--accent-cyan);">${p.transaction_ref}</strong></td>
          <td>${p.fee_category}</td>
          <td>${p.payment_method || 'Demo Gateway'}</td>
          <td style="color: #34d399; font-weight: 700;">₹${Number(p.amount).toLocaleString('en-IN')}</td>
          <td><span class="kpi-pill ${p.status === 'Success' ? 'pill-green' : 'pill-red'}">${p.status}</span></td>
          <td>${formatDate(p.payment_date)}</td>
          <td>
            ${p.status === 'Success' ? `<button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="openReceiptModal('${p.transaction_ref}')">🧾 Receipt</button>` : '—'}
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('[Load Student Fees Error]', err);
    document.getElementById('student-fees-table-body').innerHTML = `<tr><td colspan="9" style="text-align: center; color: #f87171;">Failed to load fee schedule: ${err.message}</td></tr>`;
  }
}

function openDemoPaymentModal(feeId, category, balance) {
  document.getElementById('demo-pay-fee-id').value = feeId;
  document.getElementById('demo-pay-category').textContent = category;
  document.getElementById('demo-pay-max-balance').textContent = `₹${balance.toLocaleString('en-IN')}`;
  
  const amountInput = document.getElementById('demo-pay-amount');
  amountInput.value = balance.toFixed(2);
  amountInput.max = balance;
  document.getElementById('demo-pay-display-amt').textContent = `₹${balance.toFixed(2)}`;
  document.getElementById('demo-pay-btn-text').textContent = balance.toFixed(2);

  document.getElementById('demo-pay-simulate-fail').checked = false;
  openModal('demo-payment-modal');
}

function selectPayMethod(el, method) {
  currentSelectedPaymentMethod = method;
  document.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

async function openReceiptModal(transactionRef) {
  try {
    const res = await apiCall(`/fees/receipt/${transactionRef}`);
    const r = res.receipt;

    document.getElementById('rcpt-txn-ref').textContent = r.transaction_ref;
    document.getElementById('rcpt-student-name').textContent = r.student_name;
    document.getElementById('rcpt-regno').textContent = r.register_number;
    document.getElementById('rcpt-dept').textContent = r.department_name || 'Engineering';
    document.getElementById('rcpt-category').textContent = `${r.fee_category} (${r.academic_year})`;

    document.getElementById('rcpt-total-fee').textContent = `₹${Number(r.total_amount).toLocaleString('en-IN')}`;
    document.getElementById('rcpt-paid-amt').textContent = `₹${Number(r.amount).toLocaleString('en-IN')}`;
    document.getElementById('rcpt-pay-method').textContent = r.payment_method;
    document.getElementById('rcpt-balance').textContent = `₹${Number(r.remaining_balance).toLocaleString('en-IN')}`;
    document.getElementById('rcpt-date').textContent = new Date(r.payment_date).toLocaleString();

    openModal('receipt-modal');
  } catch (err) {
    showToast('Failed to load official receipt: ' + err.message, 'error');
  }
}

function renderSubjectPerformanceChart(chartData) {
  const ctx = document.getElementById('subjectPerformanceChart').getContext('2d');
  if (chartInstances.subjectPerformance) chartInstances.subjectPerformance.destroy();

  chartInstances.subjectPerformance = new Chart(ctx, {
    type: 'bar',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#fff',
          bodyColor: '#38bdf8',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });
}

function renderAcademicTrendChart(chartData) {
  const ctx = document.getElementById('academicTrendChart').getContext('2d');
  if (chartInstances.academicTrend) chartInstances.academicTrend.destroy();

  chartInstances.academicTrend = new Chart(ctx, {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#fff',
          bodyColor: '#38bdf8'
        }
      },
      scales: {
        y: {
          min: 6.0,
          max: 10.0,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });
}

function renderAttendanceTrendChart(chartData) {
  const ctx = document.getElementById('attendanceTrendChart').getContext('2d');
  if (chartInstances.attendanceTrend) chartInstances.attendanceTrend.destroy();

  chartInstances.attendanceTrend = new Chart(ctx, {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { size: 11 } }
        }
      },
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

function renderAchievementDistributionChart(chartData) {
  const ctx = document.getElementById('achievementDistChart').getContext('2d');
  if (chartInstances.achievementDist) chartInstances.achievementDist.destroy();

  chartInstances.achievementDist = new Chart(ctx, {
    type: 'doughnut',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12 }
        }
      },
      cutout: '65%'
    }
  });
}

function renderRecommendations(list) {
  const container = document.getElementById('dashboard-recommendations-list');
  if (!list || list.length === 0) {
    container.innerHTML = `<div style="color: var(--text-dim); font-size: 0.88rem; padding: 12px;">No urgent recommendations active. Keep up the great work!</div>`;
    return;
  }

  container.innerHTML = list.map(item => {
    const pillClass = item.priority === 'HIGH' ? 'pill-red' : item.priority === 'MEDIUM' ? 'pill-yellow' : 'pill-blue';
    return `
      <div style="padding: 14px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: var(--radius-sm); display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span class="kpi-pill ${pillClass}">${item.priority}</span>
            <strong style="color: #fff; font-size: 0.92rem;">${item.title}</strong>
          </div>
          <p style="color: var(--text-muted); font-size: 0.82rem; margin-bottom: 6px;">${item.reason}</p>
          <div style="color: var(--accent-cyan); font-size: 0.8rem; font-weight: 500;">
            👉 Recommendation: ${item.recommendation}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
