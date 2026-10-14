// Student Dashboard Controller
let chartInstances = {};

document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth('student');
  if (!user) return;
  initLayout();

  const studentId = user.studentId || 1;
  await loadDashboardData(studentId);
});

async function loadDashboardData(studentId) {
  try {
    const res = await apiCall(`/dashboard/${studentId}`);
    if (!res.success) throw new Error(res.message || 'Failed to load dashboard data');

    const { student, kpi, charts, recentRecommendations } = res;

    // Update Banner & Headers
    document.getElementById('banner-student-name').textContent = student.name;
    document.getElementById('header-student-subtitle').textContent = 
      `${student.department} • ${student.year} • ${student.register_number}`;

    // Update KPI 1: GPA / CGPA
    document.getElementById('kpi-gpa').textContent = Number(kpi.gpa).toFixed(2);
    document.getElementById('kpi-cgpa').textContent = Number(kpi.cgpa).toFixed(2);

    // Update KPI 2: Attendance
    document.getElementById('kpi-attendance').textContent = `${Number(kpi.attendance).toFixed(0)}%`;
    const attPill = document.getElementById('kpi-attendance-pill');
    if (kpi.attendance >= 85) {
      attPill.className = 'kpi-pill pill-green';
      attPill.textContent = 'GOOD';
    } else if (kpi.attendance >= 75) {
      attPill.className = 'kpi-pill pill-yellow';
      attPill.textContent = 'MONITOR';
    } else {
      attPill.className = 'kpi-pill pill-red';
      attPill.textContent = 'RISK';
    }

    // Update KPI 3: Achievements
    document.getElementById('kpi-achievements').textContent = kpi.achievementsCount;

    // Update KPI 4: Academic Score
    document.getElementById('kpi-score').innerHTML = `${kpi.academicScore}<span style="font-size: 1.1rem; color: var(--text-dim);">/100</span>`;

    // Populate Explainable Score Modal
    if (kpi.academicScoreDetails && kpi.academicScoreDetails.components) {
      const comp = kpi.academicScoreDetails.components;
      document.getElementById('modal-marks-contrib').textContent = `${comp.marks.contribution} pts (${comp.marks.weight})`;
      document.getElementById('modal-att-contrib').textContent = `${comp.attendance.contribution} pts (${comp.attendance.weight})`;
      document.getElementById('modal-ach-contrib').textContent = `${comp.achievements.contribution} pts (${comp.achievements.weight})`;
      document.getElementById('modal-total-score').textContent = `${kpi.academicScore} / 100`;
    }

    // Update KPI 5: Risk Level
    const riskEl = document.getElementById('kpi-risk');
    const riskPill = document.getElementById('kpi-risk-pill');
    riskEl.textContent = kpi.riskLevel;
    if (kpi.riskLevel === 'HIGH') {
      riskEl.style.color = '#ef4444';
      riskPill.className = 'kpi-pill pill-red';
      riskPill.textContent = 'Critical Action';
    } else if (kpi.riskLevel === 'MEDIUM') {
      riskEl.style.color = '#f59e0b';
      riskPill.className = 'kpi-pill pill-yellow';
      riskPill.textContent = 'Monitor Closely';
    } else {
      riskEl.style.color = '#34d399';
      riskPill.className = 'kpi-pill pill-green';
      riskPill.textContent = 'Safe Track';
    }

    // Render Charts
    renderSubjectPerformanceChart(charts.subjectPerformance);
    renderAcademicTrendChart(charts.academicTrend);
    renderAttendanceTrendChart(charts.attendanceTrend);
    renderAchievementDistributionChart(charts.achievementDistribution);

    // Render Recent AI Recommendations
    renderRecommendations(recentRecommendations);

  } catch (err) {
    console.error('[Dashboard Load Error]', err);
    showToast('Failed to load dashboard metrics. Reconnecting...', 'error');
  }
}

function renderSubjectPerformanceChart(chartData) {
  const ctx = document.getElementById('subjectPerformanceChart').getContext('2d');
  if (chartInstances.subjectPerformance) chartInstances.subjectPerformance.destroy();

  chartInstances.subjectPerformance = new Chart(ctx, {
    type: 'bar',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#fff',
          bodyColor: '#38bdf8',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });
}

function renderAcademicTrendChart(chartData) {
  const ctx = document.getElementById('academicTrendChart').getContext('2d');
  if (chartInstances.academicTrend) chartInstances.academicTrend.destroy();

  chartInstances.academicTrend = new Chart(ctx, {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#fff',
          bodyColor: '#38bdf8'
        }
      },
      scales: {
        y: {
          min: 6.0,
          max: 10.0,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });
}

function renderAttendanceTrendChart(chartData) {
  const ctx = document.getElementById('attendanceTrendChart').getContext('2d');
  if (chartInstances.attendanceTrend) chartInstances.attendanceTrend.destroy();

  chartInstances.attendanceTrend = new Chart(ctx, {
    type: 'line',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { size: 11 } }
        }
      },
      scales: {
        y: {
          min: 50,
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

function renderAchievementDistributionChart(chartData) {
  const ctx = document.getElementById('achievementDistChart').getContext('2d');
  if (chartInstances.achievementDist) chartInstances.achievementDist.destroy();

  chartInstances.achievementDist = new Chart(ctx, {
    type: 'doughnut',
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12 }
        }
      },
      cutout: '65%'
    }
  });
}

function renderRecommendations(list) {
  const container = document.getElementById('dashboard-recommendations-list');
  if (!list || list.length === 0) {
    container.innerHTML = `<div style="color: var(--text-dim); font-size: 0.88rem; padding: 12px;">No urgent recommendations active. Keep up the great work!</div>`;
    return;
  }

  container.innerHTML = list.map(item => {
    const pillClass = item.priority === 'HIGH' ? 'pill-red' : item.priority === 'MEDIUM' ? 'pill-yellow' : 'pill-blue';
    return `
      <div style="padding: 14px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: var(--radius-sm); display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span class="kpi-pill ${pillClass}">${item.priority}</span>
            <strong style="color: #fff; font-size: 0.92rem;">${item.title}</strong>
          </div>
          <p style="color: var(--text-muted); font-size: 0.82rem; margin-bottom: 6px;">${item.reason}</p>
          <div style="color: var(--accent-cyan); font-size: 0.8rem; font-weight: 500;">
            👉 Recommendation: ${item.recommendation}
          </div>
        </div>
      </div>
    `;
  }).join('');
}
