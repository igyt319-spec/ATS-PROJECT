// Faculty Mentor Console Controller
let menteesList = [];
let allResults = [];
let currentResultFilter = 'all';
let allInterventions = [];
let allDecisionTraces = [];

const TAB_METADATA = {
  'dashboard': { title: 'Faculty Mentorship & Advisory Console', subtitle: 'Authorized Mentee Group Academic Progress & Approvals' },
  'mentees': { title: 'Mentee Roster & Student Profiles', subtitle: 'Official Scholar Advisory Assignments & Real-Time Academic Records' },
  'leaves': { title: 'Mentee Leave Approvals', subtitle: 'Review and Authorize Student Absence and Duty Leave Applications' },
  'results': { title: 'Mentee Academic Results', subtitle: 'Continuous Assessments (CIA), Lab Practicals, and Semester Examinations' },
  'activities': { title: 'Activity & Achievement Verification', subtitle: 'Inspect Proof Documents, Verify Credentials, and Credit Portfolio Points' },
  'knowledge-graph': { title: 'Academic Knowledge Graph', subtitle: 'Curriculum Prerequisite Architecture & Mentee Performance Tracing' },
  'trajectory-predictor': { title: 'Academic Trajectory Predictor', subtitle: 'Statistical OLS Performance Projections & Explainable Signals' },
  'study-planner': { title: 'Adaptive Study Planner Advisory', subtitle: 'Review Mentee Revision Workloads & Prerequisite Priorities' },
  'skill-evidence': { title: 'Skill Evidence Graph & Verification', subtitle: 'Mentee Industry Competencies & Portfolio Audit' },
  'career-readiness': { title: 'Mentee Career Readiness & Placement Mapping', subtitle: 'Evaluate Graduating Mentee Competency Portfolios & Interview Fit' },
  'interventions': { title: 'Intervention Effectiveness Engine', subtitle: 'Mentee Academic Support Plans, Follow-up Dates & Measured Outcomes' },
  'fees': { title: 'Mentee Fee Obligations & Status', subtitle: 'Institutional Advisory View of Tuition Dues and Payment Verifications' },
  'risk-radar': { title: 'Academic Risk Radar', subtitle: 'Proactive Early-Warning Detection for Low Attendance and Assessment Deficits' },
  'impact-loop': { title: 'ATS Impact Loop — Intervention Tracking', subtitle: 'Assigned Support Plans, Follow-up Dates, and Measured Learning Outcomes' },
  'decision-trace': { title: 'Academic Decision Trace', subtitle: 'Explainable Rule Heuristics, Policy Thresholds, and Mentor Actions' }
};

