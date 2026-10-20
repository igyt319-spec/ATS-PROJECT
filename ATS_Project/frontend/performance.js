// Performance Page Controller
let breakdownChart = null;
let currentStudentId = 1;

document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth();
  if (!user) return;
  initLayout();

  currentStudentId = user.studentId || 1;
  if (user.role === 'admin' || user.role === 'faculty') await populateSubjectOptions('modal-subject-select');

  // Adapt UI if Admin
  if (user.role === 'admin' || user.role === 'faculty') {
    document.getElementById('sidebar-role-badge').textContent = 'ADMIN CONSOLE';
    const actionStrip = document.getElementById('admin-marks-action-strip');
    if (actionStrip) actionStrip.style.display = 'flex';
    const thActions = document.getElementById('th-marks-actions');
    if (thActions) thActions.style.display = 'table-cell';
  }

  await loadPerformanceData(currentStudentId);

  // Admin Marks Form Submission
  const marksForm = document.getElementById('marks-form');
  if (marksForm) {
    marksForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const subjectId = parseInt(document.getElementById('modal-subject-select').value, 10);
      const internal = parseFloat(document.getElementById('modal-internal').value);
      const assignment = parseFloat(document.getElementById('modal-assignment').value);
      const exam = parseFloat(document.getElementById('modal-exam').value);

      try {
        const res = await apiCall('/performance', 'POST', {
          student_id: currentStudentId,
          subject_id: subjectId,
          internal_marks: internal,
          assignment_marks: assignment,
          exam_marks: exam,
          semester: 'Semester 5'
        });

        if (res.success) {
          showToast('Academic marks successfully stored in database.', 'success');
          closeModal('add-marks-modal');
          marksForm.reset();
          await loadPerformanceData(currentStudentId);
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }
});

async function populateSubjectOptions(elementId, department) {
  const select = document.getElementById(elementId);
  if (!select) return;
  try {
    const result = await apiCall('/subjects');
    const subjects = (result.data || []).filter(s => !department || s.department === department);
    select.innerHTML = '<option value="">Select subject</option>' + subjects.map(s =>
      `<option value="${s.id}">${s.name} (${s.code})</option>`).join('');
  } catch (error) { console.error('[Subject Catalog Error]', error); }
}

async function loadPerformanceData(studentId) {
  try {
    const res = await apiCall(`/performance/${studentId}`);
    if (!res.success) throw new Error(res.message);

    const { averageMark, summary, data } = res;

    // Update KPIs
    document.getElementById('perf-avg-score').textContent = averageMark.toFixed(1);
    document.getElementById('perf-strong-count').textContent = summary.strong;
    document.getElementById('perf-avg-count').textContent = summary.average;
    document.getElementById('perf-weak-count').textContent = summary.weak;

    renderPerformanceTable(data);
    renderBreakdownChart(data);

  } catch (err) {
    console.error('[Performance Load Error]', err);
    showToast('Failed to load performance metrics', 'error');
  }
}

function renderPerformanceTable(marks) {
  const tbody = document.getElementById('performance-table-body');
  const user = getCurrentUser();
  const isAdmin = user && (user.role === 'admin' || user.role === 'faculty');

  if (!marks || marks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-dim); padding: 24px;">No academic marks logged for this semester.</td></tr>`;
    return;
  }

  tbody.innerHTML = marks.map(m => {
    const statusPill = m.status === 'Strong' ? 'pill-green' : m.status === 'Average' ? 'pill-yellow' : 'pill-red';
    const actionTd = isAdmin ? `
      <td style="text-align: right;">
        <button class="btn btn-secondary btn-sm" onclick="editMark(${m.id}, ${m.internal_marks}, ${m.assignment_marks}, ${m.exam_marks})">Edit</button>
      </td>
    ` : '';

    return `
      <tr>
        <td><strong style="color: var(--accent-cyan); font-family: monospace;">${m.subject_code || 'EC50' + m.id}</strong></td>
        <td><div style="font-weight: 600; color: #fff;">${m.subject_name || 'Subject'}</div></td>
        <td>${m.internal_marks} / 20</td>
        <td>${m.assignment_marks} / 20</td>
        <td>${m.exam_marks} / 60</td>
        <td><strong style="color: #fff; font-size: 1.05rem;">${m.total_marks}</strong> / 100</td>
        <td><span style="font-weight: 700; color: #fff; font-size: 0.95rem;">${m.grade}</span></td>
        <td><span class="kpi-pill ${statusPill}">${m.status}</span></td>
        ${actionTd}
      </tr>
    `;
  }).join('');
}

function renderBreakdownChart(marks) {
  const ctx = document.getElementById('marksBreakdownChart').getContext('2d');
  if (breakdownChart) breakdownChart.destroy();

  const labels = marks.map(m => m.subject_name || 'Subject');
  const internalData = marks.map(m => m.internal_marks);
  const assignmentData = marks.map(m => m.assignment_marks);
  const examData = marks.map(m => m.exam_marks);

  breakdownChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Internal (out of 20)',
          data: internalData,
          backgroundColor: '#7C9CFF',
          borderRadius: 4
        },
        {
          label: 'Assignment (out of 20)',
          data: assignmentData,
          backgroundColor: '#67D5C0',
          borderRadius: 4
        },
        {
          label: 'Final Exam (out of 60)',
          data: examData,
          backgroundColor: '#46C78B',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: '#737D8C' }
        },
        y: {
          stacked: true,
          max: 100,
          grid: { color: '#252B35' },
          ticks: { color: '#737D8C' }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#9BA4B1' }
        }
      }
    }
  });
}

function openAddMarksModal() {
  openModal('add-marks-modal');
}

function editMark(id, internal, assignment, exam) {
  document.getElementById('modal-internal').value = internal;
  document.getElementById('modal-assignment').value = assignment;
  document.getElementById('modal-exam').value = exam;
  openModal('add-marks-modal');
}
