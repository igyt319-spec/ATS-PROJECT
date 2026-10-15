// ATS Authentication Client Controller - 4 Dedicated Role Login Modes
let selectedRole = 'student';

function selectRole(role) {
  selectedRole = role;
  const roles = ['student', 'faculty', 'hod', 'admin'];
  roles.forEach(r => {
    const tab = document.getElementById(`tab-${r}`);
    if (tab) {
      if (r === role) tab.classList.add('active');
      else tab.classList.remove('active');
    }
  });

  const heading = document.getElementById('login-heading');
  const subheading = document.getElementById('login-subheading');
  const label = document.getElementById('identifier-label');
  const input = document.getElementById('login-identifier');

  if (role === 'student') {
    if (heading) heading.textContent = 'Student Login';
    if (subheading) subheading.textContent = 'Sign in with your Register Number to access your personal academic dashboard.';
    if (label) label.textContent = 'Register Number / Student Email';
    if (input) input.placeholder = 'e.g. BITD0001 or student@ats.com';
  } else if (role === 'faculty') {
    if (heading) heading.textContent = 'Faculty & Mentor Login';
    if (subheading) subheading.textContent = 'Sign in to access your assigned mentee roster, leave approvals, and student records.';
    if (label) label.textContent = 'Faculty ID / Institutional Email';
    if (input) input.placeholder = 'e.g. mentor.cse@ats.com';
  } else if (role === 'hod') {
    if (heading) heading.textContent = 'Head of Department (HOD) Login';
    if (subheading) subheading.textContent = 'Sign in to access your department console, faculty allocations, and academic analytics.';
    if (label) label.textContent = 'HOD ID / Department Email';
    if (input) input.placeholder = 'e.g. faculty.cse@example.test';
  } else if (role === 'admin') {
    if (heading) heading.textContent = 'System Administrator Login';
    if (subheading) subheading.textContent = 'Sign in with institutional administrative credentials to configure the platform.';
    if (label) label.textContent = 'Administrator Email / Username';
    if (input) input.placeholder = 'e.g. admin@ats.com';
  }
  hideError();
}

function showError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function hideError() {
  const el = document.getElementById('login-error');
  el.style.display = 'none';
}

function getRoleRedirect(user) {
  if (!user) return 'login.html';
  if (user.role === 'admin') return 'admin-dashboard.html';
  if (user.role === 'faculty') {
    if (user.facultyRole === 'hod') return 'hod-dashboard.html';
    return 'mentor-dashboard.html';
  }
  return 'dashboard.html';
}

document.addEventListener('DOMContentLoaded', () => {
  // If already logged in, redirect appropriately based on role
  const existingUser = getCurrentUser();
  if (existingUser && getToken()) {
    window.location.href = getRoleRedirect(existingUser);
    return;
  }

  // Toggle Password Visibility
  const toggleBtn = document.getElementById('toggle-password');
  const pwdInput = document.getElementById('login-password');
  toggleBtn.addEventListener('click', () => {
    if (pwdInput.type === 'password') {
      pwdInput.type = 'text';
      toggleBtn.textContent = '🙈';
    } else {
      pwdInput.type = 'password';
      toggleBtn.textContent = '👁️';
    }
  });

  // Login Form Submission
  const form = document.getElementById('login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const identifier = document.getElementById('login-identifier').value.trim();
    const password = document.getElementById('login-password').value;
    const btnSubmit = document.getElementById('btn-submit');
    const btnText = document.getElementById('btn-text');
    const btnSpinner = document.getElementById('btn-spinner');

    if (!identifier || !password) {
      showError('Please fill in both your register number/email and password.');
      return;
    }

    // Set Loading State
    btnSubmit.disabled = true;
    btnText.style.display = 'none';
    btnSpinner.style.display = 'inline';

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password, role: selectedRole })
      });

      let data = {};
      try {
        data = await response.json();
      } catch (jsonErr) {
        data = { success: false, message: `Server returned HTTP ${response.status} (${response.statusText || 'Error'})` };
      }

      if (!response.ok || !data.success) {
        showError(data.message || 'Invalid credentials. Please verify your username and password.');
        btnSubmit.disabled = false;
        btnText.style.display = 'inline';
        btnSpinner.style.display = 'none';
        return;
      }

      // Success
      setSession(data.token, data.user);
      showToast(`Welcome, ${data.user.name}! Redirecting...`, 'success');

      // Success visual feedback
      btnSubmit.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      btnSpinner.textContent = 'Access Granted ✓';

      const targetUrl = getRoleRedirect(data.user);

      setTimeout(() => {
        window.location.href = targetUrl;
      }, 700);

    } catch (err) {
      console.error('[Login Connection Error]', err);
      const isFetchError = err instanceof TypeError || (err.message && err.message.toLowerCase().includes('fetch'));
      const detail = isFetchError 
        ? `Unable to connect to authentication server. Please verify the backend is running at ${API_BASE_URL}.` 
        : (err.message || 'Network connection failed.');
      showError(detail);
      btnSubmit.disabled = false;
      btnText.style.display = 'inline';
      btnSpinner.style.display = 'none';
    }
  });

  // Forgot Password Form
  const forgotForm = document.getElementById('forgot-form');
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('forgot-email').value;
      const statusEl = document.getElementById('forgot-status');

      try {
        const res = await apiCall('/auth/forgot-password', 'POST', { email });
        statusEl.className = 'pill-green';
        statusEl.style.display = 'block';
        statusEl.textContent = res.message;
        setTimeout(() => {
          closeModal('forgot-modal');
        }, 2200);
      } catch (err) {
        statusEl.className = 'pill-red';
        statusEl.style.display = 'block';
        statusEl.textContent = err.message;
      }
    });
  }
});