document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth('mentor');
  if (!user) return;

  initLayout();

  // Route query param handler (?view=...)
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('view') || 'dashboard';
  switchFacultyTab(initialTab, false);

  window.addEventListener('popstate', (e) => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view') || 'dashboard';
    switchFacultyTab(view, false);
  });

  await loadAllMentorData();

  // Attach modal close handlers
  document.querySelectorAll('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
    });
  });

  // Leave Form Submit
  const leaveForm = document.getElementById('leave-decision-form');
  if (leaveForm) {
    leaveForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('leave-decision-id').value;
      const status = document.getElementById('leave-decision-status').value;
      const remarks = document.getElementById('leave-decision-remarks').value.trim();
      const btn = document.getElementById('btn-submit-leave');

      btn.disabled = true;
      btn.textContent = 'Submitting... ⏳';

      try {
        const res = await apiCall(`/leave/${id}/decision`, 'PUT', { status, remarks });
        showToast(res.message, 'success');
        closeModal('leave-modal');
        await loadLeaves();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Confirm Decision';
      }
    });
  }

  // Activity Form Submit
  const actForm = document.getElementById('activity-decision-form');
  if (actForm) {
    actForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('activity-decision-id').value;
      const status = document.getElementById('activity-decision-status').value;
      const remarks = document.getElementById('activity-decision-remarks').value.trim();
      const btn = document.getElementById('btn-submit-activity');

      btn.disabled = true;
      btn.textContent = 'Updating... ⏳';

      try {
        const res = await apiCall(`/activities/${id}/verify`, 'PUT', { status, remarks });
        showToast(res.message, 'success');
        closeModal('activity-modal');
        await loadActivities();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Update Status';
      }
    });
  }

  // Exam / Lab Upload Form Submit
  const examLabForm = document.getElementById('exam-lab-upload-form');
  if (examLabForm) {
    examLabForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const studentId = parseInt(document.getElementById('exam-lab-student-id').value, 10);
      const assessmentType = document.getElementById('exam-lab-type').value;
      const academicYear = document.getElementById('exam-lab-academic-year').value.trim() || '2026-2027';
      const assessmentName = document.getElementById('exam-lab-name').value.trim();
      const subjectText = document.getElementById('exam-lab-subject').value.trim();
      const marksObtained = parseFloat(document.getElementById('exam-lab-marks').value);
      const maxMarks = parseFloat(document.getElementById('exam-lab-max-marks').value);
      const isPublished = document.getElementById('exam-lab-publish').checked ? 1 : 0;
      const btn = document.getElementById('btn-submit-exam-lab');

      if (isNaN(marksObtained) || marksObtained < 0) {
        showToast('Marks obtained must be a non-negative number.', 'error');
        return;
      }
      if (isNaN(maxMarks) || maxMarks <= 0) {
        showToast('Maximum marks must be greater than zero.', 'error');
        return;
      }
      if (marksObtained > maxMarks) {
        showToast(`Marks obtained (${marksObtained}) cannot exceed Maximum marks (${maxMarks}).`, 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Recording & Publishing... ⏳';

      try {
        const payload = {
          student_id: studentId,
          assessment_type: assessmentType,
          assessment_name: assessmentName,
          subject_name: subjectText,
          marks_obtained: marksObtained,
          max_marks: maxMarks,
          academic_year: academicYear,
          is_published: isPublished
        };

        const res = await apiCall('/results', 'POST', payload);
        showToast(res.message || 'Academic assessment record created successfully!', 'success');
        closeModal('exam-lab-upload-modal');
        examLabForm.reset();

        await Promise.all([loadMentees(), loadResults()]);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '💾 Record & Publish';
      }
    });
  }

  // Create Intervention Form Submit
  const intForm = document.getElementById('create-intervention-form');
  if (intForm) {
    intForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const studentId = parseInt(document.getElementById('int-student-select').value, 10);
      const interventionType = document.getElementById('int-type').value;
      const title = document.getElementById('int-title').value.trim();
      const targetDate = document.getElementById('int-target-date').value;
      const actionPlan = document.getElementById('int-action-plan').value.trim();
      const studentNotes = document.getElementById('int-student-notes').value.trim();
      const privateNotes = document.getElementById('int-private-notes').value.trim();
      const btn = document.getElementById('btn-submit-intervention');

      if (!studentId) {
        showToast('Please select a mentee.', 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Assigning... ⏳';

      try {
        const res = await apiCall('/impact-loop/interventions', 'POST', {
          student_id: studentId,
          intervention_type: interventionType,
          title,
          target_date: targetDate,
          action_plan: actionPlan,
          student_guidance_notes: studentNotes,
          private_mentor_notes: privateNotes
        });

        showToast(res.message || 'Intervention created successfully!', 'success');
        closeModal('create-intervention-modal');
        intForm.reset();
        await loadImpactLoop();
        await loadDecisionTraces();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '🚀 Assign Intervention';
      }
    });
  }

  // Update Intervention Form Submit
  const updateIntForm = document.getElementById('update-intervention-form');
  if (updateIntForm) {
    updateIntForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('update-int-id').value;
      const status = document.getElementById('update-int-status').value;
      const outcomeAssessment = document.getElementById('update-int-assessment').value;
      const notes = document.getElementById('update-int-notes').value.trim();
      const btn = document.getElementById('btn-save-update-int');

      btn.disabled = true;
      btn.textContent = 'Saving... ⏳';

      try {
        const res = await apiCall(`/impact-loop/interventions/${id}`, 'PUT', {
          status,
          outcome_assessment: outcomeAssessment,
          outcome_notes: notes
        });

        showToast(res.message || 'Intervention outcome updated.', 'success');
        closeModal('update-intervention-modal');
        await loadImpactLoop();
        await loadDecisionTraces();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Save Outcome Evaluation';
      }
    });
  }

  // Decision Trace Review Form Submit
  const traceForm = document.getElementById('decision-trace-review-form');
  if (traceForm) {
    traceForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('trace-review-id').value;
      const status = document.getElementById('trace-review-status').value;
      const action = document.getElementById('trace-review-action').value.trim();
      const btn = document.getElementById('btn-submit-trace-review');

      btn.disabled = true;
      btn.textContent = 'Saving... ⏳';

      try {
        const res = await apiCall(`/decision-trace/${id}/decision`, 'PUT', {
          decision_status: status,
          reviewer_action: action
        });

        showToast(res.message || 'Decision trace recorded.', 'success');
        closeModal('decision-trace-modal');
        await loadDecisionTraces();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Confirm Decision';
      }
    });
  }
});

