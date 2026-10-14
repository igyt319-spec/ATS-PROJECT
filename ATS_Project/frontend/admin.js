// Faculty / Admin Console Controller
let adminCharts = {};

document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth('admin');
  if (!user) return;
  initLayout();

  await loadAdminSummary();
});

async function loadAdminSummary() {
  try {
    const res = await apiCall('/dashboard/admin/summary');
    if (!res.success) throw new Error(res.message);

    const { stats, riskTable, recentAchievements } = res;

    // Update KPI Cards
    document.getElementById('admin-total-students').textContent = stats.totalStudents;
    document.getElementById('admin-avg-gpa').textContent = stats.averageGpa.toFixed(2);
    document.getElementById('admin-avg-att').textContent = `${stats.averageAttendance.toFixed(1)}%`;
    document.getElementById('admin-risk-count').textContent = stats.atRiskStudents;
    document.getElementById('admin-total-ach').textContent = stats.totalAchievements;
    document.getElementById('admin-department-total').textContent = stats.totalDepartments;
    renderRecentAchievements(recentAchievements);

    // Render Risk Matrix Table
    renderRiskTable(riskTable);

    // Render Admin Charts
    renderAdminCharts(riskTable);

  } catch (err) {
    console.error('[Admin Summary Error]', err);
    showToast('Failed to load admin summary records', 'error');
  }
}

function renderRecentAchievements(items) {
  const container = document.getElementById('admin-recent-achievements');
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
        <td><span style="font-family: monospace; color: var(--accent-cyan);">${st.register_number}</span></td>
        <td>${st.department}</td>
        <td><strong>${st.gpa}</strong></td>
        <td>${st.attendance}</td>
        <td><span class="kpi-pill ${riskPill}">${st.risk}</span></td>
        <td style="max-width: 320px; font-size: 0.84rem; color: var(--text-muted); line-height: 1.4;">
          ${st.recommendation}
        </td>
        <td>
          <a href="students.html?search=${encodeURIComponent(st.register_number)}" class="btn btn-secondary btn-sm" style="font-size: 0.76rem; padding: 4px 10px;">
            Inspect
          </a>
        </td>
      </tr>
    `;
  }).join('');
}

function renderAdminCharts(riskTable) {
  // Chart 1: Risk breakdown
  let low = 0, med = 0, high = 0;
  riskTable.forEach(s => {
    if (s.risk === 'HIGH') high++;
    else if (s.risk === 'MEDIUM') med++;
    else low++;
  });

  const ctxRisk = document.getElementById('adminRiskDistributionChart').getContext('2d');
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

  const ctxDept = document.getElementById('adminDeptAttendanceChart').getContext('2d');
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
