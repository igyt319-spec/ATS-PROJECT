// Head of Department (HOD) Console Controller - Department-Only Isolation
let departmentStudents = [];
let departmentMentors = [];
let departmentFaculty = [];
let allDeptResults = [];
let currentResultFilter = 'all';
let currentHODData = null;
let currentDepartmentId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth('hod');
  if (!user) return;
  if (user.departmentId) currentDepartmentId = user.departmentId;

  initLayout();

  const titleEl = document.getElementById('page-dept-title');
  if (titleEl && user.department) {
    titleEl.textContent = `${user.department} — HOD Console`;
  }

  // Load Authentic HOD Leadership Profile for Sector 1
  await loadHODLeadershipIdentity();

  // Load Department Data
  await loadAllHODData();

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
    openHODMiniDashboard(currentHODData, { departmentName: currentHODData.department });
  } else {
    showToast('HOD details not loaded yet.', 'info');
  }
};

async function loadAllHODData() {
  await Promise.all([
    loadAllocations(),
    loadDepartmentResults(),
    loadDepartmentLeaves(),
    loadDepartmentFees()
  ]);
  await loadDepartmentTwin();
}

async function loadAllocations() {
  try {
    const res = await apiCall('/mentors/department-allocations');
    departmentStudents = res.students || [];
    departmentMentors = res.mentors || [];
    departmentFaculty = res.faculty || res.mentors || [];
    if (res.departmentId) currentDepartmentId = res.departmentId;

    // Sector 1 KPIs
    document.getElementById('kpi-dept-students').textContent = departmentStudents.length;
    document.getElementById('kpi-dept-faculty').textContent = departmentFaculty.length;
    const mentorsSub = document.getElementById('kpi-dept-mentors-sub');
    if (mentorsSub) mentorsSub.textContent = `${departmentMentors.length} Authorized Mentors`;

    const countBadge = document.getElementById('faculty-count-badge');
    if (countBadge) countBadge.textContent = `${departmentFaculty.length} Department Faculty`;

    // Render Sector 2: Faculty Roster
    renderFacultyCards(departmentFaculty);

    // Render Sector 3: Students Roster
    renderAllocationsTable(departmentStudents);

    populateMentorDropdown(departmentMentors);
  } catch (err) {
    console.error('[HOD Load Allocations Error]', err);
    document.getElementById('allocations-table-body').innerHTML = `<tr><td colspan="6" style="text-align: center; color: #f87171;">Failed to load records: ${err.message}</td></tr>`;
  }
}

