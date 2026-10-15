/**
 * ATS System Administrator Console Controller
 * Dedicated exclusively to Account Creation, Lifecycle Maintenance, and Access Governance.
 * Operational dashboards (student dossiers, marks, attendance, leaves) are blocked.
 */

let allUsers = [];
let allDepartments = [];

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
    loadAccountDirectory()
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
      <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 800; color: #fff; font-size: 1rem;">${d.name}</span>
          <span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8;">${d.code}</span>
        </div>
        <div style="font-size: 0.78rem; color: var(--text-dim);">
          Department ID: #${d.id} • Active HOD: <strong style="color: #facc15;">${d.active_hod_name || 'Unassigned'}</strong>
        </div>
        <div style="display: flex; gap: 12px; font-size: 0.78rem; color: #94a3b8; margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;">
          <div>Faculty: <strong style="color:#fff;">${d.faculty_count || 0}</strong></div>
          <div>Students: <strong style="color:#fff;">${d.student_count || 0}</strong></div>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
