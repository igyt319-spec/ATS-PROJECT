// User Profile Controller
let studentId = 1;
let isEditMode = false;
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = checkAuth();
  if (!currentUser) return;
  initLayout();

  studentId = currentUser.studentId || 1;

  if (currentUser.role === 'admin') {
    document.getElementById('sidebar-role-badge').textContent = 'ADMIN CONSOLE';
    const sub = document.getElementById('profile-form-subtitle');
    if (sub) sub.textContent = 'Administrator management of academic credentials';
  } else if (currentUser.role === 'faculty') {
    document.getElementById('sidebar-role-badge').textContent = currentUser.facultyRole === 'hod' ? 'HOD CONSOLE' : 'MENTOR CONSOLE';
  }

  await loadProfileData();

  // Profile Edit Form Submit
  const form = document.getElementById('profile-edit-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('btn-save-profile');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving... ⏳';

    const payload = {};
    if (currentUser.role === 'student') {
      // Least-privilege: student only updates permitted fields
      payload.phone = document.getElementById('prof-phone').value.trim();
      payload.bio = document.getElementById('prof-bio').value.trim();
    } else {
      // Admin update
      payload.name = document.getElementById('prof-name').value.trim();
      payload.email = document.getElementById('prof-email').value.trim();
      payload.phone = document.getElementById('prof-phone').value.trim();
      payload.department = document.getElementById('prof-dept').value.trim();
      payload.year = document.getElementById('prof-year').value.trim();
      payload.bio = document.getElementById('prof-bio').value.trim();
    }

    try {
      const res = await apiCall(`/students/${studentId}`, 'PUT', payload);
      if (res.success) {
        showToast(res.message || 'Profile updated successfully in MySQL database.', 'success');
        
        // Update local session
        const sessionUser = getCurrentUser();
        if (sessionUser) {
          if (payload.name) sessionUser.name = payload.name;
          if (payload.phone) sessionUser.phone = payload.phone;
          setSession(getToken(), sessionUser);
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

  // Avatar Photo Form Submit
  const avatarForm = document.getElementById('avatar-form');
  const fileInput = document.getElementById('avatar-file-input');
  const urlInput = document.getElementById('avatar-url-input');

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast('Image size exceeds 2MB limit.', 'error');
        fileInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        document.getElementById('avatar-preview-img').src = e.target.result;
        document.getElementById('avatar-preview-container').style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  });

  avatarForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-avatar');
    btn.disabled = true;
    btn.textContent = 'Uploading... ⏳';

    let avatarData = urlInput.value.trim();
    const file = fileInput.files[0];

    try {
      if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64Data = e.target.result;
          await sendAvatarUpdate(base64Data, file.type, btn);
        };
        reader.readAsDataURL(file);
      } else if (avatarData) {
        await sendAvatarUpdate(avatarData, null, btn);
      } else {
        showToast('Please select an image file or enter an image URL.', 'error');
        btn.disabled = false;
        btn.textContent = 'Update Photo';
      }
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Update Photo';
    }
  });
});

async function sendAvatarUpdate(avatarStr, mimeType, btn) {
  try {
    const res = await apiCall('/upload/avatar', 'POST', {
      imageData: avatarStr,
      mimeType: mimeType
    });

    if (res.success) {
      showToast('Profile photo updated successfully in database.', 'success');
      const updatedUrl = res.avatarUrl;

      // Update UI
      document.getElementById('profile-img').src = updatedUrl;
      const topAvatar = document.getElementById('topbar-user-avatar');
      if (topAvatar) topAvatar.src = updatedUrl;

      // Update session
      const sessionUser = getCurrentUser();
      if (sessionUser) {
        sessionUser.avatar = updatedUrl;
        setSession(getToken(), sessionUser);
      }

      closeModal('avatar-upload-modal');
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Update Photo';
  }
}

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
    
    // Set individual avatar or fallback initials badge
    const fallbackAvatar = getInitialsAvatar(s.name);
    const profileImg = document.getElementById('profile-img');
    profileImg.src = s.avatar || fallbackAvatar;
    profileImg.onerror = () => { profileImg.src = fallbackAvatar; };

    // Inputs
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

  // Least-privilege: If student, only Phone and Bio are editable
  if (currentUser && currentUser.role === 'student') {
    document.getElementById('prof-phone').disabled = !isEditMode;
    document.getElementById('prof-bio').disabled = !isEditMode;
    // Institutional credentials remain locked for students
    document.getElementById('prof-name').disabled = true;
    document.getElementById('prof-email').disabled = true;
    document.getElementById('prof-dept').disabled = true;
    document.getElementById('prof-year').disabled = true;
    document.getElementById('prof-regno').disabled = true;
  } else {
    // Admin can edit all
    const allFields = ['prof-name', 'prof-email', 'prof-phone', 'prof-dept', 'prof-year', 'prof-bio'];
    allFields.forEach(id => {
      document.getElementById(id).disabled = !isEditMode;
    });
  }

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
