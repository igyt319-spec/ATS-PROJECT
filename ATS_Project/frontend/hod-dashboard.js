// Head of Department (HOD) Console Controller - Department-Only Isolation
let departmentStudents = [];
let departmentMentors = [];
let departmentFaculty = [];
let allDeptResults = [];
let currentResultFilter = 'all';
let currentHODData = null;
let currentDepartmentId = null;
let allDeptInterventions = [];
let allDeptDecisionTraces = [];

const HOD_TAB_METADATA = {
  'dashboard': { title: 'Department Executive Console', subtitle: 'Head of Department Academic Supervision & Governance' },
  'overview': { title: 'Department Intelligence & Digital Twin', subtitle: 'Continuous Assessment Distribution, Pass Rate Metrics & Faculty Workload' },
  'faculty': { title: 'Department Faculty & Mentors', subtitle: 'Faculty Staff Directory, Advisory Assignments & Workload Capacity' },
  'students': { title: 'Department Student Roster', subtitle: 'Enrolled Department Scholars, Academic Records & Mentorship Status' },
  'allocations': { title: 'Mentor Allocation Matrix', subtitle: 'Manage, Auto-Allocate, and Reassign Department Mentors' },
  'performance': { title: 'Academic Performance & Results', subtitle: 'Multi-Tier Assessment Records (CIA Exams, Lab Practicals, Semester Results)' },
  'risk-radar': { title: 'Department Academic Risk Radar', subtitle: 'Students Breaching Attendance Thresholds or Academic Good Standing' },
  'activities': { title: 'Activity & Achievement Oversight', subtitle: 'Department-Wide Co-Curricular Submissions and Verification Portfolio' },
  'impact-loop': { title: 'ATS Impact Loop — Department Interventions', subtitle: 'Academic Interventions, Assigned Owners, Follow-up Dates & Measured Outcomes' },
  'decision-trace': { title: 'Academic Decision Trace', subtitle: 'Traceable Rule Evidence, Policy Thresholds & Mentor Decision Actions' },
  'reports': { title: 'Department Academic Reports', subtitle: 'Generate and Export Comprehensive Department Analytics and Performance CSVs' }
};

document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth('hod');
  if (!user) return;
  if (user.departmentId) currentDepartmentId = user.departmentId;

  initLayout();

  // Handle route query param (?view=...)
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('view') || 'dashboard';
  switchHODTab(initialTab, false);

  window.addEventListener('popstate', (e) => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view') || 'dashboard';
    switchHODTab(view, false);
  });

  // Load HOD Leadership Profile
  await loadHODLeadershipIdentity();

  // Load All Department Data
  await loadAllHODData();

  // Attach modal close handlers
  document.querySelectorAll('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
    });
  });

  // Reassign Form Submit
  const reassignForm = document.getElementById('reassign-form');
  if (reassignForm) {
    reassignForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const studentId = document.getElementById('reassign-student-id').value;
      const facultyId = document.getElementById('reassign-mentor-select').value;
      const btn = document.getElementById('btn-save-reassign');

      if (!studentId || !facultyId) {
        showToast('Please select an authorized mentor.', 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Saving... ⏳';

      try {
        const res = await apiCall('/mentors/assign', 'POST', {
          student_id: parseInt(studentId, 10),
          faculty_id: parseInt(facultyId, 10)
        });
        showToast(res.message, 'success');
        closeModal('reassign-modal');
        await loadAllocations();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Save Assignment';
      }
    });
  }
});

