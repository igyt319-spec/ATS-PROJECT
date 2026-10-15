// User Profile Controller - Strict Role Separation & Authentic Identity
let isEditMode = false;
let currentUser = null;
let profileUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = checkAuth();
  if (!currentUser) return;
  initLayout();

  if (currentUser.role === 'admin') {
    const badge = document.getElementById('sidebar-role-badge');
    if (badge) badge.textContent = 'ADMIN CONSOLE';
    const sub = document.getElementById('profile-form-subtitle');
    if (sub) sub.textContent = 'Administrator account credentials and institutional governance profile';
  } else if (currentUser.role === 'faculty') {
    const badge = document.getElementById('sidebar-role-badge');
    if (badge) badge.textContent = currentUser.facultyRole === 'hod' ? 'HOD CONSOLE' : 'MENTOR CONSOLE';
    const sub = document.getElementById('profile-form-subtitle');
    if (sub) sub.textContent = currentUser.facultyRole === 'hod' ? 'Department leadership credentials and official scope' : 'Faculty mentor credentials and advisory details';
  }

  await loadProfileData();

  // Profile Edit Form Submit (Uses authenticated user's own endpoint /api/auth/me)
  const form = document.getElementById('profile-edit-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('btn-save-profile');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving... ⏳';

      const payload = {};
      if (currentUser.role === 'student') {
        payload.phone = document.getElementById('prof-phone').value.trim();
        payload.bio = document.getElementById('prof-bio').value.trim();
      } else if (currentUser.role === 'faculty') {
        payload.phone = document.getElementById('prof-phone').value.trim();
        payload.bio = document.getElementById('prof-bio').value.trim();
        payload.name = document.getElementById('prof-name').value.trim();
      } else {
        payload.name = document.getElementById('prof-name').value.trim();
      }

      try {
        const res = await apiCall('/auth/me', 'PUT', payload);
        if (res.success) {
          showToast(res.message || 'Profile updated successfully.', 'success');
          
          // Update local session user object
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
  }

  // Avatar Photo Form Submit
  const avatarForm = document.getElementById('avatar-form');
  const fileInput = document.getElementById('avatar-file-input');
  const urlInput = document.getElementById('avatar-url-input');

  if (fileInput) {
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
  }

  if (avatarForm) {
    avatarForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-save-avatar');
      btn.disabled = true;
      btn.textContent = 'Uploading... ⏳';

      let avatarData = urlInput ? urlInput.value.trim() : '';
      const file = fileInput ? fileInput.files[0] : null;

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
  }
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
      const profileImg = document.getElementById('profile-img');
      if (profileImg) profileImg.src = updatedUrl;
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
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Update Photo';
    }
  }
}

