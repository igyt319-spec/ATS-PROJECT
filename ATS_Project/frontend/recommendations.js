// AI Recommendations Controller
let studentId = 1;
let allRecommendations = [];
let activeRecFilter = 'ALL';

document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth();
  if (!user) return;
  initLayout();

  studentId = user.studentId || 1;

  await loadRecommendationsAndAnalysis();
});

async function loadRecommendationsAndAnalysis() {
  try {
    // 1. Fetch AI Statistical Analysis & MCDA Formulation
    const aiRes = await apiCall(`/ai/analysis/${studentId}`);
    if (aiRes.success && aiRes.data) {
      const d = aiRes.data;
      document.getElementById('ai-perf-level').textContent = d.performance_level || 'Proficient';
      document.getElementById('ai-acad-risk').textContent = d.academic_risk || 'LOW';
      document.getElementById('ai-att-risk').textContent = d.attendance_risk || 'LOW';
      document.getElementById('ai-comp-score').textContent = `${d.composite_academic_score || 84} / 100`;

      // Render MCDA Multi-Criteria Breakdown
      renderMCDABreakdown(d);
    }

    // 2. Fetch Stored Recommendations
    const recRes = await apiCall(`/recommendations/${studentId}`);
    if (recRes.success) {
      allRecommendations = recRes.data || [];
      filterRecs(activeRecFilter);
    }
  } catch (err) {
    console.error('[Recommendations Load Error]', err);
    showToast('Failed to load AI recommendations', 'error');
  }
}

function renderMCDABreakdown(data) {
  const mcda = data.mcda_components || {};
  const marksWeighted = mcda.marks_weighted ?? (0.70 * (data.statistical_metrics?.mean || 75));
  const attWeighted = mcda.attendance_weighted ?? (0.20 * (data.overall_attendance || 85));
  const achWeighted = mcda.achievements_weighted ?? 7.5;

  const marksPct = Math.min(100, (marksWeighted / 70) * 100);
  const attPct = Math.min(100, (attWeighted / 20) * 100);
  const achPct = Math.min(100, (achWeighted / 10) * 100);

  // Component 1
  const mVal = document.getElementById('mcda-marks-val');
  const mBar = document.getElementById('mcda-marks-bar');
  const mDet = document.getElementById('mcda-marks-detail');
  if (mVal) mVal.textContent = `${marksWeighted.toFixed(1)} / 70 pts`;
  if (mBar) mBar.style.width = `${marksPct}%`;
  if (mDet) mDet.textContent = `Raw Subject Mean: ${(mcda.marks_score || data.statistical_metrics?.mean || 0).toFixed(1)}/100 (Weight: 70%)`;

  // Component 2
  const aVal = document.getElementById('mcda-att-val');
  const aBar = document.getElementById('mcda-att-bar');
  const aDet = document.getElementById('mcda-att-detail');
  if (aVal) aVal.textContent = `${attWeighted.toFixed(1)} / 20 pts`;
  if (aBar) aBar.style.width = `${attPct}%`;
  if (aDet) aDet.textContent = `Classroom Attendance: ${(mcda.attendance_score || data.overall_attendance || 0).toFixed(1)}% (Weight: 20%)`;

  // Component 3
  const acVal = document.getElementById('mcda-ach-val');
  const acBar = document.getElementById('mcda-ach-bar');
  const acDet = document.getElementById('mcda-ach-detail');
  if (acVal) acVal.textContent = `${achWeighted.toFixed(1)} / 10 pts`;
  if (acBar) acBar.style.width = `${achPct}%`;
  if (acDet) acDet.textContent = `Verified Co-Curriculars: ${Math.round((mcda.achievements_score || 75) / 12.5)} verified milestones (Weight: 10%)`;
}

function filterRecs(priority) {
  activeRecFilter = priority;

  // Update filter buttons styling
  const buttons = document.querySelectorAll('#rec-filter-pills .demo-chip');
  buttons.forEach(btn => {
    const isTarget = (priority === 'ALL' && btn.textContent.includes('All')) ||
                     btn.textContent.toUpperCase().includes(priority);
    if (isTarget) {
      btn.style.background = 'rgba(56, 189, 248, 0.35)';
      btn.style.borderColor = 'var(--accent-cyan)';
    } else {
      btn.style.background = 'rgba(56, 189, 248, 0.1)';
      btn.style.borderColor = 'rgba(56, 189, 248, 0.25)';
    }
  });

  const filtered = priority === 'ALL'
    ? allRecommendations
    : allRecommendations.filter(r => (r.priority || '').toUpperCase() === priority);

  const countText = document.getElementById('rec-filter-count');
  if (countText) {
    countText.textContent = `Showing ${filtered.length} of ${allRecommendations.length} action items`;
  }

  renderRecommendations(filtered);
}

function renderRecommendations(items) {
  const container = document.getElementById('recommendations-container');
  if (!items || items.length === 0) {
    container.innerHTML = `<div class="glass-card" style="text-align: center; color: var(--text-dim); padding: 36px;">No recommendations found in filter "${activeRecFilter}". Run an AI scan to diagnose current academic metrics.</div>`;
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
      ? `<div style="display: flex; align-items: center; gap: 8px;">
           <span class="kpi-pill pill-green">✓ Completed</span>
           <button class="btn btn-secondary btn-sm" onclick="toggleStatus(${r.id}, 'Active')" style="font-size: 0.74rem;">Reopen</button>
         </div>`
      : `<button class="btn btn-primary btn-sm" onclick="toggleStatus(${r.id}, 'Completed')">Mark Completed ✓</button>`;

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
      showToast(`Agent Scan Complete: ${res.data.alerts_generated || (res.data.alerts || []).length} proactive alerts diagnosed.`, 'success');
      await loadRecommendationsAndAnalysis();
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>🔄</span> Run AI Heuristic Scan';
  }
}

async function toggleStatus(id, newStatus) {
  try {
    const res = await apiCall(`/recommendations/${id}`, 'PUT', { status: newStatus });
    if (res.success) {
      showToast(`Recommendation marked as ${newStatus.toLowerCase()}.`, 'success');
      await loadRecommendationsAndAnalysis();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}
