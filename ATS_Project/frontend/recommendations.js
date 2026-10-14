// AI Recommendations Controller
let studentId = 1;

document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth();
  if (!user) return;
  initLayout();

  studentId = user.studentId || 1;

  if (user.role === 'admin' || user.role === 'faculty') {
    document.getElementById('sidebar-role-badge').textContent = 'ADMIN CONSOLE';
  }

  await loadRecommendationsAndAnalysis();
});

async function loadRecommendationsAndAnalysis() {
  try {
    // 1. Fetch AI Statistical Analysis
    const aiRes = await apiCall(`/ai/analysis/${studentId}`);
    if (aiRes.success && aiRes.data) {
      const d = aiRes.data;
      document.getElementById('ai-perf-level').textContent = d.performance_level || 'Proficient';
      document.getElementById('ai-acad-risk').textContent = d.academic_risk || 'LOW';
      document.getElementById('ai-att-risk').textContent = d.attendance_risk || 'LOW';
      document.getElementById('ai-comp-score').textContent = `${d.composite_academic_score || 84} / 100`;
    }

    // 2. Fetch Stored Recommendations
    const recRes = await apiCall(`/recommendations/${studentId}`);
    if (recRes.success) {
      renderRecommendations(recRes.data);
    }
  } catch (err) {
    console.error('[Recommendations Load Error]', err);
    showToast('Failed to load AI recommendations', 'error');
  }
}

function renderRecommendations(items) {
  const container = document.getElementById('recommendations-container');
  if (!items || items.length === 0) {
    container.innerHTML = `<div class="glass-card" style="text-align: center; color: var(--text-dim); padding: 36px;">No recommendations found. Run an AI scan to evaluate current data.</div>`;
    return;
  }

  container.innerHTML = items.map(r => {
    const pillClass = r.priority === 'HIGH' ? 'pill-red' : r.priority === 'MEDIUM' ? 'pill-yellow' : 'pill-blue';
    const isCompleted = r.status === 'Completed';
    const cardOpacity = isCompleted ? 'opacity: 0.65;' : '';
    const dateFormatted = new Date(r.created_at || Date.now()).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });

    const statusAction = isCompleted
      ? `<span class="kpi-pill pill-green">✓ Completed</span>`
      : `<button class="btn btn-secondary btn-sm" onclick="markDone(${r.id})">Mark Completed ✓</button>`;

    return `
      <div class="glass-card" style="${cardOpacity} border-left: 4px solid ${r.priority === 'HIGH' ? '#ef4444' : r.priority === 'MEDIUM' ? '#f59e0b' : '#38bdf8'};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="kpi-pill ${pillClass}">${r.priority} PRIORITY</span>
            <span style="font-size: 0.78rem; color: var(--text-dim);">Domain: ${r.category || 'Academic'}</span>
          </div>
          <span style="font-size: 0.78rem; color: var(--text-dim);">📅 ${dateFormatted}</span>
        </div>

        <h3 style="font-size: 1.15rem; font-weight: 700; color: #fff; margin-bottom: 6px;">${r.title}</h3>
        
        <p style="color: var(--text-muted); font-size: 0.88rem; line-height: 1.5; margin-bottom: 12px;">
          ${r.reason}
        </p>

        <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; margin-bottom: 14px;">
          <div style="color: var(--accent-cyan); font-weight: 600; font-size: 0.84rem; margin-bottom: 2px;">
            💡 Actionable Recommendation:
          </div>
          <div style="color: #e2e8f0; font-size: 0.88rem; line-height: 1.5;">
            ${r.recommendation}
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end;">
          ${statusAction}
        </div>
      </div>
    `;
  }).join('');
}

async function triggerAgentScan() {
  const btn = document.getElementById('btn-agent-scan');
  btn.disabled = true;
  btn.innerHTML = '<span>⏳</span> Diagnosing Records...';

  try {
    const res = await apiCall('/ai/run-agent', 'POST', { student_id: studentId });
    if (res.success) {
      showToast(`Agent Scan Complete: ${res.data.alerts_generated} proactive alerts diagnosed.`, 'success');
      await loadRecommendationsAndAnalysis();
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>🔄</span> Run AI Heuristic Scan';
  }
}

async function markDone(id) {
  try {
    const res = await apiCall(`/recommendations/${id}`, 'PUT', { status: 'Completed' });
    if (res.success) {
      showToast('Recommendation marked as completed.', 'success');
      await loadRecommendationsAndAnalysis();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}
