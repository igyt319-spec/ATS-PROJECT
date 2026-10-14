// Achievements Page Controller
let allAchievements = [];
let activeCategory = 'All';
let studentId = 1;

document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth();
  if (!user) return;
  initLayout();

  studentId = user.studentId || 1;

  if (user.role === 'admin' || user.role === 'faculty') {
    document.getElementById('sidebar-role-badge').textContent = 'ADMIN CONSOLE';
  }

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

function filterAchievements(cat) {
  activeCategory = cat;

  // Update chip styles
  const buttons = document.querySelectorAll('#category-filter-pills .demo-chip');
  buttons.forEach(btn => {
    if (btn.textContent.includes(cat) || (cat === 'All' && btn.textContent.includes('All'))) {
      btn.style.background = 'rgba(56, 189, 248, 0.35)';
      btn.style.borderColor = 'var(--accent-cyan)';
    } else {
      btn.style.background = 'rgba(56, 189, 248, 0.15)';
      btn.style.borderColor = 'rgba(56, 189, 248, 0.3)';
    }
  });

  const filtered = cat === 'All' 
    ? allAchievements 
    : allAchievements.filter(a => a.category === cat);

  renderAchievementsGrid(filtered);
}

function renderAchievementsGrid(items) {
  const container = document.getElementById('achievements-card-grid');
  if (!items || items.length === 0) {
    container.innerHTML = `<div class="glass-card" style="grid-column: 1 / -1; text-align: center; color: var(--text-dim); padding: 36px;">No achievements found in category "${activeCategory}".</div>`;
    return;
  }

  const categoryIcons = {
    'Hackathon': '🚀',
    'Paper Presentation': '📄',
    'Workshop': '🛠️',
    'Certification': '📜',
    'Sports': '🏅',
    'Technical Competition': '💻'
  };

  container.innerHTML = items.map(a => {
    const icon = categoryIcons[a.category] || '🏆';
    const dateFormatted = new Date(a.achievement_date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });

    const certBtn = a.certificate_url 
      ? `<a href="${a.certificate_url}" target="_blank" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 4px 10px;">View Credential 🔗</a>`
      : `<span style="font-size: 0.75rem; color: var(--text-dim);">Internal Verified</span>`;

    return `
      <div class="glass-card" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <span style="font-size: 1.8rem;">${icon}</span>
            <span class="kpi-pill pill-blue">${a.category}</span>
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
