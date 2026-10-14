/**
 * ATS Client-Side API Helper & Core UI Controller
 * Manages authentication, token storage, request execution, and global widgets.
 */

const API_BASE_URL = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null' && !window.location.origin.startsWith('file'))
  ? `${window.location.origin}/api`
  : 'http://localhost:3000/api';

// Toast Notification Manager
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span> <div>${message}</div>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Session Management
function getToken() {
  return localStorage.getItem('ats_token');
}

function getCurrentUser() {
  const userStr = localStorage.getItem('ats_user');
  try {
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
}

function setSession(token, user) {
  localStorage.setItem('ats_token', token);
  localStorage.setItem('ats_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('ats_token');
  localStorage.removeItem('ats_user');
}

function logout() {
  clearSession();
  window.location.href = 'login.html';
}

// Protected Route Guard
function checkAuth(requiredRole = null) {
  const token = getToken();
  const user = getCurrentUser();

  if (!token || !user) {
    window.location.href = 'login.html';
    return null;
  }

  const roleAllowed = !requiredRole || user.role === requiredRole || (requiredRole === 'admin' && user.role === 'faculty');
  if (!roleAllowed) {
    if (user.role === 'admin' || user.role === 'faculty') {
      window.location.href = 'admin-dashboard.html';
    } else {
      window.location.href = 'dashboard.html';
    }
    return null;
  }

  return user;
}

// Unified API Caller
async function apiCall(endpoint, method = 'GET', body = null) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        // Session expired
        if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('index.html')) {
          clearSession();
          window.location.href = 'login.html';
        }
      }
      throw new Error(data.message || `Server request failed with status ${res.status}`);
    }

    return data;
  } catch (error) {
    console.error(`[API Error: ${method} ${endpoint}]`, error);
    showToast(error.message, 'error');
    throw error;
  }
}

// Modal Controllers
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('open');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('open');
  }
}

// Initialize Topbar Info & Event Listeners
function initLayout() {
  const user = getCurrentUser();
  if (user) {
    const nameEl = document.getElementById('topbar-user-name');
    const roleEl = document.getElementById('topbar-user-role');
    const avatarEl = document.getElementById('topbar-user-avatar');

    if (nameEl) nameEl.textContent = user.name || 'User';
    if (roleEl) roleEl.textContent = user.role === 'admin' ? 'Administrator' : user.role === 'faculty' ? 'Faculty' : (user.register_number || 'Student');
    if (avatarEl && user.avatar) avatarEl.src = user.avatar;

    // If admin is browsing pages, ensure sidebar Dashboard links to admin-dashboard.html
    if (user.role === 'admin' || user.role === 'faculty') {
      const dashLinks = document.querySelectorAll('.sidebar-nav a[href="dashboard.html"]');
      dashLinks.forEach(link => {
        link.href = 'admin-dashboard.html';
      });
      const brandRole = document.getElementById('sidebar-role-badge');
      if (brandRole) brandRole.textContent = 'ADMIN CONSOLE';
    }
  }

  // Display Current Date
  const dateEl = document.getElementById('topbar-current-date');
  if (dateEl) {
    const now = new Date();
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    dateEl.textContent = `📅 ${now.toLocaleDateString('en-US', options)}`;
  }

  // Mobile menu button toggle
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.querySelector('.sidebar');
  if (mobileBtn && sidebar) {
    mobileBtn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
    });
  }

  // Bind close buttons for any modal
  document.querySelectorAll('.modal-close, [data-modal-close]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-backdrop');
      if (modal) modal.classList.remove('open');
    });
  });

  // Fetch unread notifications count if student
  if (user && user.role === 'student') {
    fetchUnreadNotificationsCount(user.studentId || 1);
  }
}

async function fetchUnreadNotificationsCount(studentId) {
  try {
    const data = await apiCall(`/notifications/${studentId}`);
    const badge = document.getElementById('unread-notif-badge');
    const navBadge = document.getElementById('sidebar-notif-badge');
    if (badge && data.unreadCount > 0) {
      badge.textContent = data.unreadCount;
      badge.style.display = 'flex';
    } else if (badge) {
      badge.style.display = 'none';
    }
    if (navBadge && data.unreadCount > 0) {
      navBadge.textContent = data.unreadCount;
      navBadge.style.display = 'inline-block';
    } else if (navBadge) {
      navBadge.style.display = 'none';
    }
  } catch (e) {
    // Non-blocking notification check
  }
}