// Load Authenticated User Profile (Zero cross-role or cross-user mixing)
async function loadProfileData() {
  try {
    const res = await apiCall('/auth/me');
    if (!res.success || !res.user) throw new Error(res.message || 'Failed to retrieve profile');

    profileUser = res.user;
    const role = profileUser.role;

    // Header Display
    const profileImg = document.getElementById('profile-img');
    const fallbackAvatar = getInitialsAvatar(profileUser.name, 110);
    profileImg.src = profileUser.avatar || fallbackAvatar;
    profileImg.onerror = () => { profileImg.src = fallbackAvatar; };

    const nameEl = document.getElementById('profile-display-name');
    const regnoEl = document.getElementById('profile-display-regno');
    const deptEl = document.getElementById('profile-display-dept');
    const metaEl = document.getElementById('profile-display-meta');
    const summaryTitle = document.getElementById('prof-summary-title');
    const summarySubtitle = document.getElementById('prof-summary-subtitle');
    const summaryContent = document.getElementById('prof-summary-content');

    if (role === 'student') {
      const st = profileUser.student || {};
      nameEl.textContent = st.name || profileUser.name;
      regnoEl.textContent = st.register_number || profileUser.register_number || 'STUDENT';
      regnoEl.className = 'kpi-pill pill-blue';
      deptEl.textContent = st.department || profileUser.department || 'Department';
      metaEl.textContent = `${st.year || 'III Year'} • ${st.semester || 'Semester 5'} • Register No: ${st.register_number || profileUser.register_number}`;

      // Form Inputs
      document.getElementById('prof-name').value = st.name || profileUser.name;
      document.getElementById('prof-regno').value = st.register_number || profileUser.register_number || '';
      document.getElementById('prof-email').value = st.email || profileUser.email;
      document.getElementById('prof-phone').value = st.phone || '';
      document.getElementById('prof-dept').value = st.department || profileUser.department || '';
      document.getElementById('prof-year').value = `${st.year || 'III Year'} • ${st.semester || 'Sem 5'}`;
      document.getElementById('prof-bio').value = st.bio || '';

      // Summary Card: Student Academic Standing
      if (summaryTitle) summaryTitle.textContent = 'Academic Highlights';
      if (summarySubtitle) summarySubtitle.textContent = 'Verified Student Database Standing';
      if (summaryContent) {
        const riskLevel = st.risk_level || 'LOW';
        const riskClass = riskLevel === 'HIGH' ? 'pill-red' : riskLevel === 'MEDIUM' ? 'pill-yellow' : 'pill-green';
        summaryContent.innerHTML = `
          <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
            <span style="color: var(--text-dim);">Cumulative CGPA:</span>
            <strong style="color: #38bdf8;">${Number(st.cgpa || 0).toFixed(2)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
            <span style="color: var(--text-dim);">Current SGPA:</span>
            <strong style="color: #34d399;">${Number(st.gpa || 0).toFixed(2)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
            <span style="color: var(--text-dim);">Attendance Ratio:</span>
            <strong style="color: #fbbf24;">${Number(st.attendance_percentage || 0).toFixed(1)}%</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
            <span style="color: var(--text-dim);">Academic Score:</span>
            <strong style="color: #fff;">${Number(st.academic_score || 0)} / 100</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
            <span style="color: var(--text-dim);">Current Semester:</span>
            <strong style="color: #c084fc;">${st.semester || 'Semester 5'}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--text-dim);">Risk Categorization:</span>
            <span class="kpi-pill ${riskClass}">${riskLevel}</span>
          </div>
        `;
      }

    } else if (role === 'faculty') {
      const fac = profileUser.faculty || {};
      const isHod = Boolean(fac.is_hod || profileUser.faculty_role === 'hod');

      nameEl.textContent = fac.name || profileUser.name;
      regnoEl.textContent = fac.faculty_code || profileUser.register_number || `FAC-${fac.id || profileUser.id}`;
      regnoEl.className = isHod ? 'kpi-pill pill-yellow' : 'kpi-pill pill-green';
      regnoEl.textContent = isHod ? 'HEAD OF DEPARTMENT' : 'FACULTY MENTOR';
      deptEl.textContent = fac.department || profileUser.department || 'Department';
      metaEl.textContent = `${fac.designation || (isHod ? 'Head of Department' : 'Faculty Member')} • ${fac.department || profileUser.department}`;

      // Form Inputs
      document.getElementById('prof-name').value = fac.name || profileUser.name;
      document.getElementById('prof-regno').value = fac.faculty_code || profileUser.register_number || `FAC-${fac.id || profileUser.id}`;
      document.getElementById('prof-email').value = fac.email || profileUser.email;
      document.getElementById('prof-phone').value = fac.phone || '';
      document.getElementById('prof-dept').value = fac.department || profileUser.department || '';
      document.getElementById('prof-year').value = fac.designation || (isHod ? 'Head of Department' : 'Faculty Mentor');
      document.getElementById('prof-bio').value = fac.bio || `Faculty mentor in ${fac.department || 'Department'}.`;

      // Summary Card: Faculty & Advisory Standing
      if (summaryTitle) summaryTitle.textContent = isHod ? 'Department Leadership Standing' : 'Faculty Advisory Standing';
      if (summarySubtitle) summarySubtitle.textContent = 'Verified Institutional Faculty Profile';
      if (summaryContent) {
        summaryContent.innerHTML = `
          <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
            <span style="color: var(--text-dim);">Department Scope:</span>
            <strong style="color: #38bdf8;">${fac.department || profileUser.department || 'Department'}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
            <span style="color: var(--text-dim);">Official Designation:</span>
            <strong style="color: #34d399;">${fac.designation || (isHod ? 'Head of Department' : 'Faculty Member')}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
            <span style="color: var(--text-dim);">Active Assigned Mentees:</span>
            <strong style="color: #fbbf24;">${fac.mentee_count || 0} Scholars</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
            <span style="color: var(--text-dim);">Department Leadership:</span>
            <strong style="color: ${isHod ? '#facc15' : 'var(--text-muted)'};">${isHod ? '👑 Active HOD' : 'Faculty Member'}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
            <span style="color: var(--text-dim);">Faculty Code:</span>
            <strong style="font-family: monospace; color: #fff;">${fac.faculty_code || 'FAC-' + (fac.id || profileUser.id)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--text-dim);">Account Status:</span>
            <span class="kpi-pill pill-green">ACTIVE IN DATABASE</span>
          </div>
        `;
      }

    } else if (role === 'admin') {
      nameEl.textContent = profileUser.name;
      regnoEl.textContent = 'SYSTEM ADMINISTRATOR';
      regnoEl.className = 'kpi-pill pill-purple';
      deptEl.textContent = 'Institution Administration';
      metaEl.textContent = 'ATS Root Administrator • Cross-Departmental Governance & Security';

      // Form Inputs
      document.getElementById('prof-name').value = profileUser.name;
      document.getElementById('prof-regno').value = profileUser.register_number || 'SYS-ADMIN';
      document.getElementById('prof-email').value = profileUser.email;
      document.getElementById('prof-phone').value = '—';
      document.getElementById('prof-dept').value = 'Institution Administration';
      document.getElementById('prof-year').value = 'Administrator';
      document.getElementById('prof-bio').value = 'Institutional system administrator with governance authority over academic records, users, and audit logs.';

      // Summary Card: Admin Institutional Scope
      if (summaryTitle) summaryTitle.textContent = 'Administrative Scope';
      if (summarySubtitle) summarySubtitle.textContent = 'Institutional Governance Authority';
      if (summaryContent) {
        summaryContent.innerHTML = `
          <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
            <span style="color: var(--text-dim);">Administrative Role:</span>
            <strong style="color: #c084fc;">Root Administrator</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
            <span style="color: var(--text-dim);">Institutional Scope:</span>
            <strong style="color: #38bdf8;">All Departments</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
            <span style="color: var(--text-dim);">Policy Enforcement:</span>
            <strong style="color: #34d399;">Strict RBAC</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
            <span style="color: var(--text-dim);">Audit Logging:</span>
            <strong style="color: #fbbf24;">Immutable Trail Active</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
            <span style="color: var(--text-dim);">Security Level:</span>
            <strong style="color: #fff;">Superadmin (Level 1)</strong>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--text-dim);">Account Status:</span>
            <span class="kpi-pill pill-blue">ONLINE</span>
          </div>
        `;
      }
    }

    // Set Institutional Account Identifier
    const secIdEl = document.getElementById('sec-user-identifier');
    if (secIdEl) {
      secIdEl.textContent = profileUser.register_number || profileUser.email || `ID: ${profileUser.id}`;
    }

  } catch (err) {
    console.error('[Profile Load Error]', err);
    showToast('Failed to load profile details: ' + err.message, 'error');
  }
}

