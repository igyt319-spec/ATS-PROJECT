/**
 * ATS System Administrator Console Controller
 * Dedicated to Account Creation, Lifecycle Maintenance, and Access Governance.
 * Operational dashboards (student marks, attendance) are restricted to Department Faculty & Mentors.
 */

let allUsers = [];
let allDepartments = [];
let allAuditLogs = [];
let allAdminInterventions = [];
let allAdminDecisionTraces = [];

const ADMIN_TAB_METADATA = {
  'overview': { title: 'System Administration Console', subtitle: 'Account Provisioning, Role Maintenance & Access Governance' },
  'departments': { title: 'Department Management', subtitle: 'Institutional Departments, Structural Rosters & Leadership' },
  'students': { title: 'Student Management Directory', subtitle: 'Provision, Maintain, and Manage Enrolled Undergraduate Scholars' },
  'faculty': { title: 'Faculty & Mentors Directory', subtitle: 'Institutional Academic Staff, Advisory Assignments & Department Affiliations' },
  'hod': { title: 'Head of Department (HOD) Governance', subtitle: 'Executive Appointments, Single Active Constraint Enforcement & Audit Trails' },
  'mentor-assignments': { title: 'Institutional Mentor Allocations', subtitle: 'Advisory Coverage, Unassigned Scholars & Departmental Load Balancing' },
  'department-mini-dashboards': { title: 'Department-Wise Mini Dashboards', subtitle: 'Live Database Aggregation, CGPA Distribution & Student Drill-Down' },
  'academic-records': { title: 'Institutional Academic Records & Digital Twin', subtitle: 'College-Wide Macro Telemetry, Pass Rates & Read-Only Governance' },
  'knowledge-graph': { title: 'Academic Knowledge Graph', subtitle: 'Curriculum Prerequisite Architecture & Performance Tracing' },
  'trajectory-predictor': { title: 'Academic Trajectory Predictor', subtitle: 'OLS Linear Trend Forecasting & Explainable Academic Signals' },
  'study-planner': { title: 'Adaptive Study Planner', subtitle: 'Prerequisite-Prioritized Revision Workloads & Task Tracking' },
  'skill-evidence': { title: 'Skill Evidence Graph', subtitle: 'Validated Portfolio Competencies & Career Fit Analysis' },
  'career-readiness': { title: 'Institution Career Readiness Governance', subtitle: 'Placements Readiness & Industry Competency Monitoring' },
  'interventions': { title: 'Intervention Effectiveness Engine', subtitle: 'Track Academic Support Plans, Follow-ups & Measured Outcomes' },
  'activities': { title: 'Activity Verification Oversight', subtitle: 'Institutional Co-Curricular Credentials and Verification Monitoring' },
  'fees': { title: 'Institutional Fee Management', subtitle: 'Tuition Fee Structure Overview, Dues Tracking & Telemetry' },
  'demo-payments': { title: 'Demo Payment Transactions & Reconciliation', subtitle: 'Audit Simulated Transactions, Gateways Outcomes & Ledger Matching' },
  'impact-loop': { title: 'ATS Impact Loop — Institutional Analytics', subtitle: 'Cross-Departmental Academic Interventions, Efficacy & Outcome Measures' },
  'decision-trace': { title: 'Academic Decision Trace Telemetry', subtitle: 'Transparent Heuristic Rules, Policy Thresholds & Decision Audits' },
  'audit-logs': { title: 'Smart Academic Integrity & Audit Trail', subtitle: 'Immutable Ledger, Anomaly Detection & Forensic Traceability' },
  'reports': { title: 'Institutional Executive Reports', subtitle: 'Generate and Export Comprehensive Roster and Benchmark Reports' }
};

document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth('admin');
  if (!user) return;
  initLayout();

  // Route query param handler (?view=...)
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('view') || 'overview';
  switchAdminTab(initialTab, false);

  window.addEventListener('popstate', (e) => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view') || 'overview';
    switchAdminTab(view, false);
  });

  // Set today's date in header
  const dateEl = document.getElementById('topbar-current-date');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Attach modal close handlers
  document.querySelectorAll('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
    });
  });

  await Promise.all([
    loadDepartments(),
    loadAccountDirectory(),
    loadInstitutionalTwin(),
    loadAuditLogs(),
    loadAdminImpactLoop(),
    loadAdminDecisionTraces()
  ]);
});

