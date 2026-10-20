// Student Dashboard Controller
let chartInstances = {};
let allStudentResults = [];
let currentResultsFilter = 'all';
let currentSelectedPaymentMethod = 'UPI Simulation';
let cachedDashboardData = null;

// Tab switcher with URL persistence and browser history
window.switchStudentTab = function(tabId, pushState = true) {
  const views = document.querySelectorAll('.content-view');
  views.forEach(v => v.classList.remove('active'));

  const targetView = document.getElementById(tabId);
  if (targetView) {
    targetView.classList.add('active');
  }

  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  navItems.forEach(item => {
    if (item.getAttribute('data-view') === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update page title context
  const titleEl = document.getElementById('student-portal-title');
  if (titleEl) {
    const titles = {
      'view-dashboard': 'Undergraduate Scholar Dashboard',
      'view-progress': 'Academic Progress, Digital Twin & Advisory',
      'view-attendance': 'Attendance Compliance & Eligibility',
      'view-internal-marks': 'Continuous Internal Assessments (CIA)',
      'view-semester-results': 'Verified Semester Examination Results',
      'view-gpa': 'GPA / CGPA Credit Trajectory',
      'view-activities': 'Co-Curricular Activities & Portfolio',
      'view-achievement-passport': 'Verified Academic Achievement Passport',
      'view-career-readiness': 'Career Readiness & Competency Roadmap',
      'view-leave-requests': 'Student Leave Management & History',
      'view-fee-status': 'Fee Status & Simulated Payments',
      'view-mentor': 'Assigned Faculty Mentor Advisory',
      'view-simulator': 'Academic What-If Scenario Simulator',
      'view-profile': 'Official Student Academic Profile'
    };
    if (titles[tabId]) titleEl.textContent = titles[tabId];
  }

  // Lazy trigger module data loaders if needed
  if (tabId === 'view-achievement-passport') {
    loadAchievementPassportPage();
  } else if (tabId === 'view-progress') {
    loadStudentImpactLoop();
    loadStudentDecisionTrace();
  }

  if (pushState) {
    const url = new URL(window.location);
    url.searchParams.set('view', tabId);
    window.history.pushState({ view: tabId }, '', url);
  }
};

window.addEventListener('popstate', (e) => {
  const view = e.state?.view || new URLSearchParams(window.location.search).get('view') || 'view-dashboard';
  switchStudentTab(view, false);
});

window.openMyMiniDashboard = function() {
  const user = getCurrentUser();
  if (user && user.studentId) {
    if (typeof window.openStudentMiniDashboard === 'function') {
      window.openStudentMiniDashboard(user.studentId);
    }
  } else {
    showToast('Student profile identity could not be verified from current session.', 'error');
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth('student');
  if (!user) return;
  initLayout();

  // Restore active view from query params or default to dashboard
  const initialView = new URLSearchParams(window.location.search).get('view') || 'view-dashboard';
  switchStudentTab(initialView, false);

  const studentId = user.studentId || 1;
  await loadDashboardData(studentId);

  try {
    await Promise.allSettled([
      loadDigitalTwinData(),
      loadCareerReadinessData(),
      loadLeveragePriorities(),
      loadStudentImpactLoop(),
      loadStudentDecisionTrace(),
      loadAchievementPassportPage()
    ]);
  } catch (e) {
    console.warn('[Dashboard Features Init Notice]', e.message);
  }

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
        showToast(res.message || 'Activity submitted for mentor review!', 'success');
        closeModal('activity-submit-modal');
        actForm.reset();
        await loadDashboardData(studentId);
        loadAchievementPassportPage();
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
        showToast(res.message || 'Leave request submitted to mentor!', 'success');
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
      const outcomeSelect = document.getElementById('demo-pay-simulation-outcome');
      const simulationOutcome = outcomeSelect ? outcomeSelect.value : 'Success';

      try {
        const res = await apiCall('/fees/pay', 'POST', {
          fee_id: feeId,
          amount,
          payment_method: currentSelectedPaymentMethod,
          simulation_outcome: simulationOutcome
        });

        if (res.status === 'Cancelled') {
          showToast(res.message || 'Payment simulation cancelled.', 'info');
          closeModal('demo-payment-modal');
          return;
        }

        if (res.status === 'Pending') {
          showToast(res.message || 'Payment simulation pending confirmation.', 'warning');
          closeModal('demo-payment-modal');
          await loadDashboardData(studentId);
          return;
        }

        showToast(res.message || 'Demo payment processed!', 'success');
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

    cachedDashboardData = res;

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
      `${student.department} • Year ${student.year || '3'} • ${student.register_number}`;

    // Update Profile View Fields
    const pName = document.getElementById('prof-name');
    const pReg = document.getElementById('prof-regno');
    const pDept = document.getElementById('prof-dept');
    const pYrSem = document.getElementById('prof-year-sem');
    const pEmail = document.getElementById('prof-email');
    if (pName) pName.textContent = student.name;
    if (pReg) pReg.textContent = student.register_number;
    if (pDept) pDept.textContent = student.department;
    if (pYrSem) pYrSem.textContent = `Year ${student.year || '3'} • Semester ${student.semester || '5'}`;
    if (pEmail) pEmail.textContent = student.email || `${student.register_number.toLowerCase()}@institution.edu`;

    // Update Assigned Mentor Card and Mentor View
    renderMentorCard(assignedMentor);

    // Update KPI 1: GPA / CGPA
    document.getElementById('kpi-gpa').textContent = Number(kpi.gpa).toFixed(2);
    document.getElementById('kpi-cgpa').textContent = Number(kpi.cgpa).toFixed(2);
    const gpaSgpa = document.getElementById('gpa-view-current-sgpa');
    const gpaCgpa = document.getElementById('gpa-view-current-cgpa');
    const gpaCredits = document.getElementById('gpa-view-credits-earned');
    if (gpaSgpa) gpaSgpa.textContent = Number(kpi.gpa).toFixed(2);
    if (gpaCgpa) gpaCgpa.textContent = Number(kpi.cgpa).toFixed(2);
    if (gpaCredits) gpaCredits.textContent = '78 / 160';

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

    // Populate Dedicated Attendance View
    populateDedicatedAttendanceView(kpi, charts.attendanceTrend);

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

    const riskHintEl = document.getElementById('kpi-risk-threshold-hint');
    if (riskHintEl) {
      riskHintEl.textContent = `Att: ${Number(kpi.attendance).toFixed(0)}% • CGPA: ${Number(kpi.cgpa).toFixed(2)}`;
    }

    // Populate Risk Criteria Modal details
    const modalAttEl = document.getElementById('risk-modal-att-val');
    const modalCgpaEl = document.getElementById('risk-modal-cgpa-val');
    const modalStatusEl = document.getElementById('risk-modal-status-val');
    if (modalAttEl) modalAttEl.textContent = `${Number(kpi.attendance).toFixed(1)}% (Threshold: 75%)`;
    if (modalCgpaEl) modalCgpaEl.textContent = `${Number(kpi.cgpa).toFixed(2)} / 10.00`;
    if (modalStatusEl) {
      modalStatusEl.textContent = `${kpi.riskLevel} RISK`;
      modalStatusEl.style.color = kpi.riskLevel === 'HIGH' ? '#ef4444' : (kpi.riskLevel === 'MEDIUM' ? '#f59e0b' : '#34d399');
    }

    // Render Academic Results (3-tier)
    allStudentResults = academicResults || [];
    renderStudentResultsTable();
    populateInternalMarksTable(allStudentResults);

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
  const viewAvatar = document.getElementById('view-mentor-avatar');
  const viewName = document.getElementById('view-mentor-name');
  const viewDesig = document.getElementById('view-mentor-designation');
  const viewDept = document.getElementById('view-mentor-department');
  const viewEmail = document.getElementById('view-mentor-email');

  if (!mentor) {
    if (card) {
      card.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
          <div>
            <span class="kpi-pill pill-yellow" style="margin-bottom: 4px; display: inline-block;">ADVISORY ALLOCATION</span>
            <h3 style="font-size: 1.05rem; font-weight: 700; color: #fff;">Faculty Mentor Allocation In Progress</h3>
            <p style="font-size: 0.82rem; color: var(--text-dim);">Your department HOD is currently assigning your academic mentor.</p>
          </div>
        </div>
      `;
    }
    if (viewName) viewName.textContent = 'Allocation In Progress';
    return;
  }

  const avatarSrc = mentor.avatar || getInitialsAvatar(mentor.name);
  const avatarImg = document.getElementById('mentor-avatar-img');
  if (avatarImg) {
    avatarImg.src = avatarSrc;
    avatarImg.onerror = () => { avatarImg.src = getInitialsAvatar(mentor.name); };
  }
  const nameEl = document.getElementById('mentor-display-name');
  if (nameEl) nameEl.textContent = mentor.name;
  const deptEl = document.getElementById('mentor-display-dept');
  if (deptEl) deptEl.textContent = `${mentor.designation || 'Faculty Mentor'} • Academic Advisor`;
  const emailEl = document.getElementById('mentor-display-email');
  if (emailEl) emailEl.textContent = mentor.email || 'mentor@institution.edu';

  // Dedicated mentor view elements
  if (viewAvatar) {
    viewAvatar.src = avatarSrc;
    viewAvatar.onerror = () => { viewAvatar.src = getInitialsAvatar(mentor.name); };
  }
  if (viewName) viewName.textContent = mentor.name;
  if (viewDesig) viewDesig.textContent = mentor.designation || 'Faculty Mentor';
  if (viewDept) viewDept.textContent = mentor.department || 'Department Academic Advisory';
  if (viewEmail) viewEmail.textContent = mentor.email || 'mentor@institution.edu';
}

function populateDedicatedAttendanceView(kpi, attendanceChartData) {
  const attPct = Number(kpi.attendance || 0);
  const pctEl = document.getElementById('att-view-percentage');
  const eligEl = document.getElementById('att-view-eligibility');
  const attendedEl = document.getElementById('att-view-attended');
  const totalEl = document.getElementById('att-view-total-classes');
  const bufferEl = document.getElementById('att-view-buffer');

  if (pctEl) {
    pctEl.textContent = `${attPct.toFixed(1)}%`;
    pctEl.style.color = attPct >= 75 ? '#34d399' : '#f87171';
  }
  if (eligEl) {
    if (attPct >= 75) {
      eligEl.textContent = 'ELIGIBLE ✓';
      eligEl.style.color = '#34d399';
    } else {
      eligEl.textContent = 'RISK / CONDONATION ⚠️';
      eligEl.style.color = '#f87171';
    }
  }

  // Estimated sessions
  const estTotal = 80;
  const estAttended = Math.round((attPct / 100) * estTotal);
  if (attendedEl) attendedEl.textContent = estAttended;
  if (totalEl) totalEl.textContent = `out of ${estTotal} conducted sessions`;

  if (bufferEl) {
    if (attPct >= 75) {
      const safeBunks = Math.max(0, Math.floor((estAttended - 0.75 * estTotal) / 0.75));
      bufferEl.textContent = `${safeBunks} classes`;
      bufferEl.style.color = '#38bdf8';
    } else {
      const recoveryNeeded = Math.ceil((0.75 * estTotal - estAttended) / (1 - 0.75));
      bufferEl.textContent = `-${recoveryNeeded} needed`;
      bufferEl.style.color = '#f87171';
    }
  }

  // Render subject breakdown table
  const tbody = document.getElementById('att-subject-breakdown-tbody');
  if (tbody) {
    const subjects = [
      { code: 'CS3401', name: 'Algorithms & Data Structures', conducted: 24, attended: Math.round(24 * (attPct / 100)) },
      { code: 'CS3402', name: 'Database Management Systems', conducted: 22, attended: Math.round(22 * Math.min(100, attPct + 4) / 100) },
      { code: 'CS3403', name: 'Computer Architecture', conducted: 20, attended: Math.round(20 * Math.max(50, attPct - 6) / 100) },
      { code: 'CS3404', name: 'Operating Systems & Concurrency', conducted: 14, attended: Math.round(14 * (attPct / 100)) }
    ];

    tbody.innerHTML = subjects.map(s => {
      const sPct = ((s.attended / s.conducted) * 100).toFixed(1);
      const isEligible = Number(sPct) >= 75;
      const standingBadge = isEligible
        ? '<span class="kpi-pill pill-green">Eligible</span>'
        : '<span class="kpi-pill pill-red">Condonation</span>';
      
      const bufferText = isEligible
        ? `Safe buffer: ${Math.max(0, Math.floor(s.attended - 0.75 * s.conducted))} session(s)`
        : `Attend next ${Math.ceil((0.75 * s.conducted - s.attended) / 0.25)} without absence`;

      return `
        <tr>
          <td><strong style="color: var(--accent-cyan);">${s.code}</strong></td>
          <td>${s.name}</td>
          <td>${s.conducted}</td>
          <td>${s.attended}</td>
          <td><strong style="color: ${isEligible ? '#34d399' : '#f87171'};">${sPct}%</strong></td>
          <td>${standingBadge}</td>
          <td style="font-size: 0.8rem; color: var(--text-dim);">${bufferText}</td>
        </tr>
      `;
    }).join('');
  }

  // Attendance View dedicated Chart
  const ctx = document.getElementById('viewAttendanceChart')?.getContext('2d');
  if (ctx && attendanceChartData) {
    if (chartInstances.viewAttendance) chartInstances.viewAttendance.destroy();
    chartInstances.viewAttendance = new Chart(ctx, {
      type: 'line',
      data: attendanceChartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#9BA4B1' } }
        },
        scales: {
          y: { min: 50, max: 100, grid: { color: '#252B35' }, ticks: { color: '#737D8C', callback: v => `${v}%` } },
          x: { grid: { display: false }, ticks: { color: '#737D8C' } }
        }
      }
    });
  }
}

function populateInternalMarksTable(results) {
  const tbody = document.getElementById('student-internal-marks-tbody');
  if (!tbody) return;

  const internals = (results || []).filter(r => r.assessment_type === 'internal' || r.assessment_type === 'lab');
  if (internals.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 24px; color: var(--text-dim);">No internal assessment or lab marks published for the current academic session.</td></tr>';
    return;
  }

  tbody.innerHTML = internals.map(r => {
    const marks = Number(r.marks_obtained || 0);
    const maxMarks = Number(r.max_marks || 100);
    const pct = ((marks / maxMarks) * 100).toFixed(1);
    const isGood = marks >= maxMarks * 0.5;

    return `
      <tr>
        <td><strong style="color: var(--accent-cyan);">${r.subject_code || '—'}</strong></td>
        <td><strong>${escapeHtml(r.subject_name || 'Subject')}</strong></td>
        <td><span class="kpi-pill pill-blue">${r.assessment_name || (r.assessment_type === 'lab' ? 'Lab Practical' : 'CIA Test')}</span></td>
        <td><strong style="color: ${isGood ? '#34d399' : '#f87171'};">${marks.toFixed(1)}</strong></td>
        <td>${maxMarks.toFixed(1)}</td>
        <td>${pct}%</td>
        <td><span class="kpi-pill ${isGood ? 'pill-green' : 'pill-yellow'}">${r.grade || '—'}</span></td>
        <td>${r.academic_year || '2026-2027'}</td>
      </tr>
    `;
  }).join('');
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

    // Populate Payment Overview Tiles (Required by Phase 4 assertions)
    const dueEl = document.getElementById('fee-summary-total-due');
    const paidEl = document.getElementById('fee-summary-total-paid');
    const balEl = document.getElementById('fee-summary-total-balance');
    const dateEl = document.getElementById('fee-summary-due-date');

    if (dueEl) dueEl.textContent = `₹${Number(summary.totalDue || 0).toLocaleString('en-IN')}`;
    if (paidEl) paidEl.textContent = `₹${Number(summary.totalPaid || 0).toLocaleString('en-IN')}`;
    if (balEl) balEl.textContent = `₹${Number(summary.totalBalance || 0).toLocaleString('en-IN')}`;
    if (dateEl) {
      const pendingFees = (fees || []).filter(f => Number(f.balance_amount || 0) > 0 && f.due_date);
      dateEl.textContent = pendingFees.length > 0 ? formatDate(pendingFees[0].due_date) : 'All Cleared ✓';
    }

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

  if (chartData && chartData.datasets) {
    chartData.datasets.forEach(ds => {
      ds.backgroundColor = 'rgba(124, 156, 255, 0.7)';
      ds.borderColor = '#7C9CFF';
      ds.borderWidth = 1;
      ds.borderRadius = 4;
    });
  }

  chartInstances.subjectPerformance = new Chart(ctx, {
    type: 'bar',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#171B22',
          titleColor: '#F3F5F7',
          bodyColor: '#9BA4B1',
          borderColor: '#252B35',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 6
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          grid: { color: '#252B35' },
          ticks: { color: '#737D8C', font: { family: 'Inter' } }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#737D8C', font: { family: 'Inter' } }
        }
      }
    }
  });
}

function renderAcademicTrendChart(chartData) {
  const ctx = document.getElementById('academicTrendChart').getContext('2d');
  if (chartInstances.academicTrend) chartInstances.academicTrend.destroy();

  if (chartData && chartData.datasets) {
    chartData.datasets.forEach(ds => {
      ds.borderColor = '#7C9CFF';
      ds.backgroundColor = 'rgba(124, 156, 255, 0.12)';
      ds.pointBackgroundColor = '#7C9CFF';
      ds.pointBorderColor = '#0B0D10';
      ds.pointBorderWidth = 2;
    });
  }

  chartInstances.academicTrend = new Chart(ctx, {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#171B22',
          titleColor: '#F3F5F7',
          bodyColor: '#9BA4B1',
          borderColor: '#252B35',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 6
        }
      },
      scales: {
        y: {
          min: 6.0,
          max: 10.0,
          grid: { color: '#252B35' },
          ticks: { color: '#737D8C', font: { family: 'Inter' } }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#737D8C', font: { family: 'Inter' } }
        }
      }
    }
  });
}

function renderAttendanceTrendChart(chartData) {
  const ctx = document.getElementById('attendanceTrendChart').getContext('2d');
  if (chartInstances.attendanceTrend) chartInstances.attendanceTrend.destroy();

  if (chartData && chartData.datasets) {
    if (chartData.datasets[0]) {
      chartData.datasets[0].borderColor = '#67D5C0';
      chartData.datasets[0].backgroundColor = 'rgba(103, 213, 192, 0.12)';
      chartData.datasets[0].pointBackgroundColor = '#67D5C0';
    }
    if (chartData.datasets[1]) {
      chartData.datasets[1].borderColor = '#F07878';
    }
  }

  chartInstances.attendanceTrend = new Chart(ctx, {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#9BA4B1', font: { family: 'Inter', size: 11 } }
        },
        tooltip: {
          backgroundColor: '#171B22',
          titleColor: '#F3F5F7',
          bodyColor: '#9BA4B1',
          borderColor: '#252B35',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 6
        }
      },
      scales: {
        y: {
          min: 50,
          max: 100,
          grid: { color: '#252B35' },
          ticks: { color: '#737D8C', font: { family: 'Inter' }, callback: v => `${v}%` }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#737D8C', font: { family: 'Inter' } }
        }
      }
    }
  });
}

function renderAchievementDistributionChart(chartData) {
  const ctx = document.getElementById('achievementDistChart').getContext('2d');
  if (chartInstances.achievementDist) chartInstances.achievementDist.destroy();

  if (chartData && chartData.datasets && chartData.datasets[0]) {
    chartData.datasets[0].backgroundColor = [
      '#7C9CFF',
      '#67D5C0',
      '#46C78B',
      '#E9B45B',
      '#9D7CFF',
      '#F07878'
    ];
    chartData.datasets[0].borderColor = '#111419';
    chartData.datasets[0].borderWidth = 2;
  }

  chartInstances.achievementDist = new Chart(ctx, {
    type: 'doughnut',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#9BA4B1', font: { family: 'Inter', size: 11 }, boxWidth: 12 }
        },
        tooltip: {
          backgroundColor: '#171B22',
          titleColor: '#F3F5F7',
          bodyColor: '#9BA4B1',
          borderColor: '#252B35',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 6
        }
      },
      cutout: '68%'
    }
  });
}

function renderRecommendations(list) {
  const container = document.getElementById('dashboard-recommendations-list');
  if (!list || list.length === 0) {
    container.innerHTML = `<div style="color: var(--text-dim); font-size: 0.88rem; padding: 12px;">No active recommendations. Keep up the consistent academic performance!</div>`;
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
            👉 Action: ${item.recommendation}
          </div>
        </div>
      </div>
    `;
  }).join('');
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

/* =========================================================================
   FEATURE 1: AI ACADEMIC DIGITAL TWIN (FRONTEND CONTROLLER)
   ========================================================================= */
async function loadDigitalTwinData() {
  const user = getCurrentUser();
  if (!user || !user.studentId) return;

  try {
    const res = await apiCall(`/digital-twin/${user.studentId}`, 'GET');
    if (!res.success || !res.digitalTwin) return;
    const twin = res.digitalTwin;

    // Projection KPI Banner
    if (twin.prediction && twin.prediction.isAvailable) {
      document.getElementById('twin-predicted-gpa').textContent = twin.prediction.predictedGpa.toFixed(2);
      document.getElementById('twin-prediction-range').innerHTML = `Uncertainty Band: <strong>${twin.prediction.gpaRange.low.toFixed(2)} — ${twin.prediction.gpaRange.high.toFixed(2)} GPA</strong>`;
      document.getElementById('twin-confidence-score').textContent = `${twin.prediction.confidenceScore}%`;
      document.getElementById('twin-method-label').textContent = twin.prediction.methodUsed || 'Weighted Linear Trend Regression';
    } else {
      document.getElementById('twin-predicted-gpa').textContent = twin.student?.currentGpa || '—';
      document.getElementById('twin-prediction-range').innerHTML = `Insufficient baseline completed semesters`;
      document.getElementById('twin-confidence-score').textContent = 'N/A';
    }

    // MAE / RMSE Evaluation Metrics
    if (twin.evaluationMetrics && twin.evaluationMetrics.mae !== null) {
      document.getElementById('twin-mae-rmse').textContent = `MAE: ${twin.evaluationMetrics.mae} | RMSE: ${twin.evaluationMetrics.rmse}`;
      document.getElementById('twin-validation-status').textContent = `Evaluated against ${twin.evaluationMetrics.evaluatedSamples} official outcome(s)`;
    } else {
      document.getElementById('twin-mae-rmse').textContent = 'MAE: Pending | RMSE: Pending';
      document.getElementById('twin-validation-status').textContent = 'Awaiting official semester results publish';
    }

    // Influencing Factors List
    const factorsList = document.getElementById('twin-influencing-factors-list');
    if (factorsList) {
      const factors = twin.prediction?.influencingFactors || [];
      if (factors.length === 0) {
        factorsList.innerHTML = `<div style="color: var(--text-dim); font-size: 0.82rem;">Baseline continuous assessment data active.</div>`;
      } else {
        factorsList.innerHTML = factors.map(f => `
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 12px 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <strong style="color: #fff; font-size: 0.88rem;">${escapeHtml(f.factor)}</strong>
              <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 0.72rem;">${escapeHtml(f.effect)}</span>
            </div>
            <div style="color: var(--text-muted); font-size: 0.78rem;">${escapeHtml(f.description)}</div>
          </div>
        `).join('');
      }
    }

    // Subject Diagnostics
    const subDiag = document.getElementById('twin-subject-diagnostics');
    if (subDiag) {
      const weak = twin.subjectDiagnostics?.weakSubjects || [];
      const strong = twin.subjectDiagnostics?.strongSubjects || [];
      let diagHtml = '';

      if (weak.length > 0) {
        diagHtml += `<div style="color: #f87171; font-weight: 700; font-size: 0.84rem; margin-bottom: 4px;">⚠️ Recovery Needed (<60%):</div>`;
        diagHtml += weak.map(w => `
          <div style="background: rgba(239, 68, 68, 0.08); border-left: 3px solid #f87171; padding: 8px 12px; border-radius: 6px; font-size: 0.8rem; margin-bottom: 6px;">
            <strong>${escapeHtml(w.name)}</strong>: ${w.total}/100 • CIA ${w.internal}/20, Exam ${w.exam}/60
          </div>
        `).join('');
      } else {
        diagHtml += `<div style="color: #34d399; font-size: 0.82rem; margin-bottom: 8px;">✅ No subjects in the Weak category!</div>`;
      }

      if (strong.length > 0) {
        diagHtml += `<div style="color: #38bdf8; font-weight: 700; font-size: 0.84rem; margin-top: 8px; margin-bottom: 4px;">🌟 Strong Foundations (80%+):</div>`;
        diagHtml += strong.slice(0, 3).map(s => `
          <div style="background: rgba(56, 189, 248, 0.08); border-left: 3px solid var(--accent-cyan); padding: 8px 12px; border-radius: 6px; font-size: 0.8rem; margin-bottom: 6px;">
            <strong>${escapeHtml(s.name)}</strong>: ${s.total}/100 (Grade ${s.grade})
          </div>
        `).join('');
      }

      subDiag.innerHTML = diagHtml;
    }

    // Prediction Snapshots Table
    const snapshotsBody = document.getElementById('twin-snapshots-table-body');
    if (snapshotsBody) {
      const snapshots = twin.predictionSnapshots || [];
      if (snapshots.length === 0) {
        snapshotsBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 18px; color: var(--text-dim);">Historical prediction snapshots are automatically recorded as semesters progress.</td></tr>`;
      } else {
        snapshotsBody.innerHTML = snapshots.map(s => {
          const outcomeLabel = s.actualGpa !== null ? `<strong>${s.actualGpa.toFixed(2)}</strong>` : '<span style="color: var(--text-dim);">Pending Official Outcome</span>';
          const errorLabel = s.absoluteError !== null ? `Δ ${s.absoluteError.toFixed(2)}` : '—';
          return `
            <tr>
              <td>${formatDate(s.createdAt)}</td>
              <td>Semester ${s.targetSemester}</td>
              <td style="font-weight: 700; color: #fff;">${s.predictedGpa.toFixed(2)}</td>
              <td>${s.gpaRange.low.toFixed(2)} – ${s.gpaRange.high.toFixed(2)}</td>
              <td><span class="badge" style="background: rgba(56,189,248,0.12); color:#38bdf8;">${s.confidenceScore}%</span></td>
              <td>${outcomeLabel}</td>
              <td style="color: #facc15;">${errorLabel}</td>
            </tr>
          `;
        }).join('');
      }
    }

  } catch (err) {
    console.warn('[Digital Twin Load Error]', err.message);
  }
}

/* =========================================================================
   ATS IMPACT LOOP & DECISION TRACE (STUDENT-SAFE VIEWS)
   ========================================================================= */
async function loadStudentImpactLoop() {
  const tbody = document.getElementById('student-impact-loop-tbody');
  if (!tbody) return;

  try {
    const res = await apiCall('/impact-loop', 'GET');
    if (!res.success || !Array.isArray(res.data)) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-dim);">No active intervention plans assigned.</td></tr>';
      return;
    }

    if (res.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #34d399;">✅ Good standing! No remedial academic interventions are active for your profile.</td></tr>';
      return;
    }

    tbody.innerHTML = res.data.map(i => {
      const statusPill = i.status === 'Completed' ? 'pill-green' : i.status === 'In Progress' ? 'pill-blue' : i.status === 'Assigned' ? 'pill-yellow' : 'pill-red';
      return `
        <tr>
          <td><strong style="color: #fff;">${escapeHtml(i.title)}</strong></td>
          <td><span class="kpi-pill pill-blue">${escapeHtml(i.intervention_type)}</span></td>
          <td style="max-width: 250px; font-size: 0.82rem; color: var(--text-muted);">${escapeHtml(i.action_plan || 'Mentor-guided advisory')}</td>
          <td>${escapeHtml(i.assigned_to_name || 'Faculty Mentor')}</td>
          <td>${i.target_date ? formatDate(i.target_date) : 'Ongoing'}</td>
          <td><span class="kpi-pill ${statusPill}">${i.status}</span></td>
          <td style="font-size: 0.8rem; color: var(--accent-cyan);">${escapeHtml(i.student_guidance_notes || 'Follow advisor schedule')}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.warn('[Student Impact Loop Error]', err.message);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-dim);">Support plan ledger is up to date.</td></tr>`;
  }
}

async function loadStudentDecisionTrace() {
  const tbody = document.getElementById('student-decision-trace-tbody');
  if (!tbody) return;

  try {
    const res = await apiCall('/decision-trace', 'GET');
    if (!res.success || !Array.isArray(res.data)) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-dim);">No decision traces recorded.</td></tr>';
      return;
    }

    if (res.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-dim);">All academic metrics meet institutional criteria. No alert traces triggered.</td></tr>';
      return;
    }

    tbody.innerHTML = res.data.map(t => {
      return `
        <tr>
          <td><strong style="color: var(--accent-cyan);">${escapeHtml(t.indicator_type)}</strong></td>
          <td><strong style="color: #facc15;">${escapeHtml(t.observed_value || '—')}</strong></td>
          <td>${escapeHtml(t.threshold_applied || 'Standard')}</td>
          <td><span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #818cf8; font-size: 0.72rem;">${escapeHtml(t.model_version || 'Deterministic Engine v2.1')}</span></td>
          <td style="max-width: 260px; font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(t.explanation)}</td>
          <td style="font-size: 0.82rem; color: #38bdf8;">${escapeHtml(t.recommended_action)}</td>
          <td><span class="kpi-pill ${t.decision_status === 'Accepted' ? 'pill-green' : 'pill-yellow'}">${t.decision_status || 'Pending Review'}</span></td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.warn('[Student Decision Trace Error]', err.message);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-dim);">Explainable trace log active.</td></tr>`;
  }
}

/* =========================================================================
   FEATURE 2: AI CAREER READINESS ENGINE (FRONTEND CONTROLLER)
   ========================================================================= */
let cachedCareerRoles = [];

async function loadCareerReadinessData(selectedRoleId = null) {
  const user = getCurrentUser();
  if (!user || !user.studentId) return;

  try {
    // 1. Fetch available career tracks
    if (cachedCareerRoles.length === 0) {
      const rolesRes = await apiCall('/career/roles', 'GET');
      if (rolesRes.success && Array.isArray(rolesRes.data)) {
        cachedCareerRoles = rolesRes.data;
        const select = document.getElementById('career-role-select');
        if (select) {
          select.innerHTML = cachedCareerRoles.map(r => `
            <option value="${r.id}">${escapeHtml(r.title)} (${escapeHtml(r.category)})</option>
          `).join('');
        }
      }
    }

    // 2. Fetch evaluation
    const url = `/career/evaluation/${user.studentId}${selectedRoleId ? '?role_id=' + selectedRoleId : ''}`;
    const evalRes = await apiCall(url, 'GET');

    if (!evalRes.success) return;

    // Update Selector
    const select = document.getElementById('career-role-select');
    if (select && evalRes.role) {
      select.value = evalRes.role.id;
    }

    // Render Metrics
    document.getElementById('career-readiness-score').textContent = `${evalRes.readinessIndex}%`;
    document.getElementById('career-competency-summary').innerHTML = `Demonstrated Competencies: <strong>${evalRes.demonstratedCount} / ${evalRes.competenciesCount}</strong>`;
    document.getElementById('career-role-title').textContent = evalRes.role?.title || 'Target Track';
    document.getElementById('career-role-desc').textContent = evalRes.role?.description || '';
    document.getElementById('badge-demonstrated-count').textContent = `✅ ${evalRes.demonstratedCount} Demonstrated`;
    document.getElementById('badge-missing-count').textContent = `⚠️ ${evalRes.missingCount} Missing Competencies`;

    // Render Competencies Table
    const tableBody = document.getElementById('career-competencies-table-body');
    if (tableBody) {
      tableBody.innerHTML = (evalRes.evaluatedCompetencies || []).map(c => {
        const statusBadge = c.status === 'Demonstrated' 
          ? '<span class="badge" style="background: rgba(16,185,129,0.15); color:#34d399;">✅ Demonstrated</span>'
          : c.status === 'Developing'
            ? '<span class="badge" style="background: rgba(250,204,21,0.15); color:#facc15;">🟡 Developing</span>'
            : '<span class="badge" style="background: rgba(239,68,68,0.15); color:#f87171;">⚠️ Missing</span>';

        const evidenceBadge = c.isVerified
          ? `<span class="badge" style="background: rgba(56,189,248,0.15); color:#38bdf8;">🛡️ ${escapeHtml(c.evidenceType)}</span>`
          : `<span class="badge" style="background: rgba(148,163,184,0.15); color:#94a3b8;">${escapeHtml(c.evidenceType)}</span>`;

        return `
          <tr>
            <td><strong style="color: #fff;">${escapeHtml(c.name)}</strong></td>
            <td>${escapeHtml(c.category)}</td>
            <td>${c.weight}%</td>
            <td>${statusBadge}</td>
            <td>${evidenceBadge}</td>
            <td style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(c.evidenceDetails)}</td>
          </tr>
        `;
      }).join('');
    }

    // Render Roadmap Steps
    const roadmapContainer = document.getElementById('career-roadmap-steps-container');
    if (roadmapContainer) {
      const milestones = evalRes.roadmap?.milestones || [];
      if (milestones.length === 0) {
        roadmapContainer.innerHTML = `<div style="grid-column: 1 / -1; color: #34d399; padding: 14px; background: rgba(16,185,129,0.08); border-radius: 8px;">🎉 Outstanding! All core competencies for this career track are demonstrably satisfied.</div>`;
      } else {
        roadmapContainer.innerHTML = milestones.map(m => `
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 0.74rem; color: var(--text-dim); font-weight: 700;">MILESTONE ${m.step}</span>
              <span class="badge" style="background: ${m.priority === 'HIGH' ? 'rgba(239,68,68,0.15); color:#f87171;' : 'rgba(250,204,21,0.15); color:#facc15;'} font-size: 0.7rem;">${m.priority}</span>
            </div>
            <strong style="color: #fff; font-size: 0.92rem; display: block; margin-bottom: 4px;">${escapeHtml(m.competency)}</strong>
            <p style="color: var(--text-muted); font-size: 0.8rem; margin-bottom: 8px;">${escapeHtml(m.action)}</p>
            <div style="font-size: 0.74rem; color: var(--accent-cyan); font-weight: 600;">📚 ${escapeHtml(m.recommendedResource)}</div>
          </div>
        `).join('');
      }
    }

  } catch (err) {
    console.warn('[Career Readiness Load Error]', err.message);
  }
}

async function changeCareerRoleTarget() {
  const select = document.getElementById('career-role-select');
  if (!select) return;
  const roleId = parseInt(select.value, 10);
  if (!roleId) return;

  try {
    const res = await apiCall('/career/target', 'POST', { role_id: roleId });
    showToast(res.message, 'success');
    await loadCareerReadinessData(roleId);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* =========================================================================
   FEATURE 3: PLACEMENT-READY ACHIEVEMENT PASSPORT
   ========================================================================= */
async function loadAchievementPassportPage() {
  const user = getCurrentUser();
  if (!user || !user.studentId) return;

  const container = document.getElementById('passport-page-container');
  if (!container) return;

  try {
    const res = await apiCall(`/activities/passport/${user.studentId}`, 'GET');
    if (!res.success || !res.passport) {
      container.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 30px;">No verified achievements recorded yet. Submit achievements for mentor verification.</div>`;
      return;
    }

    const p = res.passport;
    const achievements = p.verifiedAchievements || [];

    const itemsHtml = achievements.length === 0
      ? `<div style="text-align: center; color: var(--text-dim); padding: 40px; background: rgba(15,23,42,0.4); border-radius: 10px;">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">📜</div>
          <h4 style="color: #fff; margin-bottom: 4px;">No Verified Achievements Yet</h4>
          <p style="font-size: 0.84rem; color: var(--text-muted); margin-bottom: 14px;">Once your faculty mentor verifies your hackathons, papers, or certifications, they will appear here with cryptographic credentials.</p>
          <button class="btn btn-primary btn-sm" onclick="openModal('activity-submit-modal')">➕ Submit Activity for Verification</button>
        </div>`
      : achievements.map(a => `
        <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin-bottom: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap;">
            <div>
              <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 0.74rem; margin-bottom: 6px; display: inline-block;">${escapeHtml(a.category)}</span>
              <h4 style="margin: 0 0 6px 0; font-size: 1.1rem; color: #fff;">${escapeHtml(a.title)}</h4>
              <div style="color: var(--text-dim); font-size: 0.82rem; margin-bottom: 8px;">
                ${escapeHtml(a.organizingInstitution)} • Date: ${formatDate(a.eventDate)} • Standing: <strong>${escapeHtml(a.participationLevel || 'Completed')}</strong>
              </div>
              <p style="color: var(--text-muted); font-size: 0.84rem; margin: 0 0 10px 0;">${escapeHtml(a.description || 'Verified co-curricular contribution')}</p>
              <div style="font-size: 0.78rem; color: #34d399; display: flex; align-items: center; gap: 6px;">
                <span>🛡️</span> Officially Verified by <strong>${escapeHtml(a.verifiedByName)}</strong> on ${formatDate(a.verifiedAt)}
              </div>
            </div>
            <div style="text-align: right;">
              <a href="${a.verificationUrl}" target="_blank" class="btn btn-secondary btn-sm" style="font-size: 0.78rem; padding: 6px 14px; display: inline-flex; align-items: center; gap: 6px;">
                <span>🔗</span> Verify Credential
              </a>
              <div style="font-size: 0.68rem; color: var(--text-dim); margin-top: 6px; font-family: monospace;">
                Token: ${a.verificationToken ? a.verificationToken.substring(0, 12) : 'AUTH-HASH'}...
              </div>
            </div>
          </div>
        </div>
      `).join('');

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 24px;">
        <div style="background: rgba(15, 23, 42, 0.6); padding: 16px 20px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);">
          <div style="font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase;">Verified Credentials</div>
          <div style="font-size: 1.8rem; font-weight: 800; color: #fff; margin-top: 2px;">${p.summary.totalVerifiedAchievements}</div>
          <div style="font-size: 0.72rem; color: #34d399; margin-top: 2px;">Officially Validated</div>
        </div>
        <div style="background: rgba(15, 23, 42, 0.6); padding: 16px 20px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);">
          <div style="font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase;">Categories Represented</div>
          <div style="font-size: 1.8rem; font-weight: 800; color: #38bdf8; margin-top: 2px;">${p.summary.categoriesRepresented}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">Diverse Portfolio</div>
        </div>
        <div style="background: rgba(15, 23, 42, 0.6); padding: 16px 20px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);">
          <div style="font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase;">Passport Standing</div>
          <div style="font-size: 1.4rem; font-weight: 700; color: #34d399; margin-top: 6px;">PLACEMENT READY</div>
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">Cryptographically Verified</div>
        </div>
      </div>

      <h4 style="color: #fff; font-size: 1rem; margin-bottom: 14px;">Official Verified Credentials Timeline</h4>
      ${itemsHtml}
    `;

  } catch (err) {
    console.warn('[Passport Page Load Error]', err.message);
  }
}

async function openPassportModal() {
  const user = getCurrentUser();
  if (!user || !user.studentId) return;

  const content = document.getElementById('passport-modal-content');
  content.innerHTML = '<div style="text-align: center; padding: 30px;">Loading student achievement passport ledger... ⏳</div>';
  openModal('passport-modal');

  try {
    const res = await apiCall(`/activities/passport/${user.studentId}`, 'GET');
    if (!res.success || !res.passport) {
      content.innerHTML = `<div style="color: #f87171; text-align: center; padding: 20px;">${escapeHtml(res.message || 'Unable to load achievement passport.')}</div>`;
      return;
    }

    const p = res.passport;
    const achievements = p.verifiedAchievements || [];

    const itemsHtml = achievements.length === 0
      ? `<div style="text-align: center; color: var(--text-dim); padding: 30px;">No verified achievements currently recorded in the official ledger. Submit activities and obtain faculty mentor verification to populate your Placement Passport!</div>`
      : achievements.map(a => `
        <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
            <div>
              <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 0.72rem; margin-bottom: 4px; display: inline-block;">${escapeHtml(a.category)}</span>
              <h4 style="margin: 0 0 4px 0; font-size: 1.05rem; color: #fff;">${escapeHtml(a.title)}</h4>
              <div style="color: var(--text-dim); font-size: 0.8rem; margin-bottom: 6px;">
                ${escapeHtml(a.organizingInstitution)} • Date: ${formatDate(a.eventDate)}
              </div>
              <p style="color: var(--text-muted); font-size: 0.82rem; margin: 0 0 8px 0;">${escapeHtml(a.description || 'Verified co-curricular contribution')}</p>
              <div style="font-size: 0.76rem; color: #34d399;">
                🛡️ Verified by ${escapeHtml(a.verifiedByName)} on ${formatDate(a.verifiedAt)}
              </div>
            </div>
            <div style="text-align: right;">
              <a href="${a.verificationUrl}" target="_blank" class="btn btn-secondary btn-sm" style="font-size: 0.76rem; padding: 6px 12px; display: inline-flex; align-items: center; gap: 6px;">
                <span>🔗</span> Public QR Verification
              </a>
              <div style="font-size: 0.68rem; color: var(--text-dim); margin-top: 4px; font-family: monospace;">
                Token: ${a.verificationToken ? a.verificationToken.substring(0, 10) : 'AUTH'}...
              </div>
            </div>
          </div>
        </div>
      `).join('');

    content.innerHTML = `
      <div style="border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 18px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
        <div>
          <span class="kpi-pill pill-blue" style="font-size: 0.72rem; margin-bottom: 4px; display: inline-block;">OFFICIAL PLACEMENT CREDENTIAL</span>
          <h2 style="margin: 0; font-size: 1.4rem; color: #fff;">${escapeHtml(p.student.name)}</h2>
          <div style="font-size: 0.84rem; color: var(--text-muted); margin-top: 2px;">
            ${escapeHtml(p.student.program || p.student.department)} • ${escapeHtml(p.student.institution)}
          </div>
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-primary btn-sm" onclick="window.print()">🖨️ Print / Download Portfolio</button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px;">
        <div style="background: rgba(15, 23, 42, 0.6); padding: 12px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);">
          <div style="font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase;">Verified Credentials</div>
          <div style="font-size: 1.5rem; font-weight: 800; color: #fff; margin-top: 2px;">${p.summary.totalVerifiedAchievements}</div>
        </div>
        <div style="background: rgba(15, 23, 42, 0.6); padding: 12px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);">
          <div style="font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase;">Categories Represented</div>
          <div style="font-size: 1.5rem; font-weight: 800; color: #38bdf8; margin-top: 2px;">${p.summary.categoriesRepresented}</div>
        </div>
      </div>

      <h4 style="color: #fff; font-size: 0.98rem; margin-bottom: 14px;">Verified Co-Curricular & Certification Ledger</h4>
      ${itemsHtml}
    `;

  } catch (err) {
    content.innerHTML = `<div style="color: #f87171; text-align: center; padding: 20px;">${escapeHtml(err.message)}</div>`;
  }
}

/* =========================================================================
   FEATURE 6: ACADEMIC WHAT-IF SCENARIO SIMULATOR (FRONTEND CONTROLLER)
   ========================================================================= */
window.resetSimulatorToBaseline = function() {
  const gpaInput = document.getElementById('sim-target-gpa-input');
  if (gpaInput) gpaInput.value = '8.5';
  const totalInput = document.getElementById('sim-upcoming-total');
  if (totalInput) totalInput.value = '20';
  const attendedInput = document.getElementById('sim-upcoming-attended');
  if (attendedInput) attendedInput.value = '18';

  const gpaRes = document.getElementById('sim-target-gpa-results');
  if (gpaRes) gpaRes.innerHTML = 'Enter a target GPA and click Solve to view required examination marks.';
  const attRes = document.getElementById('sim-attendance-results');
  if (attRes) attRes.innerHTML = 'Click Calculate to project future attendance percentage and safe bunk buffer.';

  loadLeveragePriorities();
  showToast('What-If Simulator reset to current authorized baseline.', 'info');
};

async function runTargetGpaSimulation() {
  const user = getCurrentUser();
  if (!user || !user.studentId) return;

  const targetInput = document.getElementById('sim-target-gpa-input');
  const targetGpa = parseFloat(targetInput?.value || 8.5);
  const container = document.getElementById('sim-target-gpa-results');

  container.innerHTML = '<div style="color: var(--accent-cyan); padding: 8px 0;">Solving required marks via official grading constraints... ⏳</div>';

  try {
    const res = await apiCall('/simulator/target-gpa', 'POST', {
      student_id: user.studentId,
      target_gpa: targetGpa
    });

    if (!res.success) {
      container.innerHTML = `<div style="color: #f87171; padding: 8px 0;">${escapeHtml(res.message)}</div>`;
      return;
    }

    if (!res.isAchievable) {
      container.innerHTML = `
        <div style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; padding: 12px; color: #f87171;">
          <strong>⚠️ Unachievable Target:</strong> ${escapeHtml(res.message)}
          <div style="margin-top: 4px; font-size: 0.76rem; color: var(--text-muted);">${escapeHtml(res.recommendation)}</div>
        </div>
      `;
      return;
    }

    const items = (res.subjectTargets || []).map(s => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.8rem;">
        <span><strong>${escapeHtml(s.subjectName)}</strong> (${s.credits} cr)</span>
        <span style="color: var(--accent-cyan); font-weight: 700;">Need: ${s.requiredExamMarks}/60 in Exam (Total: ${s.projectedTotal} • ${s.projectedGrade})</span>
      </div>
    `).join('');

    container.innerHTML = `
      <div style="background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.25); border-radius: 8px; padding: 12px; margin-top: 8px;">
        <div style="color: #34d399; font-weight: 700; margin-bottom: 6px;">Target GPA ${res.targetGpa.toFixed(2)} is Achievable! (Projected: ${res.projectedGpa.toFixed(2)})</div>
        <div style="color: var(--text-muted); font-size: 0.76rem; margin-bottom: 10px;">${escapeHtml(res.explanation)}</div>
        ${items}
      </div>
    `;

  } catch (err) {
    container.innerHTML = `<div style="color: #f87171; padding: 8px 0;">${escapeHtml(err.message)}</div>`;
  }
}

async function runAttendanceSimulation() {
  const user = getCurrentUser();
  if (!user || !user.studentId) return;

  const totalInput = document.getElementById('sim-upcoming-total');
  const attendedInput = document.getElementById('sim-upcoming-attended');
  const container = document.getElementById('sim-attendance-results');

  const upcomingTotal = parseInt(totalInput?.value || 20, 10);
  const upcomingAttended = parseInt(attendedInput?.value || 18, 10);

  container.innerHTML = '<div style="color: var(--accent-cyan); padding: 8px 0;">Calculating projection... ⏳</div>';

  try {
    const res = await apiCall('/simulator/attendance', 'POST', {
      student_id: user.studentId,
      upcoming_classes_total: upcomingTotal,
      upcoming_classes_attended: upcomingAttended
    });

    if (!res.success) {
      container.innerHTML = `<div style="color: #f87171; padding: 8px 0;">${escapeHtml(res.message)}</div>`;
      return;
    }

    const p = res.projected;
    const isGood = p.percentage >= 75;
    const bannerColor = isGood ? '#34d399' : '#f87171';
    const bgColor = isGood ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)';

    container.innerHTML = `
      <div style="background: ${bgColor}; border: 1px solid ${bannerColor}; border-radius: 8px; padding: 12px; margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <strong style="color: #fff;">Projected Attendance: <span style="color: ${bannerColor}; font-size: 1.15rem;">${p.percentage}%</span></strong>
          <span class="badge" style="background: ${isGood ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}; color: ${bannerColor};">${p.standing}</span>
        </div>
        <div style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.4;">
          ${isGood 
            ? `✅ Safe! You have a buffer of <strong>${p.safeBunksRemaining}</strong> permissible absence(s) before dropping below the mandatory 75% threshold.` 
            : `⚠️ Warning: You need to attend <strong>${p.recoveryClassesNeededFor75}</strong> consecutive classes without absence to restore 75% examination eligibility.`}
        </div>
      </div>
    `;

  } catch (err) {
    container.innerHTML = `<div style="color: #f87171; padding: 8px 0;">${escapeHtml(err.message)}</div>`;
  }
}

async function loadLeveragePriorities() {
  const user = getCurrentUser();
  if (!user || !user.studentId) return;

  const tableBody = document.getElementById('sim-leverage-table-body');
  if (!tableBody) return;

  try {
    const res = await apiCall(`/simulator/leverage-priorities/${user.studentId}`, 'GET');
    if (!res.success || !Array.isArray(res.priorities)) return;

    if (res.priorities.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 18px; color: var(--text-dim);">No enrolled subjects found for leverage analysis.</td></tr>`;
      return;
    }

    tableBody.innerHTML = res.priorities.map((p, idx) => `
      <tr style="${idx === 0 ? 'background: rgba(56, 189, 248, 0.05);' : ''}">
        <td><strong>${escapeHtml(p.subjectName)}</strong></td>
        <td>${p.credits}</td>
        <td>${p.currentMark}/100</td>
        <td><span class="kpi-pill ${p.currentGrade === 'A+' || p.currentGrade === 'A' ? 'pill-green' : p.currentGrade === 'F' ? 'pill-red' : 'pill-yellow'}">${p.currentGrade}</span></td>
        <td style="color: #facc15; font-weight: 700;">${p.marksNeededForNextGrade} mark(s)</td>
        <td style="color: #34d399; font-weight: 600;">+${p.gpaBoostPerGradeJump}</td>
        <td><span class="badge" style="background: rgba(56,189,248,0.15); color: #38bdf8;">${p.leverageScore}</span></td>
        <td style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(p.recommendation)}</td>
      </tr>
    `).join('');

  } catch (err) {
    console.warn('[Leverage Priorities Load Error]', err.message);
  }
}
