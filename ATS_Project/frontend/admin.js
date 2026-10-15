// Faculty / Admin Console Controller - Institutional Governance & Department Separation
let adminCharts = {};
let institutionDepartments = [];

document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth('admin');
  if (!user) return;
  initLayout();

  await Promise.all([
    loadAdminSummary(),
    loadInstitutionalDepartmentsOverview()
  ]);
});

async function loadAdminSummary() {
  try {
    const res = await apiCall('/dashboard/admin/summary');
    if (!res.success) throw new Error(res.message);

    const { stats, riskTable, recentAchievements } = res;

    // Update Secondary Academic KPIs
    const gpaEl = document.getElementById('admin-avg-gpa');
    if (gpaEl) gpaEl.textContent = stats.averageGpa.toFixed(2);
    const attEl = document.getElementById('admin-avg-att');
    if (attEl) attEl.textContent = `${stats.averageAttendance.toFixed(1)}%`;
    const riskEl = document.getElementById('admin-risk-count');
    if (riskEl) riskEl.textContent = stats.atRiskStudents;
    const achEl = document.getElementById('admin-total-ach');
    if (achEl) achEl.textContent = stats.totalAchievements;

    renderRecentAchievements(recentAchievements);
    renderRiskTable(riskTable);
    renderAdminCharts(riskTable);

  } catch (err) {
    console.error('[Admin Summary Error]', err);
    showToast('Failed to load admin summary records: ' + err.message, 'error');
  }
}