// Sector 2: Render Department Faculty Roster
function renderFacultyCards(facultyList) {
  const container = document.getElementById('dept-faculty-cards-container');
  if (!facultyList || facultyList.length === 0) {
    container.innerHTML = '<div style="color: var(--text-dim); font-size: 0.85rem; padding: 20px; text-align: center; grid-column: 1 / -1;">No faculty members registered in this department yet.</div>';
    return;
  }

  container.innerHTML = facultyList.map(f => {
    const avatarSrc = f.avatar || getInitialsAvatar(f.name, 48);
    const isHod = Boolean(f.is_hod);
    const rolePill = isHod 
      ? '<span class="badge" style="background: rgba(250,204,21,0.15); color: #facc15; font-size: 0.72rem; padding: 2px 7px;">👑 HOD</span>'
      : (f.can_mentor ? '<span class="badge" style="background: rgba(34,197,94,0.15); color: #4ade80; font-size: 0.72rem; padding: 2px 7px;">Mentor</span>' : '<span class="badge" style="background: rgba(255,255,255,0.06); font-size: 0.72rem; padding: 2px 7px;">Faculty</span>');

    return `
      <div style="background: var(--bg-surface, #1e293b); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); border-radius: var(--radius-sm, 10px); padding: 16px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <img src="${avatarSrc}" alt="${f.name}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid ${isHod ? '#facc15' : '#38bdf8'};" onerror="this.src='${getInitialsAvatar(f.name, 48)}'">
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <strong style="color: #fff; font-size: 0.92rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${f.name}</strong>
              ${rolePill}
            </div>
            <div style="font-size: 0.76rem; color: var(--text-dim); margin-top: 2px;">${f.designation || 'Faculty Member'}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">${f.email || ''}</div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 10px; margin-top: 2px;">
          <span class="kpi-pill pill-blue" style="font-size: 0.72rem;">
            ${f.mentee_count || 0} Assigned Mentees
          </span>
          <button class="btn btn-secondary btn-sm" id="btn-fac-mini-${f.id}" onclick="openFacultyMiniDashboard(${f.id})" style="font-size: 0.74rem; padding: 4px 10px;">
            👤 Faculty Mini-Dashboard
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Sector 3: Render Department Students Roster
function renderAllocationsTable(students) {
  const tbody = document.getElementById('allocations-table-body');
  if (!students || students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--text-dim);">No students enrolled in this department.</td></tr>';
    return;
  }

  tbody.innerHTML = students.map(s => {
    const avatarSrc = s.avatar || getInitialsAvatar(s.student_name);
    const hasMentor = Boolean(s.mentor_name);
    const mentorBadge = hasMentor
      ? `<strong style="color: #38bdf8;">${s.mentor_name}</strong><div style="font-size: 0.72rem; color: var(--text-dim);">${s.mentor_email || ''}</div>`
      : `<span class="kpi-pill pill-red">Unassigned</span>`;

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${avatarSrc}" alt="${s.student_name}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-color);" onerror="this.src='${getInitialsAvatar(s.student_name)}'">
            <div>
              <strong style="color: #fff;">${s.student_name}</strong>
              <div style="font-size: 0.75rem; color: var(--text-dim);">${s.email}</div>
            </div>
          </div>
        </td>
        <td><strong style="color: var(--accent-cyan); font-family: monospace;">${s.register_number}</strong></td>
        <td>${s.year || 'III Year'}<br><span style="font-size: 0.75rem; color: var(--text-dim);">${s.semester || 'Semester 1'}</span></td>
        <td>${mentorBadge}</td>
        <td>${s.assigned_at ? formatDate(s.assigned_at) : '—'}</td>
        <td>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="btn btn-primary" id="btn-hod-student-mini-${s.student_id}" style="padding: 5px 10px; font-size: 0.75rem; font-weight:700;" onclick="openStudentMiniDashboard(${s.student_id})">
              📊 Mini-Dashboard
            </button>
            <button class="btn btn-secondary" style="padding: 5px 10px; font-size: 0.75rem;" onclick="openReassignModal(${s.student_id}, '${escapeHtml(s.student_name)}', '${s.register_number}', ${s.mentor_faculty_id || 'null'})">
              ${hasMentor ? '🔄 Reassign' : '➕ Assign'}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterDepartmentStudents() {
  const query = (document.getElementById('student-search-input').value || '').toLowerCase().trim();
  if (!query) {
    renderAllocationsTable(departmentStudents);
    return;
  }
  const filtered = departmentStudents.filter(s =>
    (s.student_name || '').toLowerCase().includes(query) ||
    (s.register_number || '').toLowerCase().includes(query) ||
    (s.email || '').toLowerCase().includes(query)
  );
  renderAllocationsTable(filtered);
}

function populateMentorDropdown(mentors) {
  const select = document.getElementById('reassign-mentor-select');
  if (!select) return;
  select.innerHTML = '<option value="">-- Choose active mentor --</option>' +
    mentors.map(m => `<option value="${m.id}">${m.name} (${m.mentee_count || 0} active mentees)</option>`).join('');
}

function openReassignModal(studentId, name, regno, currentMentorId) {
  document.getElementById('reassign-student-id').value = studentId;
  document.getElementById('reassign-student-info').innerHTML = `
    <strong>Scholar:</strong> ${name} (<span style="color: var(--accent-cyan);">${regno}</span>)
  `;
  const select = document.getElementById('reassign-mentor-select');
  if (currentMentorId) select.value = currentMentorId;
  else select.value = '';
  openModal('reassign-modal');
}

async function triggerAutoAssign() {
  if (!confirm('Execute deterministic round-robin mentor auto-assignment for unassigned students in your department?')) {
    return;
  }

  const btn = document.getElementById('btn-auto-assign');
  btn.disabled = true;
  btn.textContent = 'Allocating... ⏳';

  try {
    const res = await apiCall('/mentors/auto-assign-department', 'POST', {});
    showToast(res.message, 'success');
    await loadAllocations();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '⚡ Deterministic Auto-Assign';
  }
}

async function loadDepartmentResults() {
  try {
    const res = await apiCall('/results/department');
    allDeptResults = res.data || [];
    renderDeptResultsTable();
  } catch (err) {
    console.error('[HOD Load Results Error]', err);
    document.getElementById('dept-results-table-body').innerHTML = `<tr><td colspan="9" style="text-align: center; color: #f87171;">Failed to load results: ${err.message}</td></tr>`;
  }
}

function filterDepartmentResults(type) {
  currentResultFilter = type;
  document.querySelectorAll('#results-filter-pills .tab-pill').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase().includes(type) || (type === 'all' && btn.textContent.includes('All')));
  });
  renderDeptResultsTable();
}

function renderDeptResultsTable() {
  const tbody = document.getElementById('dept-results-table-body');
  if (!tbody) return;
  let list = allDeptResults;
  if (currentResultFilter !== 'all') {
    list = allDeptResults.filter(r => r.assessment_type === currentResultFilter);
  }

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 24px; color: var(--text-dim);">No department results found for this filter.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(r => {
    const isPass = r.status === 'Pass';
    const pillClass = isPass ? 'pill-green' : 'pill-red';
    const typeLabel = r.assessment_type === 'internal' ? 'Internal' : r.assessment_type === 'lab' ? 'Lab Practical' : 'Semester';

    return `
      <tr>
        <td>
          <strong>${r.student_name}</strong>
          <div style="font-size: 0.75rem; color: var(--text-dim);">${r.register_number}</div>
        </td>
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
        <td>${r.is_published ? '✅ Yes' : '⏳ No'}</td>
      </tr>
    `;
  }).join('');
}

async function loadDepartmentLeaves() {
  try {
    const res = await apiCall('/leave/department');
    const leaves = res.data || [];

    const pending = leaves.filter(l => l.status === 'Pending').length;
    document.getElementById('kpi-dept-leaves').textContent = pending;

    const tbody = document.getElementById('dept-leaves-table-body');
    if (!tbody) return;
    if (leaves.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-dim);">No leave requests found in your department.</td></tr>';
      return;
    }

    tbody.innerHTML = leaves.map(l => {
      const pillClass = l.status === 'Approved' ? 'pill-green' : l.status === 'Rejected' ? 'pill-red' : 'pill-yellow';

      return `
        <tr>
          <td>
            <strong>${l.student_name}</strong>
            <div style="font-size: 0.75rem; color: var(--text-dim);">${l.register_number}</div>
          </td>
          <td><span class="kpi-pill pill-blue">${l.leave_type}</span></td>
          <td>${formatDate(l.start_date)} to ${formatDate(l.end_date)}</td>
          <td style="max-width: 220px; font-size: 0.85rem;">${escapeHtml(l.reason)}</td>
          <td><span class="kpi-pill ${pillClass}">${l.status}</span></td>
          <td>${l.reviewed_by_name || 'Pending Review'}</td>
          <td style="font-size: 0.82rem; color: var(--text-dim);">${l.remarks || '—'}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('[HOD Load Leaves Error]', err);
    document.getElementById('dept-leaves-table-body').innerHTML = `<tr><td colspan="7" style="text-align: center; color: #f87171;">Failed to load leaves: ${err.message}</td></tr>`;
  }
}

async function loadDepartmentFees() {
  try {
    const res = await apiCall('/fees/department');
    const fees = res.data || [];
    const summary = res.summary || { totalBalance: 0 };

    document.getElementById('kpi-dept-fees').textContent = `₹${Number(summary.totalBalance).toLocaleString('en-IN')}`;

    const tbody = document.getElementById('dept-fees-table-body');
    if (!tbody) return;
    if (fees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 24px; color: var(--text-dim);">No fee records found in this department.</td></tr>';
      return;
    }

    tbody.innerHTML = fees.map(f => {
      const isPaid = f.status === 'Paid';
      const isPart = f.status === 'Partially Paid';
      const pillClass = isPaid ? 'pill-green' : isPart ? 'pill-yellow' : 'pill-red';

      return `
        <tr>
          <td>
            <strong>${f.student_name}</strong>
            <div style="font-size: 0.75rem; color: var(--text-dim);">${f.register_number}</div>
          </td>
          <td><strong>${f.fee_category}</strong></td>
          <td>${f.academic_year || '2026-2027'} (${f.semester || 'Sem 1'})</td>
          <td>₹${Number(f.total_amount).toLocaleString('en-IN')}</td>
          <td style="color: #34d399;">₹${Number(f.paid_amount).toLocaleString('en-IN')}</td>
          <td style="color: ${Number(f.balance_amount) > 0 ? '#f87171' : '#34d399'}; font-weight: 700;">₹${Number(f.balance_amount).toLocaleString('en-IN')}</td>
          <td><span class="kpi-pill ${pillClass}">${f.status}</span></td>
          <td>${f.due_date ? formatDate(f.due_date) : '—'}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('[HOD Load Fees Error]', err);
    document.getElementById('dept-fees-table-body').innerHTML = `<tr><td colspan="8" style="text-align: center; color: #f87171;">Failed to load fees: ${err.message}</td></tr>`;
  }
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

async function loadDepartmentTwin() {
  const deptId = currentDepartmentId || (currentHODData && currentHODData.department_id) || (JSON.parse(localStorage.getItem('user') || '{}').departmentId);
  if (!deptId) return;

  try {
    const res = await apiCall(`/college-twin/department/${deptId}`);
    if (!res.success || !res.departmentTwin) return;

    const twin = res.departmentTwin;
    const metrics = twin.metrics || {};
    const attDist = twin.attendanceDistribution || { good: 0, monitor: 0, risk: 0 };
    const riskDist = twin.riskDistribution || { LOW: 0, MEDIUM: 0, HIGH: 0 };
    const actStats = twin.activityVerificationStats || { verified: 0, pending: 0, rejected: 0 };

    // Update KPI values
    const cgpaEl = document.getElementById('twin-dept-cgpa');
    if (cgpaEl) cgpaEl.textContent = metrics.averageCgpa != null ? Number(metrics.averageCgpa).toFixed(2) : '—';

    const attEl = document.getElementById('twin-dept-att');
    if (attEl) attEl.textContent = metrics.averageAttendance != null ? `${Number(metrics.averageAttendance).toFixed(1)}%` : '—';

    const riskEl = document.getElementById('twin-dept-att-risk');
    if (riskEl) riskEl.textContent = attDist.risk || 0;

    const actEl = document.getElementById('twin-dept-act-verified');
    if (actEl) actEl.textContent = actStats.verified || 0;

    const actPendingEl = document.getElementById('twin-dept-act-pending');
    if (actPendingEl) actPendingEl.textContent = `${actStats.pending || 0} Pending Review`;

    // Render Attendance Distribution Bars
    const totalStudents = (attDist.good + attDist.monitor + attDist.risk) || 1;
    const goodPct = Math.round((attDist.good / totalStudents) * 100);
    const monPct = Math.round((attDist.monitor / totalStudents) * 100);
    const riskPct = Math.round((attDist.risk / totalStudents) * 100);

    const attContainer = document.getElementById('twin-att-distribution-container');
    if (attContainer) {
      attContainer.innerHTML = `
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 4px;">
            <span style="color: #34d399;">Good Compliance (&ge; 85%)</span>
            <strong style="color: #fff;">${attDist.good} (${goodPct}%)</strong>
          </div>
          <div style="height: 8px; border-radius: 4px; background: rgba(255,255,255,0.08); overflow: hidden;">
            <div style="width: ${goodPct}%; height: 100%; background: #34d399; border-radius: 4px;"></div>
          </div>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 4px;">
            <span style="color: #fbbf24;">Monitor Zone (75% - 84%)</span>
            <strong style="color: #fff;">${attDist.monitor} (${monPct}%)</strong>
          </div>
          <div style="height: 8px; border-radius: 4px; background: rgba(255,255,255,0.08); overflow: hidden;">
            <div style="width: ${monPct}%; height: 100%; background: #fbbf24; border-radius: 4px;"></div>
          </div>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 4px;">
            <span style="color: #f87171;">Critical Attendance Risk (&lt; 75%)</span>
            <strong style="color: #fff;">${attDist.risk} (${riskPct}%)</strong>
          </div>
          <div style="height: 8px; border-radius: 4px; background: rgba(255,255,255,0.08); overflow: hidden;">
            <div style="width: ${riskPct}%; height: 100%; background: #f87171; border-radius: 4px;"></div>
          </div>
        </div>
      `;
    }

    // Render Academic Risk Distribution
    const totalRisk = (riskDist.LOW + riskDist.MEDIUM + riskDist.HIGH) || 1;
    const lowPct = Math.round((riskDist.LOW / totalRisk) * 100);
    const medPct = Math.round((riskDist.MEDIUM / totalRisk) * 100);
    const highPct = Math.round((riskDist.HIGH / totalRisk) * 100);

    const riskContainer = document.getElementById('twin-risk-distribution-container');
    if (riskContainer) {
      riskContainer.innerHTML = `
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 4px;">
            <span style="color: #38bdf8;">Low Risk (Stable Academic Trajectory)</span>
            <strong style="color: #fff;">${riskDist.LOW} (${lowPct}%)</strong>
          </div>
          <div style="height: 8px; border-radius: 4px; background: rgba(255,255,255,0.08); overflow: hidden;">
            <div style="width: ${lowPct}%; height: 100%; background: #38bdf8; border-radius: 4px;"></div>
          </div>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 4px;">
            <span style="color: #fbbf24;">Medium Risk (Targeted Mentorship Advisable)</span>
            <strong style="color: #fff;">${riskDist.MEDIUM} (${medPct}%)</strong>
          </div>
          <div style="height: 8px; border-radius: 4px; background: rgba(255,255,255,0.08); overflow: hidden;">
            <div style="width: ${medPct}%; height: 100%; background: #fbbf24; border-radius: 4px;"></div>
          </div>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 4px;">
            <span style="color: #f87171;">High Academic Risk (Critical Remedial Focus)</span>
            <strong style="color: #fff;">${riskDist.HIGH} (${highPct}%)</strong>
          </div>
          <div style="height: 8px; border-radius: 4px; background: rgba(255,255,255,0.08); overflow: hidden;">
            <div style="width: ${highPct}%; height: 100%; background: #f87171; border-radius: 4px;"></div>
          </div>
        </div>
      `;
    }

    // Render Multi-Semester GPA Trajectory
    const semTbody = document.getElementById('twin-sem-trends-tbody');
    if (semTbody) {
      const semTrends = twin.semesterTrends || [];
      if (semTrends.length === 0) {
        semTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 16px; color: var(--text-dim);">No historical semester records found for this cohort.</td></tr>';
      } else {
        semTbody.innerHTML = semTrends.map(st => `
          <tr>
            <td><strong>Semester ${st.semester_num}</strong></td>
            <td>${st.student_count} Scholars</td>
            <td>${Number(st.mean_marks || 0).toFixed(1)} / 100</td>
            <td><strong style="color: #38bdf8;">${Number(st.mean_gpa || 0).toFixed(2)}</strong></td>
          </tr>
        `).join('');
      }
    }

    // Render Subject-Level Analytics
    const subTbody = document.getElementById('twin-subjects-tbody');
    if (subTbody) {
      const subjects = twin.subjectPerformance || [];
      if (subjects.length === 0) {
        subTbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 16px; color: var(--text-dim);">No subject performance records available.</td></tr>';
      } else {
        subTbody.innerHTML = subjects.map(s => `
          <tr>
            <td style="font-family: monospace; color: var(--accent-cyan);">${escapeHtml(s.code)}</td>
            <td><strong>${escapeHtml(s.name)}</strong></td>
            <td>${s.credits}</td>
            <td>${s.enrolledCount}</td>
            <td>${s.averageMark}</td>
            <td>
              <span class="kpi-pill ${s.passRate >= 75 ? 'pill-green' : s.passRate >= 50 ? 'pill-yellow' : 'pill-red'}">
                ${s.passRate}%
              </span>
            </td>
            <td><span style="color: #a855f7; font-weight: 700;">${s.distinctionCount}</span></td>
          </tr>
        `).join('');
      }
    }

    // Render Faculty Mentorship Workload
    const facTbody = document.getElementById('twin-faculty-workload-tbody');
    if (facTbody) {
      const faculty = twin.facultyWorkload || [];
      if (faculty.length === 0) {
        facTbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 16px; color: var(--text-dim);">No faculty registered in department.</td></tr>';
      } else {
        facTbody.innerHTML = faculty.map(f => {
          const ratio = f.assignedMentees;
          const statusPill = ratio > 25 
            ? '<span class="kpi-pill pill-red">High Bandwidth</span>' 
            : ratio >= 10 
            ? '<span class="kpi-pill pill-yellow">Moderate</span>' 
            : '<span class="kpi-pill pill-green">Optimal</span>';

          return `
            <tr>
              <td>
                <div style="font-weight: 700; color: #fff;">${escapeHtml(f.name)} ${f.isHod ? '<span class="badge" style="background: rgba(250,204,21,0.15); color: #facc15; font-size: 0.65rem;">HOD</span>' : ''}</div>
                <div style="font-size: 0.72rem; color: var(--text-dim);">${escapeHtml(f.email || '')}</div>
              </td>
              <td>${escapeHtml(f.designation || 'Faculty')}</td>
              <td><strong style="color: #38bdf8;">${f.assignedMentees} Mentees</strong></td>
              <td><span style="color: ${f.pendingVerifications > 0 ? '#fbbf24' : 'var(--text-dim)'};">${f.pendingVerifications} Pending</span></td>
              <td>${statusPill}</td>
            </tr>
          `;
        }).join('');
      }
    }

  } catch (err) {
    console.error('[Load Department Twin Error]', err);
  }
}

window.loadDepartmentTwin = loadDepartmentTwin;

