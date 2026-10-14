// Student Profile Controller
let studentId = 1;
let isEditMode = false;

document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth();
  if (!user) return;
  initLayout();

  studentId = user.studentId || 1;

  if (user.role === 'admin' || user.role === 'faculty') {
    document.getElementById('sidebar-role-badge').textContent = 'ADMIN CONSOLE';
  }

  await loadProfileData();

  // Form Submit
  const form = document.getElementById('profile-edit-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('btn-save-profile');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving... ⏳';

    const payload = {
      name: document.getElementById('prof-name').value.trim(),
      email: document.getElementById('prof-email').value.trim(),
      phone: document.getElementById('prof-phone').value.trim(),
      department: document.getElementById('prof-dept').value.trim(),
      year: document.getElementById('prof-year').value.trim(),
      bio: document.getElementById('prof-bio').value.trim()
    };

    try {
      const res = await apiCall(`/students/${studentId}`, 'PUT', payload);
      if (res.success) {
        showToast('Profile credentials updated successfully in database.', 'success');
        
        // Update local session
        const currentUser = getCurrentUser();
        if (currentUser) {
          currentUser.name = payload.name;
          currentUser.email = payload.email;
          currentUser.department = payload.department;
          currentUser.year = payload.year;
          setSession(getToken(), currentUser);
        }

        toggleEditMode();
        await loadProfileData();
        initLayout();
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  });
});

async function loadProfileData() {
  try {
    const res = await apiCall(`/students/${studentId}`);
    if (!res.success) throw new Error(res.message);

    const s = res.data;

    // Header Display
    document.getElementById('profile-display-name').textContent = s.name;
    document.getElementById('profile-display-regno').textContent = s.register_number;
    document.getElementById('profile-display-dept').textContent = s.department;
    document.getElementById('profile-display-meta').textContent = 
      `${s.year} • ${s.semester} • Register No: ${s.register_number}`;
    
    if (s.avatar) {
      document.getElementById('profile-img').src = s.avatar;
    }

    // Editable Inputs
    document.getElementById('prof-name').value = s.name;
    document.getElementById('prof-regno').value = s.register_number;
    document.getElementById('prof-email').value = s.email;
    document.getElementById('prof-phone').value = s.phone || '';
    document.getElementById('prof-dept').value = s.department;
    document.getElementById('prof-year').value = s.year;
    document.getElementById('prof-bio').value = s.bio || '';

    // Academic Highlights Card
    document.getElementById('prof-stat-cgpa').textContent = Number(s.cgpa || 0).toFixed(2);
    document.getElementById('prof-stat-gpa').textContent = Number(s.gpa || 0).toFixed(2);
    document.getElementById('prof-stat-att').textContent = `${Number(s.attendance_percentage || 0).toFixed(1)}%`;
    document.getElementById('prof-stat-ach').textContent = `${(s.achievements || []).filter(a => a.status === 'Verified').length} Verified`;
    document.getElementById('prof-stat-score').textContent = `${Number(s.academic_score || 0)} / 100`;

    const riskEl = document.getElementById('prof-stat-risk');
    riskEl.textContent = s.risk_level || 'LOW';
    riskEl.className = s.risk_level === 'HIGH' ? 'kpi-pill pill-red' : s.risk_level === 'MEDIUM' ? 'kpi-pill pill-yellow' : 'kpi-pill pill-green';

  } catch (err) {
    console.error('[Profile Load Error]', err);
    showToast('Failed to load profile details', 'error');
  }
}

function toggleEditMode() {
  isEditMode = !isEditMode;
  const fields = ['prof-name', 'prof-email', 'prof-phone', 'prof-dept', 'prof-year', 'prof-bio'];
  fields.forEach(id => {
    document.getElementById(id).disabled = !isEditMode;
  });

  const saveGroup = document.getElementById('save-btn-group');
  const toggleBtn = document.getElementById('btn-toggle-edit');

  if (isEditMode) {
    saveGroup.style.display = 'flex';
    toggleBtn.textContent = '❌ Cancel Editing';
  } else {
    saveGroup.style.display = 'none';
    toggleBtn.textContent = '✏️ Edit Profile';
  }
}