// View switcher with dedicated container display & URL query param
function switchFacultyTab(tabName, pushState = true) {
  const user = getCurrentUser();
  const isOrdinaryFaculty = (user && (user.canMentor === false || user.facultyRole === 'faculty'));
  const mentorOnlyTabs = ['mentees', 'leaves', 'activities', 'fees'];

  let targetTab = tabName;
  const RESTRICTED_STUDENT_MODULES = [
    'risk-overview', 'knowledge-graph', 'trajectory-predictor',
    'study-planner', 'skill-evidence', 'interventions'
  ];
  if (RESTRICTED_STUDENT_MODULES.includes(targetTab)) {
    if (typeof showToast === 'function') {
      showToast('This advanced module is reserved for the Student Console.', 'info');
    }
    targetTab = 'dashboard';
  }

  if (isOrdinaryFaculty && mentorOnlyTabs.includes(targetTab)) {
    showToast('This module requires active Faculty Mentor authorization.', 'info');
    targetTab = 'dashboard';
  }

  const validTabs = [
    'dashboard', 'mentees', 'leaves', 'results', 'activities',
    'career-readiness', 'fees', 'risk-radar', 'impact-loop', 'decision-trace'
  ];
  const activeTab = validTabs.includes(targetTab) ? targetTab : 'dashboard';

  // Update sidebar active classes
  validTabs.forEach(t => {
    const nav = document.getElementById(`nav-${t}`);
    if (nav) {
      if (t === activeTab) nav.classList.add('active');
      else nav.classList.remove('active');
    }
  });

  // Switch content view containers: display ONLY active view
  validTabs.forEach(t => {
    const viewEl = document.getElementById(`view-${t}`);
    if (viewEl) {
      if (t === activeTab) {
        viewEl.classList.add('active');
      } else {
        viewEl.classList.remove('active');
      }
    }
  });

  // Trigger Advanced Modules
  if (window.AdvancedModules) {
    const activeStudentId = menteesList[0]?.id || 1;
    if (activeTab === 'knowledge-graph') {
      AdvancedModules.initKnowledgeGraph(document.getElementById('view-knowledge-graph'), activeStudentId);
    } else if (activeTab === 'trajectory-predictor') {
      AdvancedModules.initTrajectoryPredictor(document.getElementById('view-trajectory-predictor'), activeStudentId);
    } else if (activeTab === 'study-planner') {
      AdvancedModules.initStudyPlanner(document.getElementById('view-study-planner'), activeStudentId);
    } else if (activeTab === 'skill-evidence') {
      AdvancedModules.initSkillEvidence(document.getElementById('view-skill-evidence'), activeStudentId);
    } else if (activeTab === 'interventions') {
      const target = document.getElementById('view-interventions');
      const impactView = document.getElementById('view-impact-loop');
      if (target && impactView) {
        target.innerHTML = impactView.innerHTML;
        loadInterventions();
      }
    }
  }

  // Update topbar headers
  const meta = TAB_METADATA[activeTab] || TAB_METADATA['dashboard'];
  const titleEl = document.getElementById('page-view-title');
  const subtitleEl = document.getElementById('page-view-subtitle');
  if (titleEl) {
    if (isOrdinaryFaculty && activeTab === 'dashboard') {
      titleEl.textContent = 'Faculty Instructional & Academic Console';
    } else {
      titleEl.textContent = meta.title;
    }
  }
  if (subtitleEl) {
    if (isOrdinaryFaculty && activeTab === 'dashboard') {
      subtitleEl.textContent = 'Department Course Assessments, Performance Analysis & Learning Interventions';
    } else {
      subtitleEl.textContent = meta.subtitle;
    }
  }

  // Sync URL query without page reload
  if (pushState) {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('view', activeTab);
    history.pushState({ view: activeTab }, '', newUrl.toString());
  }

  // Close mobile drawer if open
  const sidebar = document.getElementById('app-sidebar');
  if (sidebar) sidebar.classList.remove('open');

  window.scrollTo({ top: 0, behavior: 'instant' });
}

