// Achievements Page Controller
let allAchievements = [];
let activeCategory = 'All';
let studentId = 1;

document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth();
  if (!user) return;
  initLayout();

  studentId = user.studentId || 1;

  // Set default date for form to today
  const dateInput = document.getElementById('modal-ach-date');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  await loadAchievements();

  // Add Achievement Form Submission
  const form = document.getElementById('ach-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        student_id: studentId,
        title: document.getElementById('modal-ach-title').value.trim(),
        category: document.getElementById('modal-ach-category').value,
        achievement_date: document.getElementById('modal-ach-date').value,
        description: document.getElementById('modal-ach-desc').value.trim(),
        certificate_url: document.getElementById('modal-ach-url').value.trim(),
        status: 'Verified'
      };

      try {
        const res = await apiCall('/achievements', 'POST', payload);
        if (res.success) {
          showToast('New achievement logged and verified successfully!', 'success');
          closeModal('add-ach-modal');
          form.reset();
          await loadAchievements();
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }
});

async function loadAchievements() {
  try {
    const res = await apiCall(`/achievements/${studentId}`);
    if (!res.success) throw new Error(res.message);

    allAchievements = res.data;
    filterAchievements(activeCategory);

  } catch (err) {
    console.error('[Achievements Load Error]', err);
    showToast('Failed to load achievement milestones', 'error');
  }
}

function matchesCategory(itemCategory, targetCategory) {
  if (targetCategory === 'All') return true;
  const ic = (itemCategory || '').toLowerCase();
  const tc = targetCategory.toLowerCase();
  if (ic === tc) return true;
  if (tc.includes('hackathon') && ic.includes('hackathon')) return true;
  if (tc.includes('competition') && ic.includes('competition')) return true;
  if (tc.includes('paper') && ic.includes('paper')) return true;
  if ((tc.includes('nptel') || tc.includes('cert')) && (ic.includes('nptel') || ic.includes('cert'))) return true;
  if (tc.includes('ieee') && ic.includes('ieee')) return true;
  if ((tc.includes('vendor') || tc.includes('workshop') || tc.includes('training')) && 
      (ic.includes('vendor') || ic.includes('workshop') || ic.includes('training'))) return true;
  if (tc.includes('sports') && ic.includes('sports')) return true;
  return ic.includes(tc) || tc.includes(ic);
}

function filterAchievements(cat) {
  activeCategory = cat;

  // Update chip styles
  const buttons = document.querySelectorAll('#category-filter-pills .demo-chip');
  buttons.forEach(btn => {
    const isTarget = (cat === 'All' && btn.textContent.includes('All')) ||
                     btn.textContent.toLowerCase().includes(cat.toLowerCase()) ||
                     (cat.toLowerCase().includes('nptel') && btn.textContent.includes('NPTEL')) ||
                     (cat.toLowerCase().includes('vendor') && btn.textContent.includes('Vendor'));
    if (isTarget) {
      btn.style.background = 'rgba(56, 189, 248, 0.35)';
      btn.style.borderColor = 'var(--accent-cyan)';
    } else {
      btn.style.background = 'rgba(56, 189, 248, 0.15)';
      btn.style.borderColor = 'rgba(56, 189, 248, 0.3)';
    }
  });

  const filtered = cat === 'All' 
    ? allAchievements 
    : allAchievements.filter(a => matchesCategory(a.category, cat));

  renderAchievementsGrid(filtered);
}

function renderAchievementsGrid(items) {
  const container = document.getElementById('achievements-card-grid');
  if (!items || items.length === 0) {
    container.innerHTML = `<div class="glass-card" style="grid-column: 1 / -1; text-align: center; color: var(--text-dim); padding: 36px;">No achievements found in category "${activeCategory}".</div>`;
    return;
  }

  const categoryIcons = {
    'Hackathons': '🚀',
    'Hackathon': '🚀',
    'Technical competitions': '💻',
    'Technical Competition': '💻',
    'Paper presentations': '📄',
    'Paper Presentation': '📄',
    'NPTEL courses and certifications': '📜',
    'Certification': '📜',
    'IEEE membership': '⚡',
    'External vendor training': '🛠️',
    'Workshop': '🛠️',
    'Sports': '🏅'
  };

  container.innerHTML = items.map(a => {
    const icon = categoryIcons[a.category] || '🏆';
    const dateFormatted = new Date(a.achievement_date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });

    const isSafeUrl = a.certificate_url && /^https?:\/\//i.test(a.certificate_url);
    const certBtn = isSafeUrl 
      ? `<a href="${a.certificate_url}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 4px 10px;">View Credential 🔗</a>`
      : `<span style="font-size: 0.75rem; color: #34d399; font-weight: 500;">✓ Verified Credential</span>`;

    return `
      <div class="glass-card" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <span style="font-size: 1.8rem;">${icon}</span>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="kpi-pill pill-blue">${a.category}</span>
              <span class="kpi-pill pill-green" style="font-size: 0.7rem;">Verified</span>
            </div>
          </div>
          <h3 style="font-size: 1.05rem; font-weight: 700; color: #fff; margin-bottom: 6px;">${a.title}</h3>
          <p style="color: var(--text-muted); font-size: 0.84rem; line-height: 1.5; margin-bottom: 14px;">
            ${a.description || 'Verified co-curricular contribution logged under departmental supervision.'}
          </p>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 8px;">
          <span style="font-size: 0.78rem; color: var(--text-dim);">📅 ${dateFormatted}</span>
          ${certBtn}
        </div>
      </div>
    `;
  }).join('');
}
