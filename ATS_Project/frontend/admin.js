/**
 * ATS System Administrator Console Controller
 * Dedicated exclusively to Account Creation, Lifecycle Maintenance, and Access Governance.
 * Operational dashboards (student dossiers, marks, attendance, leaves) are blocked.
 */

let allUsers = [];
let allDepartments = [];
let allAuditLogs = [];

document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth('admin');
  if (!user) return;
  initLayout();

  // Set today's date in header
  const dateEl = document.getElementById('topbar-current-date');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  await Promise.all([
    loadDepartments(),
    loadAccountDirectory(),
    loadInstitutionalTwin(),
    loadAuditLogs()
  ]);
});

/**
 * Fetch and populate department select dropdowns and structural cards
 */
async function loadDepartments() {
  try {
    const res = await apiCall('/departments');
    allDepartments = (res && res.data) ? res.data : [];

    // Populate create user department select
    const createDeptSelect = document.getElementById('create-department-id');
    if (createDeptSelect) {
      createDeptSelect.innerHTML = '<option value="">-- Select Department --</option>' +
        allDepartments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
    }

    // Populate modal department select
    const modalDeptSelect = document.getElementById('dept-modal-select');
    if (modalDeptSelect) {
      modalDeptSelect.innerHTML = '<option value="">-- Select Department --</option>' +
        allDepartments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
    }

    renderDepartmentOverview(allDepartments);
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

/**
 * Update top KPI counters
 */
function updateKpis(users) {
  const total = users.length;
  const active = users.filter(u => u.is_active === 1).length;
  const inactive = users.filter(u => u.is_active === 0).length;
  const students = users.filter(u => u.role === 'student').length;
  const faculty = users.filter(u => u.role === 'faculty').length;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setVal('kpi-total-users', total);
  setVal('kpi-active-users', active);
  setVal('kpi-inactive-users', inactive);
  setVal('kpi-student-users', students);
  setVal('kpi-faculty-users', faculty);
}

/**
 * Filter directory table based on search input and dropdown filters
 */
function filterUserTable() {
  const searchInput = document.getElementById('admin-user-search');
  const roleSelect = document.getElementById('admin-filter-role');
  const statusSelect = document.getElementById('admin-filter-status');

  const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const selectedRole = roleSelect ? roleSelect.value : 'all';
  const selectedStatus = statusSelect ? statusSelect.value : 'all';

  let filtered = allUsers;

  if (selectedRole !== 'all') {
    filtered = filtered.filter(u => u.role.toLowerCase() === selectedRole.toLowerCase());
  }

  if (selectedStatus !== 'all') {
    const statusVal = selectedStatus === 'active' ? 1 : 0;
    filtered = filtered.filter(u => u.is_active === statusVal);
  }

  if (q) {
    filtered = filtered.filter(u =>
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.register_number && u.register_number.toLowerCase().includes(q)) ||
      (u.department && u.department.toLowerCase().includes(q))
    );
  }

  renderUserTable(filtered);
}

/**
 * Render user rows into table
 */
function renderUserTable(users) {
  const tbody = document.getElementById('admin-users-table-body');
  if (!tbody) return;

  if (!users || users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 36px; color: var(--text-dim);">
          No user accounts match the selected filters.
        </td>
      </tr>
    `;
    return;
  }

  const currentUser = getCurrentUser();
  const currentUserId = currentUser ? Number(currentUser.id) : null;

  tbody.innerHTML = users.map(u => {
    const isSelf = currentUserId && Number(u.id) === currentUserId;
    const avatar = u.avatar || getInitialsAvatar(u.name, 40);
    const roleBadge = getRoleBadgeHtml(u.role, u.faculty_role);
    const statusBadge = u.is_active === 1
      ? '<span class="badge" style="background: rgba(34, 197, 94, 0.15); color: #34d399; border: 1px solid rgba(34, 197, 94, 0.3);">Active</span>'
      : '<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3);">Deactivated</span>';

    const toggleBtnText = u.is_active === 1 ? '🚫 Deactivate' : '✅ Activate';
    const toggleBtnClass = u.is_active === 1 ? 'btn-danger' : 'btn-success';

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${avatar}" alt="${u.name}" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-color);">
            <div>
              <div style="font-weight: 700; color: #fff; font-size: 0.88rem;">
                ${u.name} ${isSelf ? '<span style="font-size:0.7rem; color:var(--accent-cyan); font-weight:600;">(You)</span>' : ''}
              </div>
              <div style="font-size: 0.72rem; color: var(--text-dim);">User #${u.id}</div>
            </div>
          </div>
        </td>
        <td style="font-family: monospace; font-size: 0.82rem; color: #e2e8f0;">
          ${u.register_number || '<span style="color:var(--text-dim); font-style:italic;">N/A</span>'}
        </td>
        <td style="font-size: 0.84rem; color: #cbd5e1;">${u.email}</td>
        <td>${roleBadge}</td>
        <td style="font-size: 0.84rem; color: #cbd5e1;">${u.department || 'General'}</td>
        <td>${statusBadge}</td>
        <td style="text-align: right;">
          <div style="display: flex; gap: 6px; justify-content: flex-end; align-items: center; flex-wrap: wrap;">
            ${!isSelf ? `
              <button class="btn btn-sm ${toggleBtnClass}" style="font-size: 0.72rem; padding: 4px 8px;" onclick="toggleAccountStatus(${u.id}, ${u.is_active})">
                ${toggleBtnText}
              </button>
            ` : ''}
            <button class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 4px 8px;" onclick="openResetPasswordModal(${u.id}, '${escapeHtml(u.name)}')">
              🔑 Reset Pwd
            </button>
            <button class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 4px 8px;" onclick="openDeptUpdateModal(${u.id}, '${escapeHtml(u.name)}', ${u.department_id || 'null'})">
              🏛️ Dept
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function getRoleBadgeHtml(role, facultyRole) {
  const r = (role || '').toLowerCase();
  if (r === 'admin') {
    return '<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3);">Administrator</span>';
  } else if (r === 'faculty') {
    if (facultyRole === 'hod') {
      return '<span class="badge" style="background: rgba(250, 204, 21, 0.15); color: #facc15; border: 1px solid rgba(250, 204, 21, 0.3);">HOD / Faculty</span>';
    }
    return '<span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);">Faculty</span>';
  } else {
    return '<span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3);">Student</span>';
  }
}

/**
 * Handle Account Creation Form Submit
 */
async function handleCreateUser(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit-create');
  if (btn) btn.disabled = true;

  try {
    const name = document.getElementById('create-name').value.trim();
    const email = document.getElementById('create-email').value.trim();
    const role = document.getElementById('create-role').value;
    const register_number = document.getElementById('create-register-number').value.trim();
    const department_id = document.getElementById('create-department-id').value;
    const designation = document.getElementById('create-designation') ? document.getElementById('create-designation').value.trim() : null;
    const phone = document.getElementById('create-phone') ? document.getElementById('create-phone').value.trim() : null;
    const password = document.getElementById('create-password') ? document.getElementById('create-password').value.trim() : null;

    if (!name || !email || !role || !department_id) {
      showToast('Please fill in all mandatory fields.', 'error');
      if (btn) btn.disabled = false;
      return;
    }

    const payload = {
      name,
      email,
      role,
      register_number,
      department_id: parseInt(department_id, 10),
      designation: designation || undefined,
      phone: phone || undefined,
      password: password || undefined
    };

    const res = await apiCall('/auth/users', 'POST', payload);
    if (!res || !res.success) {
      throw new Error(res ? res.message : 'Account creation failed');
    }

    showToast(`Account successfully created for ${name}! Temporary Password: ${res.temporaryPassword}`, 'success');

    // Reset form
    document.getElementById('create-user-form').reset();
    toggleRoleSpecificFields();

    // Reload directory
    await loadAccountDirectory();

    // Scroll to accounts section
    const sec = document.getElementById('accounts-section');
    if (sec) sec.scrollIntoView({ behavior: 'smooth' });

  } catch (err) {
    console.error('[Create User Error]', err);
    showToast(err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/**
 * Toggle dynamic fields depending on role selection in create form
 */
function toggleRoleSpecificFields() {
  const roleSelect = document.getElementById('create-role');
  const designationGroup = document.getElementById('faculty-designation-group');
  const regLbl = document.getElementById('lbl-register-number');

  if (!roleSelect) return;
  const isFaculty = roleSelect.value === 'faculty';

  if (designationGroup) {
    designationGroup.style.display = isFaculty ? 'block' : 'none';
  }
  if (regLbl) {
    regLbl.innerHTML = isFaculty
      ? 'Faculty Code / Employee ID <span style="color: #f87171;">*</span>'
      : 'Student Registration Number <span style="color: #f87171;">*</span>';
  }
}

/**
 * Toggle account active status (Activate / Deactivate)
 */
async function toggleAccountStatus(userId, currentStatus) {
  const newTarget = currentStatus === 1 ? 0 : 1;
  const actionText = newTarget === 1 ? 'activate' : 'deactivate';

  if (!confirm(`Are you sure you want to ${actionText} user account #${userId}?`)) {
    return;
  }

  try {
    const res = await apiCall(`/auth/users/${userId}/status`, 'PUT', { status: newTarget });
    if (!res || !res.success) throw new Error(res ? res.message : 'Action failed');

    showToast(res.message, 'success');
    await loadAccountDirectory();
  } catch (err) {
    console.error('[Toggle Status Error]', err);
    showToast('Failed to update status: ' + err.message, 'error');
  }
}

/**
 * Open Reset Password Modal
 */
function openResetPasswordModal(userId, userName) {
  const modal = document.getElementById('reset-password-modal');
  const desc = document.getElementById('reset-modal-desc');
  const idInput = document.getElementById('reset-modal-user-id');
  const newPassInput = document.getElementById('reset-modal-new-password');
  const resultDiv = document.getElementById('reset-modal-result');

  if (desc) desc.textContent = `Set or generate a new temporary password for ${userName} (User #${userId}).`;
  if (idInput) idInput.value = userId;
  if (newPassInput) newPassInput.value = '';
  if (resultDiv) resultDiv.style.display = 'none';

  if (modal) modal.style.display = 'flex';
}

function closeResetModal() {
  const modal = document.getElementById('reset-password-modal');
  if (modal) modal.style.display = 'none';
}

async function executePasswordReset() {
  const id = document.getElementById('reset-modal-user-id').value;
  const newPassword = document.getElementById('reset-modal-new-password').value.trim();
  const btn = document.getElementById('btn-confirm-reset');

  if (!id) return;
  if (btn) btn.disabled = true;

  try {
    const payload = newPassword ? { newPassword } : {};
    const res = await apiCall(`/auth/users/${id}/reset-password`, 'PUT', payload);
    if (!res || !res.success) throw new Error(res ? res.message : 'Reset failed');

    const resultDiv = document.getElementById('reset-modal-result');
    const display = document.getElementById('reset-modal-temp-display');
    if (resultDiv && display) {
      display.textContent = `Temporary Password: ${res.temporaryPassword}`;
      resultDiv.style.display = 'block';
    }
    showToast('Password reset successfully!', 'success');
  } catch (err) {
    console.error('[Execute Password Reset Error]', err);
    showToast('Failed to reset password: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/**
 * Open Department Update Modal
 */
function openDeptUpdateModal(userId, userName, currentDeptId) {
  const modal = document.getElementById('dept-update-modal');
  const desc = document.getElementById('dept-modal-desc');
  const idInput = document.getElementById('dept-modal-user-id');
  const select = document.getElementById('dept-modal-select');

  if (desc) desc.textContent = `Assign or change academic department for ${userName} (User #${userId}).`;
  if (idInput) idInput.value = userId;
  if (select && currentDeptId) select.value = currentDeptId;

  if (modal) modal.style.display = 'flex';
}

function closeDeptModal() {
  const modal = document.getElementById('dept-update-modal');
  if (modal) modal.style.display = 'none';
}

async function executeDepartmentUpdate() {
  const id = document.getElementById('dept-modal-user-id').value;
  const department_id = document.getElementById('dept-modal-select').value;

  if (!id || !department_id) {
    showToast('Please select a target department.', 'error');
    return;
  }

  try {
    const res = await apiCall(`/auth/users/${id}/department`, 'PUT', { department_id: parseInt(department_id, 10) });
    if (!res || !res.success) throw new Error(res ? res.message : 'Department update failed');

    showToast(res.message, 'success');
    closeDeptModal();
    await loadAccountDirectory();
  } catch (err) {
    console.error('[Execute Dept Update Error]', err);
    showToast('Failed to update department: ' + err.message, 'error');
  }
}

/**
 * Render Structural Department Overview Cards
 */
function renderDepartmentOverview(departments) {
  const container = document.getElementById('admin-departments-container');
  if (!container) return;

  if (!departments || departments.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 24px; color: var(--text-dim); grid-column: 1 / -1;">
        No academic departments configured.
      </div>
    `;
    return;
  }

  container.innerHTML = departments.map(d => {
    return `
      <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 8px; cursor: pointer; transition: transform 0.2s, border-color 0.2s;" 
           class="dept-overview-card" 
           onclick="openAdminDeptModal(${d.id})"
           onmouseenter="this.style.borderColor='rgba(56, 189, 248, 0.4)'; this.style.transform='translateY(-2px)';"
           onmouseleave="this.style.borderColor='var(--border-color)'; this.style.transform='none';">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 800; color: #fff; font-size: 1rem;">${d.name}</span>
          <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8;">${d.code}</span>
        </div>
        <div style="font-size: 0.78rem; color: var(--text-dim);">
          Department ID: #${d.id} • Active HOD: <strong style="color: #facc15;">${d.active_hod_name || 'Unassigned'}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;">
          <div style="display: flex; gap: 12px; font-size: 0.78rem; color: #94a3b8;">
            <div>Faculty: <strong style="color:#fff;">${d.faculty_count || 0}</strong></div>
            <div>Students: <strong style="color:#fff;">${d.student_count || 0}</strong></div>
          </div>
          <span style="font-size: 0.76rem; color: var(--accent-cyan); font-weight: 700;">View Roster &rarr;</span>
        </div>
      </div>
    `;
  }).join('');
}

window.openAdminDeptModal = async function(deptId) {
  const modal = document.getElementById('admin-dept-modal');
  if (!modal) return;

  // Reset content to loading state
  document.getElementById('admin-dept-modal-title').textContent = 'Loading Department Details...';
  document.getElementById('admin-dept-modal-code').textContent = '...';
  document.getElementById('admin-dept-stat-students').textContent = '—';
  document.getElementById('admin-dept-stat-faculty').textContent = '—';
  document.getElementById('admin-dept-stat-mentored').textContent = '—';
  document.getElementById('admin-dept-stat-unassigned').textContent = '—';
  document.getElementById('admin-dept-faculty-table-body').innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Loading faculty roster... ⏳</td></tr>';
  document.getElementById('admin-dept-students-table-body').innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Loading student scholars... ⏳</td></tr>';

  modal.style.display = 'flex';
  modal.classList.add('open');

  try {
    const res = await apiCall(`/departments/${deptId}`);
    if (!res || !res.success) throw new Error(res ? res.message : 'Failed to fetch department');

    const { department, faculty, students, summary } = res.data;

    // Header info
    document.getElementById('admin-dept-modal-title').textContent = department.name;
    document.getElementById('admin-dept-modal-code').textContent = department.code;

    // Stats
    document.getElementById('admin-dept-stat-students').textContent = summary.totalStudents;
    document.getElementById('admin-dept-stat-faculty').textContent = summary.totalFaculty;
    document.getElementById('admin-dept-stat-mentored').textContent = summary.mentoredCount;
    document.getElementById('admin-dept-stat-unassigned').textContent = summary.unassignedCount;

    // HOD Details
    const hodAvatar = document.getElementById('admin-dept-hod-avatar');
    const hodName = document.getElementById('admin-dept-hod-name');
    const hodDetails = document.getElementById('admin-dept-hod-details');

    if (department.active_hod_name) {
      hodName.textContent = department.active_hod_name;
      hodDetails.textContent = `Staff Code: ${department.active_hod_code || 'HOD'} • Email: ${department.active_hod_email || 'hod@ats.edu'}`;
      if (hodAvatar) {
        hodAvatar.src = department.active_hod_avatar || getInitialsAvatar(department.active_hod_name, 48);
        hodAvatar.onerror = () => { hodAvatar.src = getInitialsAvatar(department.active_hod_name, 48); };
      }
    } else {
      hodName.textContent = 'No Active HOD Assigned';
      hodDetails.textContent = 'Designation vacant. Use administrative assignment tool to designate leadership.';
      if (hodAvatar) hodAvatar.src = getInitialsAvatar('Vacant', 48);
    }

    // Faculty Roster
    document.getElementById('admin-dept-faculty-count-text').textContent = `${faculty.length} Faculty`;
    const fTbody = document.getElementById('admin-dept-faculty-table-body');
    if (faculty.length === 0) {
      fTbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 18px; color: var(--text-dim);">No faculty registered in this department.</td></tr>';
    } else {
      fTbody.innerHTML = faculty.map(f => `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <img src="${f.avatar || getInitialsAvatar(f.name, 32)}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;" onerror="this.src='${getInitialsAvatar(f.name, 32)}'">
              <div>
                <strong style="color: #fff;">${f.name}</strong>
                ${f.is_hod ? '<span class="badge" style="background:rgba(250,204,21,0.15); color:#facc15; font-size:0.68rem; margin-left:4px;">HOD</span>' : ''}
              </div>
            </div>
          </td>
          <td style="font-family:monospace; color:var(--accent-cyan);">${f.faculty_code}</td>
          <td style="font-size:0.82rem;">${f.designation || 'Faculty'}</td>
          <td style="font-size:0.82rem; color:var(--text-dim);">${f.email}</td>
          <td><span class="kpi-pill pill-blue">${f.mentee_count || 0} Mentees</span></td>
        </tr>
      `).join('');
    }

    // Students Roster
    document.getElementById('admin-dept-student-count-text').textContent = `${students.length} Students`;
    const sTbody = document.getElementById('admin-dept-students-table-body');
    if (students.length === 0) {
      sTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 18px; color: var(--text-dim);">No students enrolled in this department.</td></tr>';
    } else {
      sTbody.innerHTML = students.map(s => `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <img src="${s.avatar || getInitialsAvatar(s.name, 32)}" style="width:28px; height:28px; border-radius:50%; object-fit:cover;" onerror="this.src='${getInitialsAvatar(s.name, 32)}'">
              <strong style="color: #fff;">${s.name}</strong>
            </div>
          </td>
          <td style="font-family:monospace; color:var(--accent-cyan); font-size:0.82rem;">${s.register_number}</td>
          <td style="font-size:0.82rem;">${s.year || 'III Year'} &bull; ${s.semester || 'Sem 1'}</td>
          <td><strong style="color: #fff;">${Number(s.cgpa || 0).toFixed(2)}</strong></td>
          <td><span class="kpi-pill ${Number(s.attendance_percentage || 0) >= 75 ? 'pill-green' : 'pill-red'}">${Number(s.attendance_percentage || 0).toFixed(0)}%</span></td>
          <td style="font-size:0.82rem;">
            ${s.mentor_name ? `<strong style="color:#38bdf8;">${s.mentor_name}</strong>` : '<span class="kpi-pill pill-red">Unassigned</span>'}
          </td>
        </tr>
      `).join('');
    }

  } catch (err) {
    console.error('[Open Admin Dept Modal Error]', err);
    showToast('Failed to load department details: ' + err.message, 'error');
    closeAdminDeptModal();
  }
};

window.closeAdminDeptModal = function() {
  const modal = document.getElementById('admin-dept-modal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('open');
  }
};

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

/**
 * =========================================================================
 * FEATURE 4: INSTITUTIONAL COLLEGE DIGITAL TWIN (ADMIN CONSOLE)
 * =========================================================================
 */
async function loadInstitutionalTwin() {
  const tbody = document.getElementById('admin-twin-table-body');
  try {
    const res = await apiCall('/college-twin/institution');
    if (!res || !res.success || !res.institutionTwin) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-dim); padding: 20px;">No institutional data returned.</td></tr>';
      return;
    }

    const twin = res.institutionTwin;
    const kpis = twin.macroKPIs || {};
    const depts = twin.departmentComparisons || [];

    // Macro KPIs
    const deptsEl = document.getElementById('admin-twin-total-depts');
    if (deptsEl) deptsEl.textContent = kpis.totalDepartments != null ? kpis.totalDepartments : depts.length;

    const cgpaEl = document.getElementById('admin-twin-mean-cgpa');
    if (cgpaEl) cgpaEl.textContent = kpis.institutionAverageCgpa != null ? Number(kpis.institutionAverageCgpa).toFixed(2) : '—';

    const attEl = document.getElementById('admin-twin-mean-att');
    if (attEl) attEl.textContent = kpis.institutionAverageAttendance != null ? `${Number(kpis.institutionAverageAttendance).toFixed(1)}%` : '—';

    const riskEl = document.getElementById('admin-twin-high-risk');
    if (riskEl) riskEl.textContent = kpis.totalHighRiskStudents != null ? kpis.totalHighRiskStudents : 0;

    // Render Department Benchmark Table
    if (tbody) {
      if (depts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-dim); padding: 24px;">No departments registered in the institution.</td></tr>';
        return;
      }

      tbody.innerHTML = depts.map(d => {
        const rc = d.riskCounts || { high: 0, medium: 0, low: 0 };
        return `
          <tr>
            <td>
              <strong style="color: #fff;">${escapeHtml(d.name)}</strong>
            </td>
            <td style="font-family: monospace; color: var(--accent-cyan); font-weight: 700;">${escapeHtml(d.code)}</td>
            <td><strong>${d.studentCount}</strong> Scholars</td>
            <td>${d.facultyCount} Faculty</td>
            <td><span class="kpi-pill pill-blue">${d.studentToFacultyRatio} : 1</span></td>
            <td><strong style="color: #38bdf8;">${Number(d.averageCgpa || 0).toFixed(2)}</strong></td>
            <td><span class="kpi-pill ${d.averageAttendance >= 75 ? 'pill-green' : 'pill-red'}">${Number(d.averageAttendance || 0).toFixed(1)}%</span></td>
            <td>
              <div style="display: flex; gap: 6px; align-items: center;">
                <span class="kpi-pill pill-green" title="Low Academic Risk">${rc.low} L</span>
                <span class="kpi-pill pill-yellow" title="Medium Academic Risk">${rc.medium} M</span>
                <span class="kpi-pill pill-red" title="High Academic Risk">${rc.high} H</span>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

  } catch (err) {
    console.error('[Load Institutional Twin Error]', err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #f87171; padding: 20px;">Failed to load institutional twin: ${err.message}</td></tr>`;
  }
}
window.loadInstitutionalTwin = loadInstitutionalTwin;

/**
 * =========================================================================
 * FEATURE 7: SMART ACADEMIC INTEGRITY & AUDIT TRAIL CONTROLLER
 * =========================================================================
 */
async function loadAuditLogs() {
  const tbody = document.getElementById('audit-logs-table-body');
  try {
    const res = await apiCall('/audit-logs?limit=100');
    if (!res || !res.success) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #f87171; padding: 24px;">Failed to retrieve audit events.</td></tr>';
      return;
    }

    allAuditLogs = res.data || [];
    renderAuditLogs(allAuditLogs);

  } catch (err) {
    console.error('[Load Audit Logs Error]', err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #f87171; padding: 24px;">Error connecting to audit service: ${err.message}</td></tr>`;
  }
}
window.loadAuditLogs = loadAuditLogs;

function renderAuditLogs(logs) {
  const tbody = document.getElementById('audit-logs-table-body');
  const countBadge = document.getElementById('audit-count-badge');
  if (countBadge) countBadge.textContent = `Showing ${logs.length} events`;

  if (!tbody) return;
  if (!logs || logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 32px;">No matching audit events found.</td></tr>';
    return;
  }

  tbody.innerHTML = logs.map(l => {
    const timeFormatted = l.created_at ? new Date(l.created_at).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
    }) : '—';

    const actor = l.actor_name || `User #${l.user_id || 'System'}`;
    const rolePill = l.actor_role === 'admin' 
      ? '<span class="badge" style="background: rgba(239,68,68,0.15); color: #f87171; font-size: 0.68rem;">Admin</span>'
      : l.actor_role === 'faculty'
      ? '<span class="badge" style="background: rgba(56,189,248,0.15); color: #38bdf8; font-size: 0.68rem;">Faculty</span>'
      : '<span class="badge" style="background: rgba(168,85,247,0.15); color: #c084fc; font-size: 0.68rem;">Student</span>';

    const statusPill = (l.status === 'SUCCESS' || !l.status)
      ? '<span class="kpi-pill pill-green">SUCCESS</span>'
      : l.status === 'UNAUTHORIZED'
      ? '<span class="kpi-pill pill-red">UNAUTHORIZED</span>'
      : '<span class="kpi-pill pill-yellow">FAILED</span>';

    // Parse and summarize details safely
    let detailsSummary = '—';
    if (l.details) {
      if (typeof l.details === 'string') {
        try {
          const parsed = JSON.parse(l.details);
          detailsSummary = Object.entries(parsed).map(([k, v]) => `<span style="color: var(--accent-cyan);">${escapeHtml(k)}:</span> ${escapeHtml(String(v))}`).join(' • ');
        } catch (_) {
          detailsSummary = escapeHtml(l.details);
        }
      } else if (typeof l.details === 'object') {
        detailsSummary = Object.entries(l.details).map(([k, v]) => `<span style="color: var(--accent-cyan);">${escapeHtml(k)}:</span> ${escapeHtml(String(v))}`).join(' • ');
      }
    }

    return `
      <tr>
        <td style="font-size: 0.78rem; color: var(--text-dim); white-space: nowrap;">${timeFormatted}</td>
        <td>
          <div style="font-weight: 700; color: #fff;">${escapeHtml(actor)}</div>
          <div>${rolePill}</div>
        </td>
        <td>
          <span style="font-family: monospace; font-size: 0.76rem; background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 4px; color: #facc15; border: 1px solid rgba(250,204,21,0.2);">
            ${escapeHtml(l.action)}
          </span>
        </td>
        <td>
          <span style="color: #cbd5e1; font-weight: 600;">${escapeHtml(l.entity || 'system')}</span>
          ${l.entity_id ? `<span style="font-size: 0.72rem; color: var(--text-dim);"> #${l.entity_id}</span>` : ''}
        </td>
        <td>${statusPill}</td>
        <td style="font-size: 0.78rem; color: #94a3b8; max-width: 320px; overflow: hidden; text-overflow: ellipsis;">
          ${detailsSummary}
        </td>
      </tr>
    `;
  }).join('');
}

function filterAuditTable() {
  const searchInput = (document.getElementById('audit-search-input')?.value || '').toLowerCase().trim();
  const actionFilter = document.getElementById('audit-action-filter')?.value || 'all';

  const filtered = allAuditLogs.filter(l => {
    if (actionFilter !== 'all' && l.action !== actionFilter) return false;
    if (searchInput) {
      const matchActor = (l.actor_name || '').toLowerCase().includes(searchInput);
      const matchAction = (l.action || '').toLowerCase().includes(searchInput);
      const matchEntity = (l.entity || '').toLowerCase().includes(searchInput);
      const matchDetails = (typeof l.details === 'string' ? l.details : JSON.stringify(l.details || {})).toLowerCase().includes(searchInput);
      return matchActor || matchAction || matchEntity || matchDetails;
    }
    return true;
  });

  renderAuditLogs(filtered);
}
window.filterAuditTable = filterAuditTable;

async function scanAuditAnomalies() {
  const container = document.getElementById('audit-anomaly-container');
  const detailsEl = document.getElementById('audit-anomaly-details');
  const btn = document.getElementById('btn-scan-anomalies');

  if (btn) btn.disabled = true;

  try {
    const res = await apiCall('/audit-logs/anomalies');
    if (!res || !res.success) {
      showToast(res ? res.message : 'Anomaly scanning failed', 'error');
      return;
    }

    const anomalies = res.anomalies || [];
    if (container && detailsEl) {
      container.style.display = 'block';

      if (anomalies.length === 0) {
        detailsEl.innerHTML = `
          <div style="color: #34d399; font-weight: 600;">
            ✅ Zero security anomalies detected! All operational marks recording, role assignments, and access patterns conform to normative operational thresholds.
          </div>
        `;
      } else {
        detailsEl.innerHTML = `
          <div style="margin-bottom: 8px; font-weight: 700; color: #fbbf24;">
            Found ${anomalies.length} security alerts requiring administrative inspection:
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${anomalies.map(a => `
              <div style="background: rgba(0,0,0,0.25); border-left: 3px solid ${a.severity === 'CRITICAL' ? '#f87171' : '#fbbf24'}; padding: 8px 12px; border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <strong style="color: #fff;">${escapeHtml(a.pattern)}</strong>
                  <span class="badge" style="background: ${a.severity === 'CRITICAL' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}; color: ${a.severity === 'CRITICAL' ? '#f87171' : '#fbbf24'}; font-size: 0.68rem;">${a.severity}</span>
                </div>
                <div style="margin-top: 4px; color: #cbd5e1; font-size: 0.78rem;">${escapeHtml(a.description)}</div>
                ${a.actorId ? `<div style="font-size: 0.72rem; color: var(--accent-cyan); margin-top: 2px;">Actor ID: #${a.actorId}</div>` : ''}
              </div>
            `).join('')}
          </div>
        `;
      }
    }
  } catch (err) {
    console.error('[Scan Anomalies Error]', err);
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
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/audit-logs/export?format=${format}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Export failed with HTTP status ${response.status}`);
    }

    const blob = await response.blob();
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
    console.error('[Export Audit Log Error]', err);
    showToast('Failed to export audit log: ' + err.message, 'error');
  }
}
window.exportAuditLogs = exportAuditLogs;