function toggleSidebarDrawer() {
  const sidebar = document.getElementById('app-sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}

// Master Data Loader
async function loadAllMentorData() {
  const user = getCurrentUser();
  const isOrdinaryFaculty = (user && (user.canMentor === false || user.facultyRole === 'faculty'));

  if (isOrdinaryFaculty) {
    // Hide mentor-specific KPI cards and advisory queue
    const kpiGrid = document.querySelector('.kpi-grid');
    if (kpiGrid) kpiGrid.style.display = 'none';

    const priorityRadar = document.querySelector('.table-container')?.closest('.glass-card');
    if (priorityRadar) priorityRadar.style.display = 'none';

    await Promise.all([
      loadResults(),
      loadImpactLoop(),
      loadDecisionTraces()
    ]);
  } else {
    await Promise.all([
      loadMentees(),
      loadLeaves(),
      loadActivities(),
      loadResults(),
      loadFees(),
      loadImpactLoop(),
      loadDecisionTraces()
    ]);
  }
}

// Load Assigned Mentees
async function loadMentees() {
  try {
    const res = await apiCall('/mentors/my-mentees');
    menteesList = res.data || [];

    // Update KPI card
    const kpiEl = document.getElementById('kpi-mentee-count');
    if (kpiEl) kpiEl.textContent = menteesList.length;

    // Populate student select for intervention modal
    const studentSelect = document.getElementById('int-student-select');
    if (studentSelect) {
      studentSelect.innerHTML = '<option value="">-- Choose Assigned Mentee --</option>' +
        menteesList.map(m => `<option value="${m.student_id}">${escapeHtml(m.student_name)} (${m.register_number}) — CGPA: ${Number(m.cgpa || 0).toFixed(2)}</option>`).join('');
    }

    renderMenteesTable(menteesList);
    renderPriorityRadar(menteesList);
    renderRiskRadarTable(menteesList);
  } catch (err) {
    console.error('[Load Mentees Error]', err);
    document.getElementById('mentees-table-body').innerHTML = `
      <tr><td colspan="9" style="text-align: center; color: #f87171; padding: 24px;">Failed to load mentees: ${err.message}</td></tr>
    `;
  }
}

// Render Mentee Directory
function renderMenteesTable(list) {
  const tbody = document.getElementById('mentees-table-body');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="9" style="text-align: center; padding: 32px; color: var(--text-dim);">No mentees currently assigned to your advisory cohort.</td></tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(m => {
    const cgpa = Number(m.cgpa || 0);
    const att = Number(m.attendance_percentage || 0);
    const risk = m.risk_level || (att < 75 || cgpa < 6.0 ? 'HIGH' : (att < 85 || cgpa < 7.5 ? 'MEDIUM' : 'LOW'));
    const riskBadge = risk === 'HIGH'
      ? '<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3);">HIGH RISK</span>'
      : (risk === 'MEDIUM' 
          ? '<span class="badge" style="background: rgba(251, 191, 36, 0.15); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.3);">MONITOR</span>'
          : '<span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);">GOOD</span>');

    const pendingLeaves = Number(m.pending_leaves || 0);
    const pendingActs = Number(m.pending_activities || 0);
    const pendingTasks = [];
    if (pendingLeaves > 0) pendingTasks.push(`${pendingLeaves} Leave${pendingLeaves > 1 ? 's' : ''}`);
    if (pendingActs > 0) pendingTasks.push(`${pendingActs} Act${pendingActs > 1 ? 's' : ''}`);
    const pendingHtml = pendingTasks.length > 0 
      ? `<span style="color: #fbbf24; font-weight: 600;">${pendingTasks.join(', ')}</span>`
      : '<span style="color: var(--text-dim);">All Clear</span>';

    const feeDues = Number(m.outstanding_fee || 0);
    const feeHtml = feeDues > 0 
      ? `<span style="color: #f87171; font-weight: 600;">₹${feeDues.toLocaleString('en-IN')}</span>`
      : '<span style="color: #10b981; font-weight: 600;">Paid</span>';

    const avatarUrl = m.avatar || getInitialsAvatar(m.student_name, 36);

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${avatarUrl}" alt="Avatar" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-color);" onerror="this.src=getInitialsAvatar('${escapeHtml(m.student_name)}', 34)">
            <div>
              <div style="font-weight: 600; color: #fff;">${escapeHtml(m.student_name)}</div>
              <div style="font-size: 0.72rem; color: var(--text-dim);">${escapeHtml(m.email)}</div>
            </div>
          </div>
        </td>
        <td><code>${escapeHtml(m.register_number)}</code></td>
        <td>${escapeHtml(m.department_name || 'Dept')} • Yr ${m.year}</td>
        <td><strong>${cgpa.toFixed(2)}</strong></td>
        <td>
          <span style="font-weight: 600; color: ${att >= 85 ? '#10b981' : (att >= 75 ? '#fbbf24' : '#f87171')};">
            ${att.toFixed(1)}%
          </span>
        </td>
        <td>${riskBadge}</td>
        <td>${pendingHtml}</td>
        <td>${feeHtml}</td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary btn-sm" title="Record CIA Marks" onclick="openExamLabModal(${m.student_id}, '${escapeHtml(m.student_name)}')">📝 Marks</button>
            <button class="btn btn-primary btn-sm" title="Create Support Intervention" onclick="openDirectInterventionModal(${m.student_id})">🔄 Support</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Render Priority Radar on Dashboard View
function renderPriorityRadar(list) {
  const tbody = document.getElementById('dashboard-priority-tbody');
  if (!tbody) return;

  const priorityList = list.filter(m => {
    const att = Number(m.attendance_percentage || 0);
    const cgpa = Number(m.cgpa || 0);
    return att < 75 || cgpa < 6.5 || Number(m.pending_leaves || 0) > 0 || Number(m.pending_activities || 0) > 0;
  });

  if (priorityList.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="5" style="text-align: center; padding: 20px; color: #10b981;">🎉 All assigned mentees are in good academic standing. No urgent flags.</td></tr>
    `;
    return;
  }

  tbody.innerHTML = priorityList.slice(0, 5).map(m => {
    const att = Number(m.attendance_percentage || 0);
    const cgpa = Number(m.cgpa || 0);
    let reason = '';
    if (att < 75) reason += `Att Deficit (${att.toFixed(1)}%) `;
    if (cgpa < 6.0) reason += `GPA Deficit (${cgpa.toFixed(2)}) `;
    if (Number(m.pending_leaves || 0) > 0) reason += `Pending Leave `;
    if (Number(m.pending_activities || 0) > 0) reason += `Pending Activity `;

    return `
      <tr>
        <td><strong>${escapeHtml(m.student_name)}</strong><br><small style="color: var(--text-dim);">${escapeHtml(m.register_number)}</small></td>
        <td><span style="color: ${att < 75 ? '#f87171' : '#fbbf24'}; font-weight: 600;">${att.toFixed(1)}%</span></td>
        <td><strong>${cgpa.toFixed(2)}</strong></td>
        <td><span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); font-size: 0.7rem;">${reason}</span></td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="openDirectInterventionModal(${m.student_id})">Intervene</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Render Dedicated Academic Risk Radar View
function renderRiskRadarTable(list) {
  const tbody = document.getElementById('risk-radar-table-body');
  if (!tbody) return;

  const atRisk = list.filter(m => {
    const att = Number(m.attendance_percentage || 0);
    const cgpa = Number(m.cgpa || 0);
    return att < 85 || cgpa < 7.0;
  });

  if (atRisk.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="8" style="text-align: center; padding: 32px; color: #10b981;">No mentees currently meet the threshold for academic risk. All mentees compliant.</td></tr>
    `;
    return;
  }

  tbody.innerHTML = atRisk.map(m => {
    const att = Number(m.attendance_percentage || 0);
    const cgpa = Number(m.cgpa || 0);
    const isCritical = att < 75 || cgpa < 6.0;
    const standingBadge = isCritical 
      ? '<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); font-weight: 700;">CRITICAL RISK</span>'
      : '<span class="badge" style="background: rgba(251, 191, 36, 0.15); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.3); font-weight: 600;">MODERATE MONITOR</span>';

    const factor = att < 75 ? 'Breaches 75% exam threshold' : (cgpa < 6.0 ? 'CGPA below 6.0 standing' : 'Attendance in 75-84% danger band');
    const actionRec = att < 75 ? 'Attendance recovery plan + compensatory lectures' : 'Remedial problem-solving clinic + study schedule';

    return `
      <tr>
        <td><strong>${escapeHtml(m.student_name)}</strong></td>
        <td><code>${escapeHtml(m.register_number)}</code></td>
        <td><span style="color: ${att < 75 ? '#f87171' : '#fbbf24'}; font-weight: 700;">${att.toFixed(1)}%</span></td>
        <td><strong>${cgpa.toFixed(2)}</strong></td>
        <td>${standingBadge}</td>
        <td><small style="color: var(--text-muted);">${factor}</small></td>
        <td><span style="color: var(--accent-cyan); font-size: 0.8rem;">${actionRec}</span></td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="openDirectInterventionModal(${m.student_id})">➕ Assign Plan</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Load Leaves
async function loadLeaves() {
  try {
    const res = await apiCall('/leave/mentor-requests');
    const leaves = res.data || [];

    const pendingCount = leaves.filter(l => l.status === 'Pending').length;
    const kpiEl = document.getElementById('kpi-pending-leaves');
    if (kpiEl) kpiEl.textContent = pendingCount;

    const tbody = document.getElementById('leaves-table-body');
    if (!tbody) return;

    if (leaves.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-dim);">No leave applications submitted by your mentees.</td></tr>`;
      return;
    }

    tbody.innerHTML = leaves.map(l => {
      const statusBadge = l.status === 'Approved'
        ? '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">Approved</span>'
        : (l.status === 'Rejected'
            ? '<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3);">Rejected</span>'
            : '<span class="badge" style="background: rgba(251, 191, 36, 0.15); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.3);">Pending</span>');

      const actionBtn = l.status === 'Pending'
        ? `<button class="btn btn-primary btn-sm" onclick="openLeaveModal(${l.id}, '${escapeHtml(l.student_name)}', '${escapeHtml(l.leave_type)}', '${l.start_date}', '${l.end_date}')">Review</button>`
        : '<span style="color: var(--text-dim); font-size: 0.8rem;">Decided</span>';

      return `
        <tr>
          <td><strong>${escapeHtml(l.student_name)}</strong><br><small style="color: var(--text-dim);">${escapeHtml(l.register_number)}</small></td>
          <td>${escapeHtml(l.leave_type)}</td>
          <td>${formatDate(l.start_date)} to ${formatDate(l.end_date)}</td>
          <td>${escapeHtml(l.reason)}</td>
          <td>${statusBadge}</td>
          <td><small style="color: var(--text-dim);">${escapeHtml(l.remarks || '—')}</small></td>
          <td>${actionBtn}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('[Load Leaves Error]', err);
    document.getElementById('leaves-table-body').innerHTML = `<tr><td colspan="7" style="text-align: center; color: #f87171;">Failed to load leaves: ${err.message}</td></tr>`;
  }
}

// Load Activities
async function loadActivities() {
  try {
    const res = await apiCall('/activities/mentor-pending');
    const activities = res.data || [];

    const pendingCount = activities.filter(a => a.status === 'Pending').length;
    const kpiEl = document.getElementById('kpi-pending-activities');
    if (kpiEl) kpiEl.textContent = pendingCount;

    const tbody = document.getElementById('activities-table-body');
    if (!tbody) return;

    if (activities.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-dim);">No co-curricular activity submissions pending verification.</td></tr>`;
      return;
    }

    tbody.innerHTML = activities.map(a => {
      const statusBadge = a.status === 'Verified'
        ? '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">Verified</span>'
        : (a.status === 'Rejected'
            ? '<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3);">Rejected</span>'
            : '<span class="badge" style="background: rgba(251, 191, 36, 0.15); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.3);">Pending</span>');

      const actionBtn = a.status === 'Pending'
        ? `<button class="btn btn-primary btn-sm" onclick="openActivityModal(${a.id}, '${escapeHtml(a.student_name)}', '${escapeHtml(a.title)}', '${escapeHtml(a.category)}')">Verify Proof</button>`
        : '<span style="color: var(--text-dim); font-size: 0.8rem;">Decided</span>';

      return `
        <tr>
          <td><strong>${escapeHtml(a.student_name)}</strong><br><small style="color: var(--text-dim);">${escapeHtml(a.register_number)}</small></td>
          <td><span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #818cf8;">${escapeHtml(a.category)}</span></td>
          <td>${escapeHtml(a.title)}<br><small style="color: var(--text-dim);">${escapeHtml(a.organization_or_issuer || 'Self-Reported')}</small></td>
          <td>${formatDate(a.event_date)}</td>
          <td>${escapeHtml(a.participation_type || 'Participant')}</td>
          <td>${statusBadge}</td>
          <td>${actionBtn}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('[Load Activities Error]', err);
    document.getElementById('activities-table-body').innerHTML = `<tr><td colspan="7" style="text-align: center; color: #f87171;">Failed to load activities: ${err.message}</td></tr>`;
  }
}

// Load Results
async function loadResults() {
  try {
    const res = await apiCall('/results/mentor-mentees');
    allResults = res.data || [];
    renderResultsTable(allResults);
  } catch (err) {
    console.error('[Load Results Error]', err);
    document.getElementById('results-table-body').innerHTML = `<tr><td colspan="9" style="text-align: center; color: #f87171;">Failed to load results: ${err.message}</td></tr>`;
  }
}

function filterResultsType(type) {
  currentResultFilter = type;
  document.querySelectorAll('#results-filter-pills .tab-pill').forEach(btn => {
    if (btn.textContent.toLowerCase().includes(type) || (type === 'all' && btn.textContent.includes('All'))) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (type === 'all') {
    renderResultsTable(allResults);
  } else {
    renderResultsTable(allResults.filter(r => r.assessment_type === type));
  }
}

function renderResultsTable(list) {
  const tbody = document.getElementById('results-table-body');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 24px; color: var(--text-dim);">No academic assessment records found for this filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(r => {
    const typeLabel = r.assessment_type === 'internal' ? 'CIA Exam' : (r.assessment_type === 'lab' ? 'Lab Practical' : 'End Semester');
    const marksPct = (Number(r.marks_obtained) / Number(r.max_marks)) * 100;
    const grade = r.grade || (marksPct >= 90 ? 'O' : marksPct >= 80 ? 'A+' : marksPct >= 70 ? 'A' : marksPct >= 60 ? 'B+' : marksPct >= 50 ? 'B' : 'U');

    return `
      <tr>
        <td><strong>${escapeHtml(r.student_name)}</strong><br><small style="color: var(--text-dim);">${escapeHtml(r.register_number)}</small></td>
        <td><span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8;">${typeLabel}</span></td>
        <td>${escapeHtml(r.subject_name || 'Subject')}</td>
        <td>${escapeHtml(r.assessment_name || 'Assessment')}</td>
        <td><strong>${Number(r.marks_obtained).toFixed(1)}</strong></td>
        <td>${Number(r.max_marks).toFixed(1)}</td>
        <td><strong>${grade}</strong></td>
        <td><span style="color: ${marksPct >= 60 ? '#10b981' : '#f87171'}; font-weight: 600;">${marksPct >= 60 ? 'Cleared' : 'Deficit'}</span></td>
        <td>${r.is_published ? '✅ Yes' : '⏳ Draft'}</td>
      </tr>
    `;
  }).join('');
}

// Load Fees
async function loadFees() {
  try {
    const res = await apiCall('/fees/mentor-overview');
    const feeRecords = res.data || [];

    const feeAlerts = feeRecords.filter(f => f.status === 'Pending' || f.status === 'Overdue' || Number(f.balance_amount) > 0).length;
    const kpiEl = document.getElementById('kpi-fee-alerts');
    if (kpiEl) kpiEl.textContent = feeAlerts;

    const tbody = document.getElementById('fees-table-body');
    if (!tbody) return;

    if (feeRecords.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: var(--text-dim);">No fee obligation records found for assigned mentees.</td></tr>`;
      return;
    }

    tbody.innerHTML = feeRecords.map(f => {
      const bal = Number(f.balance_amount || 0);
      const statusBadge = f.status === 'Paid'
        ? '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">Paid</span>'
        : (bal > 0 ? '<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171;">Due Pending</span>' : '<span class="badge">Clear</span>');

      return `
        <tr>
          <td><strong>${escapeHtml(f.student_name)}</strong><br><small style="color: var(--text-dim);">${escapeHtml(f.register_number)}</small></td>
          <td>${escapeHtml(f.fee_category)}</td>
          <td>${escapeHtml(f.academic_year)} (${escapeHtml(f.semester)})</td>
          <td>₹${Number(f.total_amount).toLocaleString('en-IN')}</td>
          <td><span style="color: #10b981; font-weight: 600;">₹${Number(f.paid_amount).toLocaleString('en-IN')}</span></td>
          <td><span style="color: ${bal > 0 ? '#f87171' : '#10b981'}; font-weight: 700;">₹${bal.toLocaleString('en-IN')}</span></td>
          <td>${statusBadge}</td>
          <td>${formatDate(f.due_date)}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('[Mentor Load Fees Error]', err);
    document.getElementById('fees-table-body').innerHTML = `<tr><td colspan="8" style="text-align: center; color: #f87171;">Failed to load fees: ${err.message}</td></tr>`;
  }
}

// =====================================================================
// ATS IMPACT LOOP (Phase 3)
// =====================================================================
async function loadImpactLoop() {
  try {
    const res = await apiCall('/impact-loop');
    allInterventions = res.data || [];
    const summary = res.summary || {};

    const totalEl = document.getElementById('impact-kpi-total');
    const activeEl = document.getElementById('impact-kpi-active');
    const completedEl = document.getElementById('impact-kpi-completed');
    const rateEl = document.getElementById('impact-kpi-rate');

    if (totalEl) totalEl.textContent = summary.total || 0;
    if (activeEl) activeEl.textContent = summary.active || 0;
    if (completedEl) completedEl.textContent = summary.completed || 0;
    if (rateEl) rateEl.textContent = `${summary.successRate || 0}%`;

    renderImpactLoopTable(allInterventions);
  } catch (err) {
    console.error('[Load Impact Loop Error]', err);
    const tbody = document.getElementById('impact-loop-table-body');
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #f87171;">Failed to load impact loop: ${err.message}</td></tr>`;
  }
}

function renderImpactLoopTable(list) {
  const tbody = document.getElementById('impact-loop-table-body');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 32px; color: var(--text-dim);">No active academic interventions recorded. Click "Assign New Intervention" to create one.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(item => {
    let statusClass = 'badge-assigned';
    if (item.status === 'In Progress') statusClass = 'badge-in-progress';
    else if (item.status === 'Completed' || item.status === 'Closed') statusClass = 'badge-completed';
    else if (item.status === 'Follow-up Due') statusClass = 'badge-follow-up';

    const baselineStr = `Att: ${Number(item.baseline_attendance || 0).toFixed(1)}% | GPA: ${Number(item.baseline_gpa || 0).toFixed(2)}`;
    
    let outcomeStr = '— (Pending completion)';
    if (item.outcome_attendance !== null || item.outcome_gpa !== null) {
      const attDelta = Number(item.outcome_attendance || 0) - Number(item.baseline_attendance || 0);
      const gpaDelta = Number(item.outcome_gpa || 0) - Number(item.baseline_gpa || 0);
      const attPill = attDelta >= 0 
        ? `<span class="delta-pill positive">+${attDelta.toFixed(1)}%</span>`
        : `<span class="delta-pill negative">${attDelta.toFixed(1)}%</span>`;
      const gpaPill = gpaDelta >= 0
        ? `<span class="delta-pill positive">+${gpaDelta.toFixed(2)}</span>`
        : `<span class="delta-pill negative">${gpaDelta.toFixed(2)}</span>`;
      outcomeStr = `Att: ${Number(item.outcome_attendance).toFixed(1)}% ${attPill} <br>GPA: ${Number(item.outcome_gpa).toFixed(2)} ${gpaPill}`;
    }

    const assessmentBadge = item.outcome_assessment.includes('Significant')
      ? `<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #10b981; font-weight: 700;">${item.outcome_assessment}</span>`
      : (item.outcome_assessment.includes('Moderate')
          ? `<span class="badge" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8;">${item.outcome_assessment}</span>`
          : (item.outcome_assessment.includes('Limited')
              ? `<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171;">${item.outcome_assessment}</span>`
              : `<span class="badge" style="color: var(--text-dim);">${item.outcome_assessment}</span>`));

    return `
      <tr>
        <td><strong>${escapeHtml(item.student_name)}</strong><br><small style="color: var(--text-dim);">${escapeHtml(item.register_number)}</small></td>
        <td>
          <span class="badge" style="background: rgba(124, 156, 255, 0.15); color: #7C9CFF;">${escapeHtml(item.intervention_type)}</span>
          <div style="font-weight: 600; font-size: 0.85rem; margin-top: 3px;">${escapeHtml(item.title)}</div>
        </td>
        <td><small style="color: var(--text-muted); line-height: 1.4;">${escapeHtml(item.action_plan)}</small></td>
        <td><small>${baselineStr}</small></td>
        <td><small>${outcomeStr}</small></td>
        <td>${assessmentBadge}</td>
        <td><span class="badge ${statusClass}">${escapeHtml(item.status)}</span></td>
        <td>${formatDate(item.target_date || item.follow_up_date)}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="openUpdateInterventionModal(${item.id})">Update Outcome</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openNewInterventionModal() {
  const modal = document.getElementById('create-intervention-modal');
  if (modal) {
    document.getElementById('int-target-date').value = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    openModal('create-intervention-modal');
  }
}

function openDirectInterventionModal(studentId) {
  openNewInterventionModal();
  const sel = document.getElementById('int-student-select');
  if (sel) sel.value = String(studentId);
}

function openUpdateInterventionModal(id) {
  const item = allInterventions.find(i => i.id === id);
  if (!item) return;

  document.getElementById('update-int-id').value = id;
  document.getElementById('update-int-status').value = item.status === 'Assigned' ? 'In Progress' : item.status;
  document.getElementById('update-int-assessment').value = item.outcome_assessment || 'Pending Evaluation';
  document.getElementById('update-int-notes').value = item.private_mentor_notes || '';
  document.getElementById('update-int-info').innerHTML = `
    <strong>Student:</strong> ${escapeHtml(item.student_name)} (${escapeHtml(item.register_number)})<br>
    <strong>Intervention:</strong> ${escapeHtml(item.title)} (${escapeHtml(item.intervention_type)})<br>
    <strong>Baseline:</strong> Att: ${Number(item.baseline_attendance || 0).toFixed(1)}% | GPA: ${Number(item.baseline_gpa || 0).toFixed(2)}
  `;

  openModal('update-intervention-modal');
}

// =====================================================================
// ACADEMIC DECISION TRACE (Phase 4)
// =====================================================================
async function loadDecisionTraces() {
  try {
    const res = await apiCall('/decision-trace');
    allDecisionTraces = res.data || [];
    renderDecisionTracesTable(allDecisionTraces);
  } catch (err) {
    console.error('[Load Decision Traces Error]', err);
    const tbody = document.getElementById('decision-trace-table-body');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #f87171;">Failed to load decision traces: ${err.message}</td></tr>`;
  }
}

function renderDecisionTracesTable(list) {
  const tbody = document.getElementById('decision-trace-table-body');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 32px; color: var(--text-dim);">No decision traces recorded yet. Traces populate automatically when academic risk thresholds trigger.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(t => {
    const statusBadge = t.decision_status === 'Accepted'
      ? '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">Accepted</span>'
      : (t.decision_status === 'Action Taken'
          ? '<span class="badge" style="background: rgba(124, 156, 255, 0.15); color: #7C9CFF; font-weight: 700;">Action Taken</span>'
          : (t.decision_status === 'Dismissed'
              ? '<span class="badge" style="background: rgba(115, 125, 140, 0.15); color: #9BA4B1;">Dismissed</span>'
              : '<span class="badge" style="background: rgba(251, 191, 36, 0.15); color: #fbbf24;">Pending Review</span>'));

    return `
      <tr>
        <td><strong>${escapeHtml(t.student_name)}</strong><br><small style="color: var(--text-dim);">${escapeHtml(t.register_number)}</small></td>
        <td><span class="badge" style="background: rgba(103, 213, 192, 0.15); color: #67D5C0;">${escapeHtml(t.indicator_type)}</span></td>
        <td>
          <div style="font-weight: 600; color: #f87171;">${escapeHtml(t.observed_value)}</div>
          <small style="color: var(--text-dim);">Rule: ${escapeHtml(t.threshold_applied)}</small>
        </td>
        <td>
          <div style="font-size: 0.82rem; color: #fff;">${escapeHtml(t.trigger_condition)}</div>
          <div class="rule-evidence-box">${escapeHtml(t.explanation)}</div>
        </td>
        <td><span style="color: var(--accent-cyan); font-weight: 500;">${escapeHtml(t.recommended_action)}</span></td>
        <td>${statusBadge}</td>
        <td><small style="color: var(--text-muted);">${escapeHtml(t.reviewer_action || t.follow_up_result || 'Awaiting mentor decision')}</small></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="openDecisionTraceReviewModal(${t.id})">Review Decision</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openDecisionTraceReviewModal(id) {
  const trace = allDecisionTraces.find(t => t.id === id);
  if (!trace) return;

  document.getElementById('trace-review-id').value = id;
  document.getElementById('trace-review-status').value = trace.decision_status === 'Pending Review' ? 'Accepted' : trace.decision_status;
  document.getElementById('trace-review-action').value = trace.reviewer_action || '';
  document.getElementById('decision-trace-modal-info').innerHTML = `
    <strong>Scholar:</strong> ${escapeHtml(trace.student_name)} (${escapeHtml(trace.register_number)})<br>
    <strong>Observed Deficit:</strong> ${escapeHtml(trace.observed_value)} against policy: <em>${escapeHtml(trace.threshold_applied)}</em><br>
    <strong>Recommended Action:</strong> ${escapeHtml(trace.recommended_action)}
  `;

  openModal('decision-trace-modal');
}

// Modals Helper Handlers
function openLeaveModal(id, studentName, type, start, end) {
  document.getElementById('leave-decision-id').value = id;
  document.getElementById('leave-modal-info').innerHTML = `
    <strong>Student:</strong> ${escapeHtml(studentName)}<br>
    <strong>Request:</strong> ${escapeHtml(type)} from ${formatDate(start)} to ${formatDate(end)}
  `;
  document.getElementById('leave-decision-remarks').value = '';
  openModal('leave-modal');
}

function openActivityModal(id, studentName, title, category) {
  document.getElementById('activity-decision-id').value = id;
  document.getElementById('activity-modal-info').innerHTML = `
    <strong>Student:</strong> ${escapeHtml(studentName)}<br>
    <strong>Activity:</strong> ${escapeHtml(title)} (${escapeHtml(category)})
  `;
  document.getElementById('activity-decision-remarks').value = '';
  openModal('activity-modal');
}

function openExamLabModal(studentId, studentName) {
  document.getElementById('exam-lab-student-id').value = studentId;
  document.getElementById('exam-lab-modal-student-info').innerHTML = `Recording assessment results for: <strong>${escapeHtml(studentName)}</strong>`;
  document.getElementById('exam-lab-upload-form').reset();
  document.getElementById('exam-lab-academic-year').value = '2026-2027';
  document.getElementById('exam-lab-publish').checked = true;
  openModal('exam-lab-upload-modal');
}

function filterMentees() {
  const q = (document.getElementById('mentee-search').value || '').toLowerCase().trim();
  if (!q) {
    renderMenteesTable(menteesList);
    return;
  }
  const filtered = menteesList.filter(m =>
    m.student_name.toLowerCase().includes(q) ||
    m.register_number.toLowerCase().includes(q) ||
    (m.department_name && m.department_name.toLowerCase().includes(q))
  );
  renderMenteesTable(filtered);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