// Requirement 5: Institutional Department Overview & 3-Sector Department Breakdown
async function loadInstitutionalDepartmentsOverview() {
  const container = document.getElementById('admin-departments-container');
  const unassignedContainer = document.getElementById('admin-unassigned-container');

  try {
    const res = await apiCall('/departments/institutional-overview');
    if (!res.success) throw new Error(res.message || 'Failed to load institutional overview');

    const { summary, departments, unassigned } = res;
    institutionDepartments = departments || [];

    // Populate Top Institutional Summary Cards (Requirement 5)
    const deptCountEl = document.getElementById('admin-inst-departments');
    if (deptCountEl) deptCountEl.textContent = summary.totalDepartments || 0;

    const hodCountEl = document.getElementById('admin-inst-hods');
    if (hodCountEl) hodCountEl.textContent = summary.totalHODs || 0;

    const facCountEl = document.getElementById('admin-inst-faculty');
    if (facCountEl) facCountEl.textContent = summary.totalFaculty || 0;

    const stuCountEl = document.getElementById('admin-inst-students');
    if (stuCountEl) stuCountEl.textContent = summary.totalStudents || 0;

    // Render Department Cards
    renderDepartmentCards(institutionDepartments);

    // Administrative Exception View for Unassigned Personnel
    if (unassigned && (unassigned.faculty.length > 0 || unassigned.students.length > 0)) {
      renderUnassignedExceptions(unassigned);
    } else if (unassignedContainer) {
      unassignedContainer.style.display = 'none';
    }

  } catch (err) {
    console.error('[Institutional Overview Error]', err);
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 30px; color: #f87171;">
          Failed to load department-wise records: ${err.message}
        </div>
      `;
    }
  }
}

function renderDepartmentCards(deptList) {
  const container = document.getElementById('admin-departments-container');
  if (!container) return;

  if (!deptList || deptList.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 32px; color: var(--text-dim); background: rgba(255,255,255,0.02); border-radius: 10px; border: 1px dashed var(--border-color);">
        No configured departments found matching your criteria.
      </div>
    `;
    return;
  }

  container.innerHTML = deptList.map((dept, index) => {
    const hod = dept.hod;
    const faculty = dept.faculty || [];
    const students = dept.students || [];
    const stats = dept.stats || { totalFaculty: faculty.length, totalStudents: students.length, averageCgpa: 0, averageAttendance: 0 };
    const deptId = `dept-card-${dept.id}`;
    const collapseId = `dept-collapse-${dept.id}`;

    const hodAvatar = hod ? (hod.avatar || getInitialsAvatar(hod.name, 48)) : '';

    return `
      <div class="glass-card" id="${deptId}" style="border: 1px solid rgba(255,255,255,0.12); padding: 0; overflow: hidden; margin-bottom: 4px;">
        <!-- Department Banner Header -->
        <div style="padding: 18px 24px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
          <div>
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #fff;">${dept.name}</h3>
              <span class="badge" style="background: rgba(56,189,248,0.18); color: #38bdf8; font-weight: 700; font-family: monospace;">${dept.code}</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; display: flex; gap: 14px; flex-wrap: wrap;">
              <span>👨‍🏫 ${stats.totalFaculty} Faculty</span>
              <span>🎓 ${stats.totalStudents} Students</span>
              <span>📈 Mean CGPA: <strong>${stats.averageCgpa.toFixed(2)}</strong></span>
              <span>📅 Mean Attendance: <strong>${stats.averageAttendance.toFixed(1)}%</strong></span>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="toggleDeptCollapse('${collapseId}', this)" style="font-size: 0.78rem; padding: 6px 12px;">
            🔽 Expand Sectors
          </button>
        </div>

        <!-- 3 Clearly Separated Sectors (Collapsible / Expandable) -->
        <div id="${collapseId}" style="padding: 24px; display: flex; flex-direction: column; gap: 24px; background: rgba(15,23,42,0.4);">

          <!-- SECTOR A: HOD / DEPARTMENT LEADERSHIP -->
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(250,204,21,0.25); border-radius: 12px; padding: 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.1rem;">👑</span>
                <strong style="color: #facc15; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.5px;">Sector A: Department Leadership (HOD)</strong>
              </div>
              <span style="font-size: 0.75rem; color: var(--text-dim);">Assigned Executive Authority</span>
            </div>

            ${hod ? `
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
                <div style="display: flex; align-items: center; gap: 14px;">
                  <img src="${hodAvatar}" alt="${hod.name}" style="width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 2px solid #facc15;" onerror="this.src='${getInitialsAvatar(hod.name, 52)}'">
                  <div>
                    <h4 style="margin: 0; color: #fff; font-size: 1.05rem; font-weight: 700;">${hod.name}</h4>
                    <div style="font-size: 0.8rem; color: var(--accent-cyan);">${hod.designation || 'Head of Department'}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                      ✉️ ${hod.email || 'N/A'} • HOD Since: ${hod.hod_since ? String(hod.hod_since).slice(0, 10) : 'Current Academic Term'}
                    </div>
                  </div>
                </div>
                <button class="btn btn-secondary btn-sm" onclick='openHODMiniDashboard(${JSON.stringify(hod)}, { departmentName: "${escapeHtml(dept.name)}" })' style="font-size: 0.78rem; padding: 6px 14px;">
                  👤 View Details
                </button>
              </div>
            ` : `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(239,68,68,0.08); border: 1px dashed rgba(239,68,68,0.3); border-radius: 8px;">
                <span style="color: #f87171; font-size: 0.86rem; font-weight: 600;">⚠️ No active Head of Department currently assigned for ${dept.name}.</span>
                <span style="font-size: 0.75rem; color: var(--text-dim);">Assign via Department Configuration</span>
              </div>
            `}
          </div>

          <!-- SECTOR B: FACULTY SECTION -->
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(56,189,248,0.25); border-radius: 12px; padding: 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.1rem;">👨‍🏫</span>
                <strong style="color: #38bdf8; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.5px;">Sector B: Department Faculty Roster (${faculty.length})</strong>
              </div>
              <span style="font-size: 0.75rem; color: var(--text-dim);">Strictly assigned to ${dept.code}</span>
            </div>

            ${faculty.length > 0 ? `
              <div style="overflow-x: auto;">
                <table class="data-table" style="width: 100%; font-size: 0.85rem;">
                  <thead>
                    <tr>
                      <th>Faculty Member</th>
                      <th>Designation</th>
                      <th>Assigned Mentees</th>
                      <th>Role Scope</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${faculty.map(f => {
                      const fAvatar = f.avatar || getInitialsAvatar(f.name, 36);
                      return `
                        <tr>
                          <td>
                            <div style="display: flex; align-items: center; gap: 10px;">
                              <img src="${fAvatar}" alt="${f.name}" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-color);" onerror="this.src='${getInitialsAvatar(f.name, 34)}'">
                              <div>
                                <strong style="color: #fff;">${f.name}</strong>
                                <div style="font-size: 0.74rem; color: var(--text-dim);">${f.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>${f.designation || 'Faculty Member'}</td>
                          <td>
                            <span class="kpi-pill pill-blue" style="font-size: 0.72rem;">${f.mentee_count || 0} Scholars</span>
                          </td>
                          <td>
                            <span class="badge" style="background: ${f.is_hod ? 'rgba(250,204,21,0.15)' : 'rgba(34,197,94,0.15)'}; color: ${f.is_hod ? '#facc15' : '#4ade80'}; font-size: 0.72rem;">
                              ${f.is_hod ? '👑 HOD' : (f.can_mentor ? 'Mentor' : 'Faculty')}
                            </span>
                          </td>
                          <td>
                            <button class="btn btn-secondary btn-sm" onclick="openFacultyMiniDashboard(${f.id})" style="font-size: 0.74rem; padding: 4px 10px;">
                              👤 View Details
                            </button>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            ` : `
              <div style="text-align: center; padding: 20px; color: var(--text-dim); font-size: 0.84rem;">
                No faculty members registered in ${dept.name}.
              </div>
            `}
          </div>

          <!-- SECTOR C: STUDENTS SECTION -->
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(168,85,247,0.25); border-radius: 12px; padding: 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.1rem;">🎓</span>
                <strong style="color: #c084fc; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.5px;">Sector C: Department Students Roster (${students.length})</strong>
              </div>
              <span style="font-size: 0.75rem; color: var(--text-dim);">Enrolled exclusively in ${dept.code}</span>
            </div>

            ${students.length > 0 ? `
              <div style="overflow-x: auto;">
                <table class="data-table" style="width: 100%; font-size: 0.85rem;">
                  <thead>
                    <tr>
                      <th>Scholar</th>
                      <th>Register No</th>
                      <th>Year / Sem</th>
                      <th>CGPA</th>
                      <th>Attendance</th>
                      <th>Primary Mentor</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${students.map(st => {
                      const stAvatar = st.avatar || getInitialsAvatar(st.name, 36);
                      const att = Number(st.attendance_percentage || 0);
                      const attColor = att >= 75 ? '#22c55e' : '#f87171';

                      return `
                        <tr>
                          <td>
                            <div style="display: flex; align-items: center; gap: 10px;">
                              <img src="${stAvatar}" alt="${st.name}" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-color);" onerror="this.src='${getInitialsAvatar(st.name, 34)}'">
                              <div>
                                <strong style="color: #fff;">${st.name}</strong>
                              </div>
                            </div>
                          </td>
                          <td><strong style="color: var(--accent-cyan); font-family: monospace;">${st.register_number}</strong></td>
                          <td>${st.year || 'III Year'}<br><span style="font-size: 0.72rem; color: var(--text-dim);">${st.semester || 'Sem 5'}</span></td>
                          <td><strong style="color: #fff;">${Number(st.cgpa || 0).toFixed(2)}</strong></td>
                          <td><span style="font-weight: 700; color: ${attColor};">${att.toFixed(1)}%</span></td>
                          <td>
                            ${st.mentor_name ? `<span style="color: #38bdf8; font-weight: 600;">${st.mentor_name}</span>` : '<span class="kpi-pill pill-red" style="font-size: 0.7rem;">Unassigned</span>'}
                          </td>
                          <td>
                            <button class="btn btn-primary btn-sm" onclick="openStudentMiniDashboard(${st.id})" style="font-size: 0.74rem; padding: 4px 10px; font-weight: 700;">
                              📊 View Dashboard
                            </button>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            ` : `
              <div style="text-align: center; padding: 20px; color: var(--text-dim); font-size: 0.84rem;">
                No students enrolled in ${dept.name}.
              </div>
            `}
          </div>

        </div>
      </div>
    `;
  }).join('');
}

function toggleDeptCollapse(collapseId, btn) {
  const panel = document.getElementById(collapseId);
  if (!panel) return;
  const isHidden = panel.style.display === 'none';
  panel.style.display = isHidden ? 'flex' : 'none';
  if (btn) {
    btn.textContent = isHidden ? '🔼 Collapse Sectors' : '🔽 Expand Sectors';
  }
}

function filterAdminDepartments() {
  const query = (document.getElementById('admin-dept-search').value || '').toLowerCase().trim();
  if (!query) {
    renderDepartmentCards(institutionDepartments);
    return;
  }
  const filtered = institutionDepartments.filter(d =>
    (d.name || '').toLowerCase().includes(query) ||
    (d.code || '').toLowerCase().includes(query)
  );
  renderDepartmentCards(filtered);
}

// Administrative Exception View: Unassigned personnel
function renderUnassignedExceptions(unassigned) {
  const container = document.getElementById('admin-unassigned-container');
  if (!container) return;

  const { faculty = [], students = [] } = unassigned;
  if (faculty.length === 0 && students.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = `
    <div style="background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; padding: 20px;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
        <span style="font-size: 1.3rem;">⚠️</span>
        <h4 style="margin: 0; color: #f87171; font-size: 1rem; font-weight: 800;">
          Administrative Exception View — Unassigned Institutional Records (${faculty.length + students.length})
        </h4>
      </div>
      <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 16px;">
        The following faculty or students have missing or invalid department assignments. They are safely isolated here instead of being erroneously attributed to another department.
      </p>

      ${faculty.length > 0 ? `
        <div style="margin-bottom: 14px;">
          <strong style="font-size: 0.85rem; color: #fff;">Unassigned Faculty (${faculty.length}):</strong>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px;">
            ${faculty.map(f => `
              <span class="badge" style="background: rgba(255,255,255,0.08); color: #fff; padding: 4px 10px;">
                ${f.name} (${f.email || 'No email'})
              </span>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${students.length > 0 ? `
        <div>
          <strong style="font-size: 0.85rem; color: #fff;">Unassigned Students (${students.length}):</strong>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px;">
            ${students.map(s => `
              <span class="badge" style="background: rgba(255,255,255,0.08); color: #fff; padding: 4px 10px;">
                ${s.name} [${s.register_number}]
              </span>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderRecentAchievements(items) {
  const container = document.getElementById('admin-recent-achievements');
  if (!container) return;
  container.replaceChildren();
  if (!items || !items.length) {
    const empty = document.createElement('p'); empty.textContent = 'No achievement records yet.'; empty.style.color = 'var(--text-dim)'; container.appendChild(empty); return;
  }
  items.forEach(item => {
    const row = document.createElement('div');
    row.style.cssText = 'padding:12px;background:rgba(255,255,255,.02);border:1px solid var(--border-color);border-radius:var(--radius-sm);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;';
    const title = document.createElement('strong'); title.textContent = `${item.title} · ${item.student_name}`;
    const meta = document.createElement('span'); meta.textContent = `${item.category} · ${item.status} · ${item.achievement_date}`; meta.style.color = 'var(--text-muted)';
    row.append(title, meta); container.appendChild(row);
  });
}

function renderRiskTable(tableData) {
  const tbody = document.getElementById('admin-risk-table-body');
  if (!tbody) return;
  if (!tableData || tableData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-dim); padding: 24px;">No student records found in database.</td></tr>`;
    return;
  }

  tbody.innerHTML = tableData.map(st => {
    const riskPill = st.risk === 'HIGH' ? 'pill-red' : st.risk === 'MEDIUM' ? 'pill-yellow' : 'pill-green';
    return `
      <tr>
        <td>
          <div style="font-weight: 600; color: #fff;">${st.name}</div>
          <div style="font-size: 0.76rem; color: var(--text-dim);">${st.year || 'III Year'}</div>
        </td>
        <td><span style="font-family: monospace; color: var(--accent-cyan); font-weight: 700;">${st.register_number}</span></td>
        <td>${st.department}</td>
        <td><strong>${st.gpa}</strong></td>
        <td>${st.attendance}</td>
        <td><span class="kpi-pill ${riskPill}">${st.risk}</span></td>
        <td style="max-width: 320px; font-size: 0.84rem; color: var(--text-muted); line-height: 1.4;">
          ${st.recommendation}
        </td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="openStudentMiniDashboard(${st.id || 1})" style="font-size: 0.76rem; padding: 4px 10px; font-weight: 700;">
            📊 View
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderAdminCharts(riskTable) {
  const riskCanvas = document.getElementById('adminRiskDistributionChart');
  const deptCanvas = document.getElementById('adminDeptAttendanceChart');
  if (!riskCanvas || !deptCanvas) return;

  // Chart 1: Risk breakdown
  let low = 0, med = 0, high = 0;
  riskTable.forEach(s => {
    if (s.risk === 'HIGH') high++;
    else if (s.risk === 'MEDIUM') med++;
    else low++;
  });

  const ctxRisk = riskCanvas.getContext('2d');
  if (adminCharts.risk) adminCharts.risk.destroy();

  adminCharts.risk = new Chart(ctxRisk, {
    type: 'doughnut',
    data: {
      labels: ['Low Risk (Safe)', 'Medium Risk (Monitor)', 'High Risk (Intervention)'],
      datasets: [{
        data: [low, med, high],
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', boxWidth: 12 }
        }
      },
      cutout: '60%'
    }
  });

  // Chart 2: Attendance by department
  const deptMap = {};
  riskTable.forEach(s => {
    const d = s.department.split(' ')[0]; // ECE, CSE, etc.
    const att = parseFloat(s.attendance) || 80;
    if (!deptMap[d]) deptMap[d] = { sum: 0, count: 0 };
    deptMap[d].sum += att;
    deptMap[d].count++;
  });

  const deptLabels = Object.keys(deptMap);
  const deptAverages = deptLabels.map(d => (deptMap[d].sum / deptMap[d].count).toFixed(1));

  const ctxDept = deptCanvas.getContext('2d');
  if (adminCharts.dept) adminCharts.dept.destroy();

  adminCharts.dept = new Chart(ctxDept, {
    type: 'bar',
    data: {
      labels: deptLabels,
      datasets: [{
        label: 'Average Attendance %',
        data: deptAverages,
        backgroundColor: '#38bdf8',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          min: 60,
          max: 100,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', callback: v => `${v}%` }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });
}

async function runClassAIAgent() {
  try {
    showToast('Invoking Autonomous Academic Monitoring Agent cycle...', 'info');
    const res = await apiCall('/ai/run-agent', 'POST', { student_id: 1 });
    if (res.success) {
      showToast(`Agent Scan Complete: ${res.data.alerts_generated} automated alerts evaluated.`, 'success');
      await loadAdminSummary();
    }
  } catch (err) {
    showToast('Failed to trigger AI agent: ' + err.message, 'error');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
