/**
 * ATS Client-Side API Helper & Core UI Controller
 * Manages authentication, token storage, request execution, and global widgets.
 */

const API_BASE_URL = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null' && !window.location.origin.startsWith('file'))
  ? `${window.location.origin}/api`
  : 'http://localhost:5000/api';

// Generate dynamic initials SVG avatar as resilient fallback
function getInitialsAvatar(name = 'User', size = 120) {
  const cleanName = (name || 'User').trim();
  const parts = cleanName.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/i, '').split(/[\s.]+/).filter(Boolean);
  let initials = 'U';
  if (parts.length >= 2) {
    initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  } else if (parts.length === 1 && parts[0].length >= 2) {
    initials = parts[0].substring(0, 2).toUpperCase();
  } else if (parts.length === 1) {
    initials = parts[0][0].toUpperCase();
  }

  // Consistent pleasant gradient based on name hash
  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hues = [210, 260, 160, 25, 330, 190, 280];
  const primaryHue = hues[Math.abs(hash) % hues.length];
  const secondaryHue = (primaryHue + 40) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="grad-${Math.abs(hash)}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="hsl(${primaryHue}, 75%, 45%)" />
        <stop offset="100%" stop-color="hsl(${secondaryHue}, 80%, 30%)" />
      </linearGradient>
    </defs>
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="url(#grad-${Math.abs(hash)})" />
    <text x="50%" y="54%" font-family="system-ui, -apple-system, sans-serif" font-size="${Math.floor(size * 0.42)}" font-weight="700" fill="#ffffff" dominant-baseline="middle" text-anchor="middle" letter-spacing="1">${initials}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

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

// Protected Route Guard with strict RBAC
function checkAuth(requiredRole = null) {
  const token = getToken();
  const user = getCurrentUser();

  if (!token || !user) {
    window.location.href = 'login.html';
    return null;
  }

  if (requiredRole) {
    let allowed = false;
    if (requiredRole === 'admin') {
      allowed = user.role === 'admin';
    } else if (requiredRole === 'hod') {
      allowed = user.role === 'admin' || (user.role === 'faculty' && user.facultyRole === 'hod');
    } else if (requiredRole === 'mentor') {
      allowed = user.role === 'admin' || (user.role === 'faculty' && (user.facultyRole === 'mentor' || user.facultyRole === 'hod'));
    } else if (requiredRole === 'faculty') {
      allowed = user.role === 'admin' || user.role === 'faculty';
    } else if (requiredRole === 'student') {
      allowed = user.role === 'student';
    }

    if (!allowed) {
      if (user.role === 'admin') window.location.href = 'admin-dashboard.html';
      else if (user.role === 'faculty') {
        window.location.href = user.facultyRole === 'hod' ? 'hod-dashboard.html' : 'mentor-dashboard.html';
      } else {
        window.location.href = 'dashboard.html';
      }
      return null;
    }
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
      if (res.status === 401) {
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

// Initialize Topbar Info & Navigation
function initLayout() {
  const user = getCurrentUser();
  if (user) {
    const nameEl = document.getElementById('topbar-user-name');
    const roleEl = document.getElementById('topbar-user-role');
    const avatarEl = document.getElementById('topbar-user-avatar');

    if (nameEl) nameEl.textContent = user.name || 'User';

    let displayRole = 'Student';
    if (user.role === 'admin') displayRole = 'Administrator';
    else if (user.role === 'faculty') {
      displayRole = user.facultyRole === 'hod' ? `HOD (${user.department || 'Dept'})` : 'Faculty Mentor';
    } else {
      displayRole = user.register_number || 'Student';
    }
    if (roleEl) roleEl.textContent = displayRole;

    // Set individual avatar with fallback to generated initials badge
    const fallbackAvatar = getInitialsAvatar(user.name);
    if (avatarEl) {
      avatarEl.src = user.avatar || fallbackAvatar;
      avatarEl.onerror = () => {
        avatarEl.src = fallbackAvatar;
      };
    }

    // Role-specific sidebar adjustments
    const brandRole = document.getElementById('sidebar-role-badge');
    if (user.role === 'admin') {
      if (brandRole) brandRole.textContent = 'ADMIN CONSOLE';
      const dashLinks = document.querySelectorAll('.sidebar-nav a[href="dashboard.html"]');
      dashLinks.forEach(link => { link.href = 'admin-dashboard.html'; });
    } else if (user.role === 'faculty') {
      if (user.facultyRole === 'hod') {
        if (brandRole) brandRole.textContent = 'HOD CONSOLE';
        const dashLinks = document.querySelectorAll('.sidebar-nav a[href="dashboard.html"]');
        dashLinks.forEach(link => { link.href = 'hod-dashboard.html'; });
      } else {
        if (brandRole) brandRole.textContent = 'MENTOR CONSOLE';
        const dashLinks = document.querySelectorAll('.sidebar-nav a[href="dashboard.html"]');
        dashLinks.forEach(link => { link.href = 'mentor-dashboard.html'; });
      }
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
  if (user && user.role === 'student' && user.studentId) {
    fetchUnreadNotificationsCount(user.studentId);
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