function toggleEditMode() {
  isEditMode = !isEditMode;

  const role = currentUser ? currentUser.role : 'student';

  if (role === 'student') {
    // Least-privilege: student only updates Phone and Bio
    document.getElementById('prof-phone').disabled = !isEditMode;
    document.getElementById('prof-bio').disabled = !isEditMode;
    document.getElementById('prof-name').disabled = true;
    document.getElementById('prof-email').disabled = true;
    document.getElementById('prof-dept').disabled = true;
    document.getElementById('prof-year').disabled = true;
    document.getElementById('prof-regno').disabled = true;
  } else if (role === 'faculty') {
    // Faculty can update Phone, Bio, Name
    document.getElementById('prof-phone').disabled = !isEditMode;
    document.getElementById('prof-bio').disabled = !isEditMode;
    document.getElementById('prof-name').disabled = !isEditMode;
    document.getElementById('prof-email').disabled = true;
    document.getElementById('prof-dept').disabled = true;
    document.getElementById('prof-year').disabled = true;
    document.getElementById('prof-regno').disabled = true;
  } else {
    // Admin can update Name
    document.getElementById('prof-name').disabled = !isEditMode;
    document.getElementById('prof-email').disabled = true;
    document.getElementById('prof-phone').disabled = true;
    document.getElementById('prof-dept').disabled = true;
    document.getElementById('prof-year').disabled = true;
    document.getElementById('prof-regno').disabled = true;
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

// Toggle password visibility
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🔒';
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
  }
}

