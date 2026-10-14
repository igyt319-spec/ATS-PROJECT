// Head of Department (HOD) Console Controller
let departmentStudents = [];
let departmentMentors = [];
let allDeptResults = [];
let currentResultFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth('hod');
  if (!user) return;

  initLayout();

  const titleEl = document.getElementById('page-dept-title');
  if (titleEl && user.department) {
    titleEl.textContent = `${user.department} — HOD Console`;
  }

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

async function loadAllHODData() {
  await Promise.all([
    loadAllocations(),
    loadDepartmentResults(),
    loadDepartmentLeaves(),
    loadDepartmentFees()
  ]);
}

async function loadAllocations() {
  try {
    const res = await apiCall('/mentors/department-allocations');
    departmentStudents = res.students || [];
    departmentMentors = res.mentors || [];

    document.getElementById('kpi-dept-students').textContent = departmentStudents.length;
    document.getElementById('kpi-dept-mentors').textContent = departmentMentors.length;

    renderMentorsCards(departmentMentors);
    renderAllocationsTable(departmentStudents);
    populateMentorDropdown(departmentMentors);
  } catch (err) {
    console.error('[HOD Load Allocations Error]', err);
    document.getElementById('allocations-table-body').innerHTML = `<tr><td colspan="6" style="text-align: center; color: #f87171;">Failed to load mentor allocations: ${err.message}</td></tr>`;
  }
}

function renderMentorsCards(mentors) {
  const container = document.getElementById('mentors-cards-bar');
  if (!mentors || mentors.length === 0) {
    container.innerHTML = '<div style="color: var(--text-dim); font-size: 0.85rem;">No active mentors designated in this department.</div>';
    return;
  }

  container.innerHTML = mentors.map(m => {
    const avatarSrc = m.avatar || getInitialsAvatar(m.name);
    return `
      <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px 16px; min-width: 220px; display: flex; align-items: center; gap: 12px;">
        <img src="${avatarSrc}" alt="${m.name}" style="width: 42px; height: 42px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent-blue);" onerror="this.src='${getInitialsAvatar(m.name)}'">
        <div>
          <strong style="color: #fff; font-size: 0.88rem;">${m.name}</strong>
          <div style="font-size: 0.74rem; color: var(--text-dim);">${m.designation || 'Faculty Mentor'}</div>
          <span class="kpi-pill pill-blue" style="margin-top: 4px; display: inline-block;">${m.mentee_count || 0} Mentees</span>
        </div>
      </div>
    `;
  }).join('');
}

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
        <td><strong style="color: var(--accent-cyan);">${s.register_number}</strong></td>
        <td>${s.year || 'III Year'}<br><span style="font-size: 0.75rem; color: var(--text-dim);">${s.semester || 'Semester 1'}</span></td>
        <td>${mentorBadge}</td>
        <td>${s.assigned_at ? formatDate(s.assigned_at) : '—'}</td>
        <td>
          <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.78rem;" onclick="openReassignModal(${s.student_id}, '${escapeHtml(s.student_name)}', '${s.register_number}', ${s.mentor_faculty_id || 'null'})">
            ${hasMentor ? '🔄 Reassign' : '➕ Assign'}
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function populateMentorDropdown(mentors) {
  const select = document.getElementById('reassign-mentor-select');
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
