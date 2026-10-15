// Faculty Mentor Console Controller
let menteesList = [];
let allResults = [];
let currentResultFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth('mentor');
  if (!user) return;

  initLayout();

  await loadAllMentorData();

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
});

async function loadAllMentorData() {
  await Promise.all([
    loadMentees(),
    loadLeaves(),
    loadActivities(),
    loadResults(),
    loadFees()
  ]);
}

async function loadMentees() {
  try {
    const res = await apiCall('/mentors/my-mentees');
    menteesList = res.data || [];

    document.getElementById('kpi-mentee-count').textContent = menteesList.length;

    let feeAlertCount = 0;
    menteesList.forEach(m => {
      if (Number(m.outstanding_fee || 0) > 0) feeAlertCount++;
    });
    document.getElementById('kpi-fee-alerts').textContent = feeAlertCount;

    renderMenteesTable(menteesList);
  } catch (err) {
    console.error('[Mentor Load Mentees Error]', err);
    document.getElementById('mentees-table-body').innerHTML = `<tr><td colspan="8" style="text-align: center; color: #f87171;">Failed to load mentees: ${err.message}</td></tr>`;
  }
}

function renderMenteesTable(list) {
  const tbody = document.getElementById('mentees-table-body');
  if (!list || list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 48px 24px; color: var(--text-dim);">
          <div style="font-size: 2.6rem; margin-bottom: 10px;">👥</div>
          <div style="color: #fff; font-weight: 700; font-size: 1.05rem; margin-bottom: 4px;">No Mentees Assigned</div>
          <div style="font-size: 0.82rem; max-width: 380px; margin: 0 auto; color: var(--text-dim);">
            You currently do not have any students assigned to your advisory cohort. Contact your Department Head to allocate mentees.
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(m => {
    const avatarSrc = m.avatar || getInitialsAvatar(m.student_name);
    const feeDue = Number(m.outstanding_fee || 0);
    const feeBadge = feeDue > 0 
      ? `<span class="kpi-pill pill-red">₹${feeDue.toLocaleString('en-IN')}</span>` 
      : `<span class="kpi-pill pill-green">Clear</span>`;

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${avatarSrc}" alt="${m.student_name}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-color);" onerror="this.src='${getInitialsAvatar(m.student_name)}'">
            <div>
              <strong style="color: #fff;">${m.student_name}</strong>
              <div style="font-size: 0.75rem; color: var(--text-dim);">${m.email}</div>
            </div>
          </div>
        </td>
        <td><strong style="color: var(--accent-cyan);">${m.register_number}</strong></td>
        <td>${m.department_name || 'CSE'}<br><span style="font-size: 0.76rem; color: var(--text-dim);">${m.year || 'III Year'}</span></td>
        <td>${m.phone || '—'}</td>
        <td>
          ${Number(m.pending_leaves) > 0 ? `<span class="kpi-pill pill-yellow">${m.pending_leaves} Pending</span>` : `<span style="color: var(--text-dim);">0</span>`}
        </td>
        <td>
          ${Number(m.pending_activities) > 0 ? `<span class="kpi-pill pill-purple">${m.pending_activities} Pending</span>` : `<span style="color: var(--text-dim);">0</span>`}
        </td>
        <td>${feeBadge}</td>
        <td>
          <button class="btn btn-primary" style="padding: 6px 12px; font-size: 0.78rem; font-weight:700;" onclick="openStudentMiniDashboard(${m.student_id})">
            📊 View Dashboard
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function filterMentees() {
  const query = (document.getElementById('mentee-search').value || '').toLowerCase().trim();
  const filtered = menteesList.filter(m => 
    (m.student_name || '').toLowerCase().includes(query) ||
    (m.register_number || '').toLowerCase().includes(query)
  );
  renderMenteesTable(filtered);
}

async function loadLeaves() {
  try {
    const res = await apiCall('/leave/mentor/mentees');
    const leaves = res.data || [];

    const pendingCount = leaves.filter(l => l.status === 'Pending').length;
    document.getElementById('kpi-pending-leaves').textContent = pendingCount;

    const tbody = document.getElementById('leaves-table-body');
    if (leaves.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-dim);">No leave applications found for your assigned mentees.</td></tr>';
      return;
    }

    tbody.innerHTML = leaves.map(l => {
      const pillClass = l.status === 'Approved' ? 'pill-green' : l.status === 'Rejected' ? 'pill-red' : 'pill-yellow';
      const actionHtml = l.status === 'Pending'
        ? `<button class="btn btn-primary" style="padding: 6px 12px; font-size: 0.78rem;" onclick="openLeaveModal(${l.id}, '${escapeHtml(l.student_name)}', '${l.leave_type}', '${l.start_date}', '${l.end_date}')">Review</button>`
        : `<span style="font-size: 0.78rem; color: var(--text-dim);">${l.reviewed_by_name ? 'By ' + l.reviewed_by_name : 'Decided'}</span>`;

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
          <td style="font-size: 0.82rem; color: var(--text-dim);">${l.remarks || '—'}</td>
          <td>${actionHtml}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('[Mentor Load Leaves Error]', err);
    document.getElementById('leaves-table-body').innerHTML = `<tr><td colspan="7" style="text-align: center; color: #f87171;">Failed to load leaves: ${err.message}</td></tr>`;
  }
}

async function loadActivities() {
  try {
    const res = await apiCall('/activities/mentor/mentees');
    const activities = res.data || [];

    const pendingCount = activities.filter(a => a.status === 'Pending').length;
    document.getElementById('kpi-pending-activities').textContent = pendingCount;

    const tbody = document.getElementById('activities-table-body');
    if (activities.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-dim);">No activity submissions found for your assigned mentees.</td></tr>';
      return;
    }

    tbody.innerHTML = activities.map(a => {
      const pillClass = a.status === 'Verified' ? 'pill-green' : a.status === 'Rejected' ? 'pill-red' : 'pill-yellow';
      const actionHtml = a.status === 'Pending'
        ? `<button class="btn btn-primary" style="padding: 6px 12px; font-size: 0.78rem;" onclick="openActivityModal(${a.id}, '${escapeHtml(a.student_name)}', '${escapeHtml(a.title)}', '${a.category}')">Verify</button>`
        : `<span style="font-size: 0.78rem; color: var(--text-dim);">${a.verified_by_name ? 'By ' + a.verified_by_name : 'Verified'}</span>`;

      return `
        <tr>
          <td>
            <strong>${a.student_name}</strong>
            <div style="font-size: 0.75rem; color: var(--text-dim);">${a.register_number}</div>
          </td>
          <td><span class="kpi-pill pill-blue">${a.category}</span></td>
          <td>
            <strong>${escapeHtml(a.title)}</strong>
            <div style="font-size: 0.75rem; color: var(--text-dim);">${escapeHtml(a.organizing_institution || '—')}</div>
          </td>
          <td>${a.event_date ? formatDate(a.event_date) : '—'}</td>
          <td>${a.participation_level || 'Participant'}</td>
          <td><span class="kpi-pill ${pillClass}">${a.status}</span></td>
          <td>${actionHtml}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('[Mentor Load Activities Error]', err);
    document.getElementById('activities-table-body').innerHTML = `<tr><td colspan="7" style="text-align: center; color: #f87171;">Failed to load activities: ${err.message}</td></tr>`;
  }
}

async function loadResults() {
  try {
    const res = await apiCall('/results/mentor/mentees');
    allResults = res.data || [];
    renderResultsTable();
  } catch (err) {
    console.error('[Mentor Load Results Error]', err);
    document.getElementById('results-table-body').innerHTML = `<tr><td colspan="9" style="text-align: center; color: #f87171;">Failed to load results: ${err.message}</td></tr>`;
  }
}

function filterResultsType(type) {
  currentResultFilter = type;
  document.querySelectorAll('#results-filter-pills .tab-pill').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase().includes(type) || (type === 'all' && btn.textContent.includes('All')));
  });
  renderResultsTable();
}

function renderResultsTable() {
  const tbody = document.getElementById('results-table-body');
  let list = allResults;
  if (currentResultFilter !== 'all') {
    list = allResults.filter(r => r.assessment_type === currentResultFilter);
  }

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 24px; color: var(--text-dim);">No academic results found for this category.</td></tr>';
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

async function loadFees() {
  try {
    const res = await apiCall('/fees/mentor/mentees');
    const fees = res.data || [];

    const tbody = document.getElementById('fees-table-body');
    if (fees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 24px; color: var(--text-dim);">No fee records found for assigned mentees.</td></tr>';
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
    console.error('[Mentor Load Fees Error]', err);
    document.getElementById('fees-table-body').innerHTML = `<tr><td colspan="8" style="text-align: center; color: #f87171;">Failed to load fees: ${err.message}</td></tr>`;
  }
}

function openLeaveModal(id, studentName, type, start, end) {
  document.getElementById('leave-decision-id').value = id;
  document.getElementById('leave-modal-info').innerHTML = `
    <strong>Student:</strong> ${studentName}<br>
    <strong>Request:</strong> ${type} from ${formatDate(start)} to ${formatDate(end)}
  `;
  document.getElementById('leave-decision-remarks').value = '';
  openModal('leave-modal');
}

function openActivityModal(id, studentName, title, category) {
  document.getElementById('activity-decision-id').value = id;
  document.getElementById('activity-modal-info').innerHTML = `
    <strong>Student:</strong> ${studentName}<br>
    <strong>Activity:</strong> ${title} (${category})
  `;
  document.getElementById('activity-decision-remarks').value = '';
  openModal('activity-modal');
}

function switchFacultyTab(tabName) {
  const tabs = ['dashboard', 'mentees', 'leaves', 'activities', 'results', 'fees'];
  tabs.forEach(t => {
    const navEl = document.getElementById(`nav-${t}`);
    if (navEl) {
      if (t === tabName) {
        navEl.classList.add('active');
      } else {
        navEl.classList.remove('active');
      }
    }
  });

  const sectionMap = {
    'dashboard': 'faculty-sec-overview',
    'mentees': 'faculty-sec-mentees',
    'leaves': 'section-leaves',
    'activities': 'section-activities',
    'results': 'section-results',
    'fees': 'section-fees'
  };

  const targetId = sectionMap[tabName];
  if (targetId) {
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