// Password Change Event Listener
document.addEventListener('DOMContentLoaded', () => {
  const pwdForm = document.getElementById('password-change-form');
  if (pwdForm) {
    pwdForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById('pwd-current').value;
      const newPassword = document.getElementById('pwd-new').value;
      const confirmPassword = document.getElementById('pwd-confirm').value;
      const errEl = document.getElementById('pwd-error-msg');
      const submitBtn = document.getElementById('btn-change-password');

      errEl.style.display = 'none';
      errEl.textContent = '';

      if (newPassword !== confirmPassword) {
        errEl.textContent = 'New password and confirmation do not match.';
        errEl.style.display = 'block';
        return;
      }

      if (newPassword.length < 6) {
        errEl.textContent = 'New password must be at least 6 characters in length.';
        errEl.style.display = 'block';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying & Updating... ⏳';

      try {
        const res = await apiCall('/auth/change-password', 'PUT', {
          currentPassword,
          newPassword
        });

        if (res.success) {
          showToast(res.message || 'Password successfully updated!', 'success');
          pwdForm.reset();
        } else {
          errEl.textContent = res.message || 'Password update failed.';
          errEl.style.display = 'block';
          showToast(res.message || 'Password update failed.', 'error');
        }
      } catch (err) {
        errEl.textContent = err.message || 'Error communicating with authentication server.';
        errEl.style.display = 'block';
        showToast(err.message || 'Password update failed.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update Password';
      }
    });
  }

  // Profile Photo Upload & Preview
  const avatarForm = document.getElementById('avatar-form');
  const avatarFileInput = document.getElementById('avatar-file-input');
  const avatarUrlInput = document.getElementById('avatar-url-input');
  const avatarPreviewContainer = document.getElementById('avatar-preview-container');
  const avatarPreviewImg = document.getElementById('avatar-preview-img');
  let selectedBase64 = null;

  if (avatarFileInput) {
    avatarFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        showToast('Image size exceeds 2MB limit.', 'error');
        avatarFileInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        selectedBase64 = loadEvt.target.result;
        if (avatarPreviewImg) avatarPreviewImg.src = selectedBase64;
        if (avatarPreviewContainer) avatarPreviewContainer.style.display = 'block';
        if (avatarUrlInput) avatarUrlInput.value = '';
      };
      reader.readAsDataURL(file);
    });
  }

  if (avatarUrlInput) {
    avatarUrlInput.addEventListener('input', (e) => {
      const url = e.target.value.trim();
      if (url.startsWith('http://') || url.startsWith('https://')) {
        selectedBase64 = null;
        if (avatarFileInput) avatarFileInput.value = '';
        if (avatarPreviewImg) avatarPreviewImg.src = url;
        if (avatarPreviewContainer) avatarPreviewContainer.style.display = 'block';
      }
    });
  }

  if (avatarForm) {
    avatarForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('btn-save-avatar');
      const urlVal = avatarUrlInput ? avatarUrlInput.value.trim() : '';
      const payloadData = selectedBase64 || urlVal;

      if (!payloadData) {
        showToast('Please select an image file or enter a valid web image URL.', 'error');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Uploading... ⏳';

      try {
        const res = await apiCall('/upload/avatar', 'POST', { imageData: payloadData });
        if (res.success && res.avatarUrl) {
          showToast('Profile photo updated successfully!', 'success');
          const profileImg = document.getElementById('profile-img');
          const topbarAvatar = document.getElementById('topbar-user-avatar');
          if (profileImg) profileImg.src = res.avatarUrl;
          if (topbarAvatar) topbarAvatar.src = res.avatarUrl;

          // Update session
          const sessionUser = getCurrentUser();
          if (sessionUser) {
            sessionUser.avatar = res.avatarUrl;
            setSession(getToken(), sessionUser);
          }

          closeModal('avatar-upload-modal');
          avatarForm.reset();
          selectedBase64 = null;
          if (avatarPreviewContainer) avatarPreviewContainer.style.display = 'none';
        } else {
          showToast(res.message || 'Avatar upload failed.', 'error');
        }
      } catch (err) {
        showToast(err.message || 'Avatar upload failed.', 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Update Photo';
      }
    });
  }
});