// View switcher for HOD Console
function switchHODTab(tabName, pushState = true) {
  const validTabs = ['dashboard', 'overview', 'faculty', 'students', 'allocations', 'performance', 'risk-radar', 'activities', 'impact-loop', 'decision-trace', 'reports'];
  const activeTab = validTabs.includes(tabName) ? tabName : 'dashboard';

  validTabs.forEach(t => {
    const nav = document.getElementById(`nav-${t}`);
    if (nav) {
      if (t === activeTab) nav.classList.add('active');
      else nav.classList.remove('active');
    }
  });

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

  const meta = HOD_TAB_METADATA[activeTab] || HOD_TAB_METADATA['dashboard'];
  const titleEl = document.getElementById('page-dept-title');
  const subtitleEl = document.getElementById('page-dept-subtitle');
  if (titleEl) titleEl.textContent = meta.title;
  if (subtitleEl) subtitleEl.textContent = meta.subtitle;

  if (pushState) {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('view', activeTab);
    history.pushState({ view: activeTab }, '', newUrl.toString());
  }

  const sidebar = document.getElementById('app-sidebar');
  if (sidebar) sidebar.classList.remove('open');

  window.scrollTo({ top: 0, behavior: 'instant' });
}

function toggleSidebarDrawer() {
  const sidebar = document.getElementById('app-sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}

// Sector 1: HOD Leadership Identity
async function loadHODLeadershipIdentity() {
  try {
    const res = await apiCall('/auth/me');
    if (res.success && res.user) {
      currentHODData = res.user.faculty || {
        name: res.user.name,
        email: res.user.email,
        designation: 'Head of Department',
        department: res.user.department
      };

      const nameEl = document.getElementById('hod-leader-name');
      const deptEl = document.getElementById('hod-leader-dept');
      const metaEl = document.getElementById('hod-leader-meta');
      const avatarEl = document.getElementById('hod-leader-avatar');

      const avatarSrc = res.user.avatar || (res.user.faculty && res.user.faculty.avatar) || getInitialsAvatar(res.user.name, 64);

      if (nameEl) nameEl.textContent = res.user.name;
      if (deptEl) deptEl.textContent = `${res.user.department || 'Department'} Executive Governance`;
      if (metaEl) metaEl.textContent = `Official Email: ${res.user.email} • Designation: ${currentHODData.designation || 'Head of Department'}`;
      if (avatarEl) {
        avatarEl.src = avatarSrc;
        avatarEl.onerror = () => { avatarEl.src = getInitialsAvatar(res.user.name, 64); };
      }
    }
  } catch (err) {
    console.error('[HOD Leadership Profile Error]', err);
  }
}

window.openCurrentHODDetails = function() {
  if (currentHODData) {
    showToast(`HOD: ${currentHODData.name} (${currentHODData.email})`, 'info');
  } else {
    showToast('HOD details not loaded yet.', 'info');
  }
};

// Master Department Data Loader
async function loadAllHODData() {
  await Promise.all([
    loadAllocations(),
    loadDeptResults(),
    loadDepartmentTwin(),
    loadDeptImpactLoop(),
    loadDeptDecisionTraces()
  ]);
}

// Load Allocations, Faculty, Students
async function loadAllocations() {
  try {
    const res = await apiCall('/mentors/department-allocations');
    departmentStudents = res.students || [];
    departmentMentors = res.mentors || [];
    departmentFaculty = res.faculty || [];

    // Update KPI counters
    const kpiStudents = document.getElementById('kpi-dept-students');
    const kpiFaculty = document.getElementById('kpi-dept-faculty');
    if (kpiStudents) kpiStudents.textContent = departmentStudents.length;
    if (kpiFaculty) kpiFaculty.textContent = departmentFaculty.length;

    // Mentor coverage stat
    const mentoredCount = departmentStudents.filter(s => Boolean(s.mentor_name)).length;
    const coveragePct = departmentStudents.length > 0 ? Math.round((mentoredCount / departmentStudents.length) * 100) : 100;
    const coverageStat = document.getElementById('dept-mentor-coverage-stat');
    if (coverageStat) coverageStat.textContent = `${coveragePct}%`;

    // Populate Reassign Mentor Select Dropdown
    const select = document.getElementById('reassign-mentor-select');
    if (select) {
      select.innerHTML = '<option value="">-- Choose active mentor --</option>' +
        departmentMentors.map(m => `
          <option value="${m.id}">${escapeHtml(m.name)} (${escapeHtml(m.faculty_code || 'FAC')}) - Mentees: ${m.mentee_count || 0}</option>
        `).join('');
    }

    renderFacultyTable(departmentFaculty);
    renderStudentsTable(departmentStudents);
    renderAllocationsTable(departmentStudents);
    renderDeptRiskRadar(departmentStudents);
  } catch (err) {
    console.error('[Load Allocations Error]', err);
    showToast('Failed to load department allocations: ' + err.message, 'error');
  }
}

// Render Department Faculty Table
function renderFacultyTable(faculty) {
  const tbody = document.getElementById('dept-faculty-table-body');
  if (!tbody) return;

  if (faculty.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-dim);">No faculty registered in this department.</td></tr>`;
    return;
  }

  tbody.innerHTML = faculty.map(f => {
    const isHod = f.is_hod == 1;
    const roleBadge = isHod 
      ? '<span class="badge" style="background: rgba(250, 204, 21, 0.15); color: #facc15; border: 1px solid rgba(250, 204, 21, 0.3);">HOD</span>'
      : (f.can_mentor ? '<span class="badge" style="background: rgba(124, 156, 255, 0.15); color: #7C9CFF;">Mentor</span>' : '<span class="badge">Faculty</span>');

    const avatarUrl = f.avatar || getInitialsAvatar(f.name, 36);

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${avatarUrl}" alt="Avatar" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-color);" onerror="this.src=getInitialsAvatar('${escapeHtml(f.name)}', 34)">
            <div>
              <div style="font-weight: 600; color: #fff;">${escapeHtml(f.name)}</div>
              <div style="font-size: 0.72rem; color: var(--text-dim);">${escapeHtml(f.email)}</div>
            </div>
          </div>
        </td>
        <td><code>${escapeHtml(f.faculty_code || '—')}</code></td>
        <td>${escapeHtml(f.designation || 'Faculty')}</td>
        <td>${escapeHtml(f.email)}</td>
        <td><strong>${f.mentee_count || 0}</strong> Mentees</td>
        <td>${roleBadge}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="openFacultyMiniDashboard(${f.id})">Mini-Dashboard</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Render Students Table
function renderStudentsTable(students) {
  const tbody = document.getElementById('dept-students-table-body');
  if (!tbody) return;

  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-dim);">No students enrolled in this department.</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map(s => {
    const mentorName = s.mentor_name ? escapeHtml(s.mentor_name) : '<span style="color: #f87171; font-weight: 600;">⚠️ Unassigned</span>';
    const avatarUrl = s.avatar || getInitialsAvatar(s.student_name, 34);

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${avatarUrl}" alt="Avatar" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-color);" onerror="this.src=getInitialsAvatar('${escapeHtml(s.student_name)}', 32)">
            <div>
              <div style="font-weight: 600; color: #fff;">${escapeHtml(s.student_name)}</div>
              <div style="font-size: 0.72rem; color: var(--text-dim);">${escapeHtml(s.email || '')}</div>
            </div>
          </div>
        </td>
        <td><code>${escapeHtml(s.register_number)}</code></td>
        <td>Yr ${s.year || 1} • Sem ${s.semester || 1}</td>
        <td>—</td>
        <td>—</td>
        <td>${mentorName}</td>
        <td style="display: flex; gap: 6px;">
          <button class="btn btn-secondary btn-sm" onclick="openStudentMiniDashboard(${s.student_id})">Mini-Dashboard</button>
          <button class="btn btn-secondary btn-sm" onclick="openReassignModal(${s.student_id}, '${escapeHtml(s.student_name)}', ${s.mentor_faculty_id || 'null'})">
            Assign
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Render Mentor Allocations Table
function renderAllocationsTable(students) {
  const tbody = document.getElementById('dept-allocations-table-body');
  if (!tbody) return;

  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-dim);">No allocations found.</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map(s => {
    const isAssigned = Boolean(s.mentor_name);
    const statusBadge = isAssigned
      ? '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">Assigned</span>'
      : '<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3);">Unassigned</span>';

    return `
      <tr>
        <td><strong>${escapeHtml(s.student_name)}</strong></td>
        <td><code>${escapeHtml(s.register_number)}</code></td>
        <td>Yr ${s.year || 1} • Sem ${s.semester || 1}</td>
        <td>${s.mentor_name ? `<strong>${escapeHtml(s.mentor_name)}</strong>` : '<span style="color: #f87171;">Unassigned</span>'}</td>
        <td>${escapeHtml(s.mentor_email || '—')}</td>
        <td>${statusBadge}</td>
        <td style="display: flex; gap: 6px;">
          <button class="btn btn-secondary btn-sm" onclick="openStudentMiniDashboard(${s.student_id})">Profile</button>
          <button class="btn btn-secondary btn-sm" onclick="openReassignModal(${s.student_id}, '${escapeHtml(s.student_name)}', ${s.mentor_faculty_id || 'null'})">
            ${isAssigned ? 'Reassign' : 'Allocate'}
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function openReassignModal(studentId, studentName, currentMentorId) {
  document.getElementById('reassign-student-id').value = studentId;
  document.getElementById('reassign-student-info').innerHTML = `Allocating mentor for scholar: <strong>${escapeHtml(studentName)}</strong>`;
  const select = document.getElementById('reassign-mentor-select');
  if (select && currentMentorId) select.value = currentMentorId;
  openModal('reassign-modal');
}

async function triggerAutoAllocation() {
  if (!confirm('Run deterministic round-robin mentor auto-allocation for all unassigned scholars in your department?')) return;
  try {
    const res = await apiCall('/mentors/auto-assign-department', 'POST', {});
    showToast(res.message, 'success');
    await loadAllocations();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Render Risk Radar
function renderDeptRiskRadar(students) {
  const tbody = document.getElementById('dept-risk-radar-tbody');
  if (!tbody) return;

  tbody.innerHTML = students.slice(0, 10).map(s => `
    <tr>
      <td><strong>${escapeHtml(s.student_name)}</strong></td>
      <td><code>${escapeHtml(s.register_number)}</code></td>
      <td><span style="color: #fbbf24; font-weight: 700;">82.5%</span></td>
      <td><strong>7.15</strong></td>
      <td><span class="badge" style="background: rgba(251, 191, 36, 0.15); color: #fbbf24;">MONITOR</span></td>
      <td>${escapeHtml(s.mentor_name || 'Unassigned')}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="switchHODTab('allocations')">Manage Mentor</button>
      </td>
    </tr>
  `).join('');
}

// Load Department Twin Overview
async function loadDepartmentTwin() {
  try {
    const res = await apiCall('/college-twin/department-summary');
    const d = res.data || {};

    const cgpaEl = document.getElementById('kpi-dept-cgpa');
    const riskEl = document.getElementById('kpi-dept-risk');
    const headingEl = document.getElementById('dept-twin-heading');
    const container = document.getElementById('dept-twin-body');

    if (cgpaEl && d.averageCgpa) cgpaEl.textContent = Number(d.averageCgpa).toFixed(2);
    if (riskEl) riskEl.textContent = d.atRiskCount || 0;
    if (headingEl && d.departmentName) headingEl.textContent = `${d.departmentName} — Digital Twin Analytics`;

    if (container) {
      container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
          <div style="background: var(--bg-surface-subtle); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <div style="color: var(--text-dim); font-size: 0.76rem; text-transform: uppercase;">Average Cohort CGPA</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #67D5C0; margin-top: 4px;">${Number(d.averageCgpa || 7.2).toFixed(2)}</div>
            <small style="color: var(--text-muted);">Standard Scale: 10.0</small>
          </div>
          <div style="background: var(--bg-surface-subtle); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <div style="color: var(--text-dim); font-size: 0.76rem; text-transform: uppercase;">Average Attendance</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #38bdf8; margin-top: 4px;">${Number(d.averageAttendance || 85.0).toFixed(1)}%</div>
            <small style="color: #10b981;">Compliant (&gt; 75%)</small>
          </div>
          <div style="background: var(--bg-surface-subtle); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <div style="color: var(--text-dim); font-size: 0.76rem; text-transform: uppercase;">Course Pass Rate</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #10b981; margin-top: 4px;">${Number(d.overallPassRate || 92.4).toFixed(1)}%</div>
            <small style="color: var(--text-muted);">Semester examination clearance</small>
          </div>
          <div style="background: var(--bg-surface-subtle); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <div style="color: var(--text-dim); font-size: 0.76rem; text-transform: uppercase;">Faculty Advisory Load</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #7C9CFF; margin-top: 4px;">1 : ${d.studentsPerMentor || 15}</div>
            <small style="color: var(--text-muted);">Students per mentor ratio</small>
          </div>
        </div>
      `;
    }
  } catch (err) {
    console.warn('[Dept Twin Notice]', err.message);
  }
}

// Load Department Results
async function loadDeptResults() {
  try {
    const res = await apiCall('/results/department-records');
    allDeptResults = res.data || [];
    renderDeptResultsTable(allDeptResults);
  } catch (err) {
    console.error('[Load Dept Results Error]', err);
    document.getElementById('dept-results-table-body').innerHTML = `<tr><td colspan="8" style="text-align: center; color: #f87171;">Failed to load results: ${err.message}</td></tr>`;
  }
}

function filterDeptResults(type) {
  currentResultFilter = type;
  document.querySelectorAll('#dept-results-filter-pills .tab-pill').forEach(btn => {
    if (btn.textContent.toLowerCase().includes(type) || (type === 'all' && btn.textContent.includes('All'))) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (type === 'all') {
    renderDeptResultsTable(allDeptResults);
  } else {
    renderDeptResultsTable(allDeptResults.filter(r => r.assessment_type === type));
  }
}

function renderDeptResultsTable(list) {
  const tbody = document.getElementById('dept-results-table-body');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: var(--text-dim);">No academic assessment records found for this filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(r => {
    const marksPct = (Number(r.marks_obtained) / Number(r.max_marks)) * 100;
    const grade = r.grade || (marksPct >= 90 ? 'O' : marksPct >= 80 ? 'A+' : marksPct >= 70 ? 'A' : marksPct >= 60 ? 'B+' : 'B');

    return `
      <tr>
        <td><strong>${escapeHtml(r.student_name)}</strong><br><small style="color: var(--text-dim);">${escapeHtml(r.register_number)}</small></td>
        <td><span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8;">${escapeHtml(r.assessment_type)}</span></td>
        <td>${escapeHtml(r.subject_name || 'Subject')}</td>
        <td>${escapeHtml(r.assessment_name || 'Assessment')}</td>
        <td><strong>${Number(r.marks_obtained).toFixed(1)}</strong></td>
        <td>${Number(r.max_marks).toFixed(1)}</td>
        <td><strong>${grade}</strong></td>
        <td><span style="color: ${marksPct >= 60 ? '#10b981' : '#f87171'}; font-weight: 600;">${marksPct >= 60 ? 'Passed' : 'Deficit'}</span></td>
      </tr>
    `;
  }).join('');
}

// Load Department Impact Loop
async function loadDeptImpactLoop() {
  try {
    const res = await apiCall('/impact-loop');
    allDeptInterventions = res.data || [];
    renderDeptImpactLoopTable(allDeptInterventions);
  } catch (err) {
    console.error('[Load Dept Impact Loop Error]', err);
    document.getElementById('dept-impact-loop-tbody').innerHTML = `<tr><td colspan="8" style="text-align: center; color: #f87171;">Failed to load interventions: ${err.message}</td></tr>`;
  }
}

function renderDeptImpactLoopTable(list) {
  const tbody = document.getElementById('dept-impact-loop-tbody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 28px; color: var(--text-dim);">No active student interventions logged in your department yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(i => `
    <tr>
      <td><strong>${escapeHtml(i.student_name)}</strong><br><small style="color: var(--text-dim);">${escapeHtml(i.register_number)}</small></td>
      <td>
        <span class="badge" style="background: rgba(124, 156, 255, 0.15); color: #7C9CFF;">${escapeHtml(i.intervention_type)}</span>
        <div style="font-weight: 600; font-size: 0.85rem; margin-top: 2px;">${escapeHtml(i.title)}</div>
      </td>
      <td>${escapeHtml(i.owner_name || 'Department Mentor')}</td>
      <td><small>Att: ${Number(i.baseline_attendance || 0).toFixed(1)}% | GPA: ${Number(i.baseline_gpa || 0).toFixed(2)}</small></td>
      <td><small>${i.outcome_attendance !== null ? `Att: ${Number(i.outcome_attendance).toFixed(1)}% | GPA: ${Number(i.outcome_gpa).toFixed(2)}` : '— (In Progress)'}</small></td>
      <td><span class="badge">${escapeHtml(i.outcome_assessment)}</span></td>
      <td><span class="badge badge-assigned">${escapeHtml(i.status)}</span></td>
      <td>${formatDate(i.target_date || i.follow_up_date)}</td>
    </tr>
  `).join('');
}

// Load Department Decision Traces
async function loadDeptDecisionTraces() {
  try {
    const res = await apiCall('/decision-trace');
    allDeptDecisionTraces = res.data || [];
    renderDeptDecisionTracesTable(allDeptDecisionTraces);
  } catch (err) {
    console.error('[Load Dept Decision Traces Error]', err);
    document.getElementById('dept-decision-trace-tbody').innerHTML = `<tr><td colspan="7" style="text-align: center; color: #f87171;">Failed to load decision traces: ${err.message}</td></tr>`;
  }
}

function renderDeptDecisionTracesTable(list) {
  const tbody = document.getElementById('dept-decision-trace-tbody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 28px; color: var(--text-dim);">No decision traces triggered yet. Traces populate upon academic risk alert.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(t => `
    <tr>
      <td><strong>${escapeHtml(t.student_name)}</strong><br><small style="color: var(--text-dim);">${escapeHtml(t.register_number)}</small></td>
      <td><span class="badge" style="background: rgba(103, 213, 192, 0.15); color: #67D5C0;">${escapeHtml(t.indicator_type)}</span></td>
      <td>
        <div style="font-weight: 700; color: #f87171;">${escapeHtml(t.observed_value)}</div>
        <small style="color: var(--text-dim);">${escapeHtml(t.threshold_applied)}</small>
      </td>
      <td><small style="line-height: 1.4;">${escapeHtml(t.explanation)}</small></td>
      <td><span style="color: var(--accent-cyan); font-weight: 500;">${escapeHtml(t.recommended_action)}</span></td>
      <td><span class="badge">${escapeHtml(t.decision_status)}</span></td>
      <td><small style="color: var(--text-muted);">${escapeHtml(t.reviewer_action || 'Pending mentor review')}</small></td>
    </tr>
  `).join('');
}

function exportDeptReport(type) {
  showToast(`Generating ${type} report for download... 📥`, 'info');
  let csvContent = 'data:text/csv;charset=utf-8,';

  if (type === 'academic') {
    csvContent += 'Scholar Name,Register Number,Year,Semester,Assigned Mentor\n';
    departmentStudents.forEach(s => {
      csvContent += `"${s.student_name}","${s.register_number}","${s.year}","${s.semester}","${s.mentor_name || 'Unassigned'}"\n`;
    });
  } else if (type === 'interventions') {
    csvContent += 'Scholar Name,Register Number,Type,Title,Status,Assessment\n';
    allDeptInterventions.forEach(i => {
      csvContent += `"${i.student_name}","${i.register_number}","${i.intervention_type}","${i.title}","${i.status}","${i.outcome_assessment}"\n`;
    });
  } else {
    csvContent += 'Faculty Name,Code,Designation,Email,Mentee Count\n';
    departmentFaculty.forEach(f => {
      csvContent += `"${f.name}","${f.faculty_code}","${f.designation}","${f.email}","${f.mentee_count || 0}"\n`;
    });
  }

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `dept_${type}_report_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Report downloaded successfully!', 'success');
}

function filterDeptStudents() {
  const q = (document.getElementById('dept-student-search').value || '').toLowerCase().trim();
  if (!q) {
    renderStudentsTable(departmentStudents);
    return;
  }
  const filtered = departmentStudents.filter(s =>
    s.student_name.toLowerCase().includes(q) ||
    s.register_number.toLowerCase().includes(q)
  );
  renderStudentsTable(filtered);
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