// View switcher for Admin Console
function switchAdminTab(tabName, pushState = true) {
  const RESTRICTED_STUDENT_MODULES = [
    'knowledge-graph', 'trajectory-predictor', 'study-planner', 'skill-evidence', 'interventions', 'risk-overview'
  ];
  if (RESTRICTED_STUDENT_MODULES.includes(tabName)) {
    showToast('Access Restricted: This academic intelligence module is available only in the Student Console.', 'info');
    tabName = 'overview';
  }

  const validTabs = [
    'overview', 'departments', 'students', 'faculty', 'hod',
    'mentor-assignments', 'department-mini-dashboards', 'academic-records',
    'career-readiness', 'activities', 'fees',
    'demo-payments', 'impact-loop', 'decision-trace', 'audit-logs', 'reports'
  ];
  const activeTab = validTabs.includes(tabName) ? tabName : 'overview';

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

  // Trigger Advanced Intelligence Modules
  if (window.AdvancedModules) {
    if (activeTab === 'department-mini-dashboards') {
      AdvancedModules.initDepartmentMiniDashboards(document.getElementById('view-department-mini-dashboards'));
    } else if (activeTab === 'knowledge-graph') {
      AdvancedModules.initKnowledgeGraph(document.getElementById('view-knowledge-graph'), null);
    } else if (activeTab === 'trajectory-predictor') {
      AdvancedModules.initTrajectoryPredictor(document.getElementById('view-trajectory-predictor'), 1);
    } else if (activeTab === 'study-planner') {
      AdvancedModules.initStudyPlanner(document.getElementById('view-study-planner'), 1);
    } else if (activeTab === 'skill-evidence') {
      AdvancedModules.initSkillEvidence(document.getElementById('view-skill-evidence'), 1);
    } else if (activeTab === 'demo-payments') {
      AdvancedModules.initDemoPaymentAuditTable(document.getElementById('view-demo-payments'));
    } else if (activeTab === 'interventions') {
      const target = document.getElementById('view-interventions');
      const impactView = document.getElementById('view-impact-loop');
      if (target && impactView) {
        target.innerHTML = impactView.innerHTML;
        loadAdminInterventions();
      }
    }
  }

  const meta = ADMIN_TAB_METADATA[activeTab] || ADMIN_TAB_METADATA['overview'];
  const titleEl = document.getElementById('page-admin-title');
  const subtitleEl = document.getElementById('page-admin-subtitle');
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
window.switchAdminTab = switchAdminTab;

function toggleSidebarDrawer() {
  const sidebar = document.getElementById('app-sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}
window.toggleSidebarDrawer = toggleSidebarDrawer;

/**
 * Fetch and populate department select dropdowns and structural cards
 */
async function loadDepartments() {
  try {
    const res = await apiCall('/departments');
    allDepartments = (res && res.data) ? res.data : [];

    const stuDeptSelect = document.getElementById('stu-dept');
    if (stuDeptSelect) {
      stuDeptSelect.innerHTML = '<option value="">-- Select Department --</option>' +
        allDepartments.map(d => `<option value="${d.id}">${escapeHtml(d.name)} (${escapeHtml(d.code)})</option>`).join('');
    }

    const modalDeptSelect = document.getElementById('dept-modal-select');
    if (modalDeptSelect) {
      modalDeptSelect.innerHTML = '<option value="">-- Select Department --</option>' +
        allDepartments.map(d => `<option value="${d.id}">${escapeHtml(d.name)} (${escapeHtml(d.code)})</option>`).join('');
    }

    renderDepartmentOverview(allDepartments);
    renderHODMatrix(allDepartments);
  } catch (err) {
    console.error('[Load Departments Error]', err);
    showToast('Failed to load departments list: ' + err.message, 'error');
  }
}

/**
 * Fetch all registered users from /api/auth/users
 */
async function loadAccountDirectory() {
  const tbody = document.getElementById('admin-users-table-body');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 36px; color: var(--text-dim);">
          Retrieving accounts from database... ⏳
        </td>
      </tr>
    `;
  }

  try {
    const res = await apiCall('/auth/users');
    if (!res || !res.success) {
      throw new Error(res ? res.message : 'Failed to retrieve accounts');
    }

    allUsers = res.users || [];
    updateKpis(allUsers);
    renderUserTable(allUsers);
    renderStudentsManagementTable(allUsers.filter(u => u.role === 'student'));
    renderFacultyManagementTable(allUsers.filter(u => u.role === 'faculty'));
    renderUnassignedMentorsTable(allUsers.filter(u => u.role === 'student'));
  } catch (err) {
    console.error('[Load Directory Error]', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 36px; color: #f87171;">
            Failed to load account directory: ${err.message}
          </td>
        </tr>
      `;
    }
    showToast('Failed to load user accounts: ' + err.message, 'error');
  }
}

function updateKpis(users) {
  const totalUsersEl = document.getElementById('kpi-total-users');
  const totalStudentsEl = document.getElementById('kpi-total-students');
  const totalFacultyEl = document.getElementById('kpi-total-faculty');
  const totalHodsEl = document.getElementById('kpi-total-hods');

  if (totalUsersEl) totalUsersEl.textContent = users.length;
  if (totalStudentsEl) totalStudentsEl.textContent = users.filter(u => u.role === 'student').length;
  if (totalFacultyEl) totalFacultyEl.textContent = users.filter(u => u.role === 'faculty').length;
  if (totalHodsEl) totalHodsEl.textContent = users.filter(u => u.role === 'faculty' && u.faculty_role === 'hod').length;
}

function renderUserTable(users) {
  const tbody = document.getElementById('admin-users-table-body');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 36px; color: var(--text-dim);">
          No user accounts found matching criteria.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = users.map(u => {
    let roleBadge = '<span class="badge">User</span>';
    if (u.role === 'admin') {
      roleBadge = '<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3);">Admin</span>';
    } else if (u.role === 'faculty') {
      if (u.faculty_role === 'hod') {
        roleBadge = '<span class="badge" style="background: rgba(250, 204, 21, 0.15); color: #facc15; border: 1px solid rgba(250, 204, 21, 0.3);">HOD</span>';
      } else {
        roleBadge = '<span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3);">Faculty</span>';
      }
    } else if (u.role === 'student') {
      roleBadge = '<span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);">Student</span>';
    }

    const statusBadge = u.is_active
      ? '<span class="badge" style="background: rgba(52, 211, 153, 0.15); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3);">Active</span>'
      : '<span class="badge" style="background: rgba(115, 125, 140, 0.15); color: #94a3b8; border: 1px solid rgba(115, 125, 140, 0.3);">Deactivated</span>';

    const avatarUrl = u.avatar || getInitialsAvatar(u.name, 36);

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${avatarUrl}" alt="Avatar" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-color);" onerror="this.src=getInitialsAvatar('${escapeHtml(u.name)}', 34)">
            <div>
              <strong style="color: #fff; font-size: 0.88rem;">${escapeHtml(u.name)}</strong>
              <div style="font-size: 0.74rem; color: var(--text-dim);">${escapeHtml(u.email)}</div>
            </div>
          </div>
        </td>
        <td><code>${escapeHtml(u.register_number || '—')}</code></td>
        <td>${roleBadge}</td>
        <td><small style="color: var(--accent-cyan); font-weight: 500;">${escapeHtml(u.department || 'General')}</small></td>
        <td>${statusBadge}</td>
        <td><small style="color: var(--text-dim);">${formatDate(u.created_at)}</small></td>
        <td>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" onclick="openDeptModal(${u.id}, '${escapeHtml(u.name)}', ${u.department_id || 'null'})" title="Transfer Department">🏢 Dept</button>
            <button class="btn btn-secondary btn-sm" onclick="openResetModal(${u.id}, '${escapeHtml(u.name)}')" title="Reset Password">🔑 Reset</button>
            <button class="btn ${u.is_active ? 'btn-secondary' : 'btn-primary'} btn-sm" onclick="toggleStatus(${u.id}, ${u.is_active ? 0 : 1})" title="Toggle Active Status">
              ${u.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderStudentsManagementTable(students) {
  const tbody = document.getElementById('admin-students-tbody');
  if (!tbody) return;

  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 24px; color: var(--text-dim);">No students registered.</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map(s => `
    <tr>
      <td><strong>${escapeHtml(s.name)}</strong><br><small style="color: var(--text-dim);">${escapeHtml(s.email)}</small></td>
      <td><code>${escapeHtml(s.register_number || '—')}</code></td>
      <td>${escapeHtml(s.department || 'Unassigned')}</td>
      <td><span class="badge ${s.is_active ? 'pill-green' : 'pill-red'}">${s.is_active ? 'Active' : 'Inactive'}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="openDeptModal(${s.id}, '${escapeHtml(s.name)}', ${s.department_id || 'null'})">Transfer Dept</button>
        <button class="btn btn-secondary btn-sm" onclick="openResetModal(${s.id}, '${escapeHtml(s.name)}')">Reset</button>
      </td>
    </tr>
  `).join('');
}

function renderFacultyManagementTable(faculty) {
  const tbody = document.getElementById('admin-faculty-tbody');
  if (!tbody) return;

  if (faculty.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--text-dim);">No faculty registered.</td></tr>`;
    return;
  }

  tbody.innerHTML = faculty.map(f => {
    const isHod = f.faculty_role === 'hod';
    return `
      <tr>
        <td><strong>${escapeHtml(f.name)}</strong><br><small style="color: var(--text-dim);">${escapeHtml(f.email)}</small></td>
        <td><code>${escapeHtml(f.register_number || 'FAC')}</code></td>
        <td>${isHod ? 'Head of Department' : 'Faculty Mentor'}</td>
        <td>${escapeHtml(f.department || 'Unassigned')}</td>
        <td>${isHod ? '<span class="badge" style="background:rgba(250,204,21,0.15); color:#facc15;">👑 Active HOD</span>' : '<span class="badge">Faculty</span>'}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="openDeptModal(${f.id}, '${escapeHtml(f.name)}', ${f.department_id || 'null'})">Transfer Dept</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderHODMatrix(departments) {
  const tbody = document.getElementById('admin-hod-matrix-tbody');
  if (!tbody) return;

  if (departments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-dim);">No departments configured.</td></tr>`;
    return;
  }

  tbody.innerHTML = departments.map(d => {
    const hasHod = Boolean(d.active_hod_name);
    const hodBadge = hasHod
      ? '<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">Appointed</span>'
      : '<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3);">⚠️ Vacant</span>';

    return `
      <tr>
        <td><strong>${escapeHtml(d.name)}</strong></td>
        <td><code>${escapeHtml(d.code)}</code></td>
        <td>
          ${hasHod ? `<strong style="color: #facc15;">👑 ${escapeHtml(d.active_hod_name)}</strong>` : '<span style="color: #f87171; font-weight: 600;">No Active HOD</span>'}
        </td>
        <td>${escapeHtml(d.active_hod_email || '—')}</td>
        <td>${hodBadge}</td>
        <td>${formatDate(d.hod_assigned_date)}</td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="openAssignHODModal(${d.id}, '${escapeHtml(d.name)}')">
            ${hasHod ? 'Change HOD' : 'Appoint HOD'}
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderUnassignedMentorsTable(students) {
  const tbody = document.getElementById('admin-unassigned-mentors-tbody');
  if (!tbody) return;

  tbody.innerHTML = students.slice(0, 10).map(s => `
    <tr>
      <td><strong>${escapeHtml(s.name)}</strong></td>
      <td><code>${escapeHtml(s.register_number || '—')}</code></td>
      <td>${escapeHtml(s.department || 'Unassigned')}</td>
      <td>Yr ${s.year || 1}</td>
      <td><span class="badge" style="background: rgba(251, 191, 36, 0.15); color: #fbbf24;">Needs Allocation</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="showToast('Open HOD portal or Department Allocations to assign mentor.', 'info')">Allocate</button>
      </td>
    </tr>
  `).join('');
}

function renderDepartmentOverview(departments) {
  const container = document.getElementById('admin-departments-container');
  if (!container) return;

  if (departments.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 24px; color: var(--text-dim); grid-column: 1 / -1;">
        No active departments configured in the database.
      </div>
    `;
    return;
  }

  container.innerHTML = departments.map(d => `
    <div class="glass-card" style="padding: 18px; border: 1px solid var(--border-color); cursor: pointer;" onclick="openAdminDeptModal(${d.id})">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
        <div>
          <h4 style="font-size: 1.05rem; font-weight: 800; color: #fff;">${escapeHtml(d.name)}</h4>
          <span style="font-size: 0.74rem; font-family: monospace; color: var(--accent-cyan); font-weight: 600;">${escapeHtml(d.code)}</span>
        </div>
        <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8;">Dept #${d.id}</span>
      </div>

      <div style="background: var(--bg-surface-subtle); padding: 10px 12px; border-radius: 6px; margin-bottom: 12px;">
        <div style="font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase;">Head of Department</div>
        <div style="font-weight: 700; color: ${d.active_hod_name ? '#facc15' : '#f87171'}; font-size: 0.88rem; margin-top: 2px;">
          ${d.active_hod_name ? `👑 ${escapeHtml(d.active_hod_name)}` : '⚠️ No Active HOD'}
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.8rem;">
        <div>Scholars: <strong style="color: #fff;">${d.student_count || 0}</strong></div>
        <div>Faculty: <strong style="color: #fff;">${d.faculty_count || 0}</strong></div>
      </div>
    </div>
  `).join('');
}

// Open Assign HOD Modal
async function openAssignHODModal(deptId, deptName) {
  document.getElementById('assign-hod-dept-id').value = deptId;
  document.getElementById('assign-hod-modal-info').innerHTML = `Appointing active Head of Department for: <strong>${escapeHtml(deptName)}</strong>`;

  const select = document.getElementById('assign-hod-faculty-select');
  select.innerHTML = '<option value="">Loading eligible faculty members... ⏳</option>';

  openModal('assign-hod-modal');

  try {
    const res = await apiCall(`/departments/${deptId}`);
    const faculty = res.data && res.data.faculty ? res.data.faculty : [];

    if (faculty.length === 0) {
      select.innerHTML = '<option value="">⚠️ No faculty members currently in this department. Transfer faculty first.</option>';
    } else {
      select.innerHTML = '<option value="">-- Choose faculty member to appoint --</option>' +
        faculty.map(f => `<option value="${f.id}">${escapeHtml(f.name)} (${escapeHtml(f.faculty_code || 'FAC')}) — ${escapeHtml(f.designation || 'Staff')}</option>`).join('');
    }
  } catch (err) {
    select.innerHTML = `<option value="">Error loading faculty: ${err.message}</option>`;
  }
}
window.openAssignHODModal = openAssignHODModal;

async function executeHODAppointment(event) {
  event.preventDefault();
  const deptId = document.getElementById('assign-hod-dept-id').value;
  const facultyId = document.getElementById('assign-hod-faculty-select').value;
  const reason = document.getElementById('assign-hod-reason').value.trim();
  const btn = document.getElementById('btn-submit-hod-assign');

  if (!facultyId) {
    showToast('Please select a faculty member to appoint as HOD.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Appointing HOD... ⏳';

  try {
    const res = await apiCall(`/departments/${deptId}/hod`, 'PUT', { faculty_id: facultyId, reason });
    showToast(res.message || 'HOD appointed successfully!', 'success');
    closeModal('assign-hod-modal');
    await loadDepartments();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirm HOD Appointment';
  }
}
window.executeHODAppointment = executeHODAppointment;

// Handle Create Student Form
async function handleCreateStudent(e) {
  e.preventDefault();
  const name = document.getElementById('stu-name').value.trim();
  const email = document.getElementById('stu-email').value.trim();
  const register_number = document.getElementById('stu-regno').value.trim();
  const department_id = document.getElementById('stu-dept').value;
  const password = document.getElementById('stu-password').value;

  try {
    const res = await apiCall('/auth/users', 'POST', {
      name,
      email,
      register_number,
      role: 'student',
      department_id: parseInt(department_id, 10),
      password
    });

    showToast(res.message || 'Student account provisioned successfully!', 'success');
    document.getElementById('create-student-form').reset();
    await loadAccountDirectory();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
window.handleCreateStudent = handleCreateStudent;

// Institutional Twin Loader
async function loadInstitutionalTwin() {
  try {
    const res = await apiCall('/college-twin/institutional-summary');
    if (!res || !res.success) return;

    const d = res.data || {};
    const totalDeptsEl = document.getElementById('admin-twin-total-depts');
    const meanCgpaEl = document.getElementById('admin-twin-mean-cgpa');
    const meanAttEl = document.getElementById('admin-twin-mean-att');
    const highRiskEl = document.getElementById('admin-twin-high-risk');

    if (totalDeptsEl) totalDeptsEl.textContent = d.totalDepartments || '—';
    if (meanCgpaEl) meanCgpaEl.textContent = Number(d.institutionalMeanCgpa || 7.5).toFixed(2);
    if (meanAttEl) meanAttEl.textContent = `${Number(d.institutionalMeanAttendance || 85).toFixed(1)}%`;
    if (highRiskEl) highRiskEl.textContent = d.totalAtRiskCount || 0;

    const tbody = document.getElementById('admin-twin-table-body');
    if (tbody && d.departmentBenchmarks) {
      tbody.innerHTML = d.departmentBenchmarks.map(b => `
        <tr>
          <td><strong>${escapeHtml(b.name)}</strong></td>
          <td><code>${escapeHtml(b.code)}</code></td>
          <td>${b.studentCount}</td>
          <td>${b.facultyCount}</td>
          <td>1 : ${b.studentFacultyRatio}</td>
          <td><strong>${Number(b.meanCgpa).toFixed(2)}</strong></td>
          <td><span style="color: ${b.meanAttendance >= 80 ? '#10b981' : '#f87171'}; font-weight: 600;">${Number(b.meanAttendance).toFixed(1)}%</span></td>
          <td>${b.highRiskCount} High / ${b.medRiskCount} Med</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.warn('[Institutional Twin Notice]', err.message);
  }
}

// Load Audit Logs
async function loadAuditLogs() {
  try {
    const res = await apiCall('/audit-logs');
    allAuditLogs = res.data || [];
    renderAuditTable(allAuditLogs);
  } catch (err) {
    console.error('[Load Audit Logs Error]', err);
  }
}

function renderAuditTable(logs) {
  const tbody = document.getElementById('admin-audit-table-body');
  if (!tbody) return;

  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--text-dim);">No audit logs recorded.</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.map(l => `
    <tr>
      <td><small>${formatDate(l.created_at)}</small></td>
      <td><strong>${escapeHtml(l.user_email || 'System')}</strong></td>
      <td><span class="badge">${escapeHtml(l.action)}</span></td>
      <td><code>${escapeHtml(l.entity_type || '—')} #${l.entity_id || ''}</code></td>
      <td><small style="color: var(--text-muted);">${escapeHtml(l.reason || (typeof l.new_value === 'string' ? l.new_value : JSON.stringify(l.new_value || {})))}</small></td>
      <td><small><code>${escapeHtml(l.ip_address || '—')}</code></small></td>
    </tr>
  `).join('');
}

// Load Admin Impact Loop
async function loadAdminImpactLoop() {
  try {
    const res = await apiCall('/impact-loop');
    allAdminInterventions = res.data || [];
    const tbody = document.getElementById('admin-impact-loop-tbody');
    if (!tbody) return;

    if (allAdminInterventions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: var(--text-dim);">No active student interventions logged institution-wide.</td></tr>`;
      return;
    }

    tbody.innerHTML = allAdminInterventions.map(i => `
      <tr>
        <td><strong>${escapeHtml(i.student_name)}</strong><br><small style="color: var(--text-dim);">${escapeHtml(i.register_number)}</small></td>
        <td>${escapeHtml(i.department_name || 'Dept')}</td>
        <td><span class="badge" style="background: rgba(124, 156, 255, 0.15); color: #7C9CFF;">${escapeHtml(i.intervention_type)}</span></td>
        <td>${escapeHtml(i.title)}</td>
        <td><small>Att: ${Number(i.baseline_attendance || 0).toFixed(1)}% | GPA: ${Number(i.baseline_gpa || 0).toFixed(2)}</small></td>
        <td><small>${i.outcome_attendance !== null ? `Att: ${Number(i.outcome_attendance).toFixed(1)}% | GPA: ${Number(i.outcome_gpa).toFixed(2)}` : 'In Progress'}</small></td>
        <td><span class="badge">${escapeHtml(i.outcome_assessment)}</span></td>
        <td><span class="badge badge-assigned">${escapeHtml(i.status)}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    console.warn('[Admin Impact Loop Notice]', err.message);
  }
}

// Load Admin Decision Traces
async function loadAdminDecisionTraces() {
  try {
    const res = await apiCall('/decision-trace');
    allAdminDecisionTraces = res.data || [];
    const tbody = document.getElementById('admin-decision-trace-tbody');
    if (!tbody) return;

    if (allAdminDecisionTraces.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-dim);">No decision traces logged institution-wide.</td></tr>`;
      return;
    }

    tbody.innerHTML = allAdminDecisionTraces.map(t => `
      <tr>
        <td><strong>${escapeHtml(t.student_name)}</strong><br><small style="color: var(--text-dim);">${escapeHtml(t.register_number)}</small></td>
        <td>${escapeHtml(t.department_name || 'Dept')}</td>
        <td><span class="badge" style="background: rgba(103, 213, 192, 0.15); color: #67D5C0;">${escapeHtml(t.indicator_type)}</span></td>
        <td><strong style="color: #f87171;">${escapeHtml(t.observed_value)}</strong></td>
        <td><small style="line-height: 1.4;">${escapeHtml(t.explanation)}</small></td>
        <td><span style="color: var(--accent-cyan); font-weight: 500;">${escapeHtml(t.recommended_action)}</span></td>
        <td><span class="badge">${escapeHtml(t.decision_status)}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    console.warn('[Admin Decision Trace Notice]', err.message);
  }
}

// Filter User Directory
function filterUserDirectory() {
  const q = (document.getElementById('admin-user-search').value || '').toLowerCase().trim();
  const role = document.getElementById('admin-role-filter').value;

  let filtered = allUsers;
  if (role !== 'all') {
    filtered = filtered.filter(u => u.role === role);
  }
  if (q) {
    filtered = filtered.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.register_number && u.register_number.toLowerCase().includes(q)) ||
      (u.department && u.department.toLowerCase().includes(q))
    );
  }

  renderUserTable(filtered);
}

// Modal Handlers
function openDeptModal(userId, userName, currentDeptId) {
  document.getElementById('dept-modal-user-id').value = userId;
  document.getElementById('dept-modal-desc').innerHTML = `Transferring department affiliation for: <strong>${escapeHtml(userName)}</strong>`;
  const select = document.getElementById('dept-modal-select');
  if (select && currentDeptId) select.value = currentDeptId;

  const modal = document.getElementById('dept-update-modal');
  if (modal) modal.style.display = 'flex';
}
window.openDeptModal = openDeptModal;

function closeDeptModal() {
  const modal = document.getElementById('dept-update-modal');
  if (modal) modal.style.display = 'none';
}
window.closeDeptModal = closeDeptModal;

async function executeDepartmentUpdate() {
  const userId = document.getElementById('dept-modal-user-id').value;
  const deptId = document.getElementById('dept-modal-select').value;
  if (!deptId) {
    showToast('Please select a department.', 'error');
    return;
  }

  try {
    const res = await apiCall(`/auth/users/${userId}/department`, 'PUT', { department_id: parseInt(deptId, 10) });
    showToast(res.message || 'Department updated.', 'success');
    closeDeptModal();
    await loadAccountDirectory();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
window.executeDepartmentUpdate = executeDepartmentUpdate;

function openResetModal(userId, userName) {
  document.getElementById('reset-modal-user-id').value = userId;
  document.getElementById('reset-modal-desc').innerHTML = `Resetting password for: <strong>${escapeHtml(userName)}</strong>`;
  const modal = document.getElementById('reset-password-modal');
  if (modal) modal.style.display = 'flex';
}
window.openResetModal = openResetModal;

function closeResetModal() {
  const modal = document.getElementById('reset-password-modal');
  if (modal) modal.style.display = 'none';
}
window.closeResetModal = closeResetModal;

async function executePasswordReset() {
  const userId = document.getElementById('reset-modal-user-id').value;
  const newPassword = document.getElementById('reset-modal-new-password').value;
  if (!newPassword || newPassword.length < 6) {
    showToast('Password must be at least 6 characters.', 'error');
    return;
  }

  try {
    const res = await apiCall(`/auth/users/${userId}/reset-password`, 'PUT', { new_password: newPassword });
    showToast(res.message || 'Password reset successfully.', 'success');
    closeResetModal();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
window.executePasswordReset = executePasswordReset;

async function toggleStatus(userId, newStatus) {
  try {
    const res = await apiCall(`/auth/users/${userId}/status`, 'PUT', { is_active: newStatus });
    showToast(res.message || 'User status updated.', 'success');
    await loadAccountDirectory();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
window.toggleStatus = toggleStatus;

// Required for Test 7.3 & 7.4 Compatibility
window.openAdminDeptModal = async function(deptId) {
  const modal = document.getElementById('admin-dept-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  modal.classList.add('open');

  try {
    const res = await apiCall(`/departments/${deptId}`);
    if (!res || !res.success) throw new Error(res ? res.message : 'Failed to fetch department');

    const { department, faculty, students, summary } = res.data;

    document.getElementById('admin-dept-modal-title').textContent = department.name;
    document.getElementById('admin-dept-modal-code').textContent = department.code;
    document.getElementById('admin-dept-stat-students').textContent = summary.totalStudents;
    document.getElementById('admin-dept-stat-faculty').textContent = summary.totalFaculty;
    document.getElementById('admin-dept-stat-mentored').textContent = summary.mentoredCount;
    document.getElementById('admin-dept-stat-unassigned').textContent = summary.unassignedCount;

    const hodAvatar = document.getElementById('admin-dept-hod-avatar');
    const hodName = document.getElementById('admin-dept-hod-name');
    const hodDetails = document.getElementById('admin-dept-hod-details');

    if (department.active_hod_name) {
      hodName.textContent = department.active_hod_name;
      hodDetails.textContent = `Staff Code: ${department.active_hod_code || 'HOD'} • Email: ${department.active_hod_email || 'hod@ats.edu'}`;
      if (hodAvatar) hodAvatar.src = department.active_hod_avatar || getInitialsAvatar(department.active_hod_name, 48);
    } else {
      hodName.textContent = 'No Active HOD Assigned';
      hodDetails.textContent = 'Designation vacant. Use administrative assignment tool to designate leadership.';
      if (hodAvatar) hodAvatar.src = getInitialsAvatar('Vacant', 48);
    }

    document.getElementById('admin-dept-faculty-count-text').textContent = `${faculty.length} Faculty`;
    const fTbody = document.getElementById('admin-dept-faculty-table-body');
    if (faculty.length === 0) {
      fTbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 18px; color: var(--text-dim);">No faculty registered in this department.</td></tr>';
    } else {
      fTbody.innerHTML = faculty.map(f => `
        <tr>
          <td><strong style="color: #fff;">${f.name}</strong></td>
          <td style="font-family:monospace; color:var(--accent-cyan);">${f.faculty_code}</td>
          <td>${f.designation || 'Faculty'}</td>
          <td>${f.email}</td>
          <td><span class="badge">${f.mentee_count || 0} Mentees</span></td>
        </tr>
      `).join('');
    }

    document.getElementById('admin-dept-student-count-text').textContent = `${students.length} Students`;
    const sTbody = document.getElementById('admin-dept-students-table-body');
    if (students.length === 0) {
      sTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 18px; color: var(--text-dim);">No students enrolled in this department.</td></tr>';
    } else {
      sTbody.innerHTML = students.map(s => `
        <tr>
          <td><strong style="color: #fff;">${s.name}</strong></td>
          <td style="font-family:monospace; color:var(--accent-cyan);">${s.register_number}</td>
          <td>${s.year || 'III Year'} • ${s.semester || 'Sem 1'}</td>
          <td><strong>${Number(s.cgpa || 0).toFixed(2)}</strong></td>
          <td>${Number(s.attendance_percentage || 0).toFixed(0)}%</td>
          <td>${s.mentor_name ? `<strong style="color:#38bdf8;">${s.mentor_name}</strong>` : '<span style="color:#f87171;">Unassigned</span>'}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.closeAdminDeptModal = function() {
  const modal = document.getElementById('admin-dept-modal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('open');
  }
};

// Audit Anomaly Scanner
async function scanAuditAnomalies() {
  const btn = document.getElementById('btn-scan-anomalies');
  if (btn) btn.disabled = true;

  try {
    const res = await apiCall('/audit-logs/scan-anomalies', 'POST');
    const container = document.getElementById('audit-anomaly-container');
    const detailsEl = document.getElementById('audit-anomaly-details');
    if (container && detailsEl) {
      container.style.display = 'block';
      const anomalies = res.anomalies || [];
      if (anomalies.length === 0) {
        detailsEl.innerHTML = '<div style="color: #34d399; font-weight: 600;">✅ Zero security anomalies detected! All operational patterns conform to normative operational thresholds.</div>';
      } else {
        detailsEl.innerHTML = `
          <div style="margin-bottom: 8px; font-weight: 700; color: #fbbf24;">Found ${anomalies.length} alerts requiring inspection:</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${anomalies.map(a => `
              <div style="background: rgba(0,0,0,0.25); border-left: 3px solid #fbbf24; padding: 8px 12px; border-radius: 4px;">
                <strong>${escapeHtml(a.pattern)}</strong>
                <div>${escapeHtml(a.description)}</div>
              </div>
            `).join('')}
          </div>
        `;
      }
    }
  } catch (err) {
    showToast('Failed to scan anomalies: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
window.scanAuditAnomalies = scanAuditAnomalies;

function dismissAnomalyBox() {
  const container = document.getElementById('audit-anomaly-container');
  if (container) container.style.display = 'none';
}
window.dismissAnomalyBox = dismissAnomalyBox;

async function exportAuditLogs(format) {
  try {
    const token = getToken();
    const res = await fetch(`${API_BASE_URL}/audit-logs/export?format=${format}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Export failed with HTTP status ${res.status}`);

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ats_academic_integrity_audit_${new Date().toISOString().slice(0,10)}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    showToast(`Audit log successfully exported as ${format.toUpperCase()}`, 'success');
  } catch (err) {
    showToast('Failed to export audit log: ' + err.message, 'error');
  }
}
window.exportAuditLogs = exportAuditLogs;

function filterAuditTable() {
  const q = (document.getElementById('audit-search-input').value || '').toLowerCase().trim();
  const action = document.getElementById('audit-action-filter').value;

  let filtered = allAuditLogs;
  if (action !== 'all') {
    filtered = filtered.filter(l => l.action === action);
  }
  if (q) {
    filtered = filtered.filter(l =>
      (l.user_email && l.user_email.toLowerCase().includes(q)) ||
      (l.action && l.action.toLowerCase().includes(q)) ||
      (l.reason && l.reason.toLowerCase().includes(q)) ||
      (l.entity_type && l.entity_type.toLowerCase().includes(q))
    );
  }
  renderAuditTable(filtered);
}
window.filterAuditTable = filterAuditTable;

function exportAdminReport(type) {
  showToast(`Generating ${type} report for download... 📥`, 'info');
  let csvContent = 'data:text/csv;charset=utf-8,';

  if (type === 'accounts') {
    csvContent += 'User ID,Name,Email,Register Number,Role,Department,Status\n';
    allUsers.forEach(u => {
      csvContent += `"${u.id}","${u.name}","${u.email}","${u.register_number || ''}","${u.role}","${u.department || 'General'}","${u.is_active ? 'Active' : 'Inactive'}"\n`;
    });
  } else if (type === 'departments') {
    csvContent += 'Department ID,Name,Code,Active HOD,Scholars,Faculty\n';
    allDepartments.forEach(d => {
      csvContent += `"${d.id}","${d.name}","${d.code}","${d.active_hod_name || 'Vacant'}","${d.student_count || 0}","${d.faculty_count || 0}"\n`;
    });
  }

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `admin_${type}_report_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Report downloaded successfully!', 'success');
}
window.exportAdminReport = exportAdminReport;

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
