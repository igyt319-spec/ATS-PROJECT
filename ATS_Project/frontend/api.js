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
  let token = localStorage.getItem('ats_token') || localStorage.getItem('token') || sessionStorage.getItem('ats_token');
  if (!token) return null;
  token = String(token).replace(/^Bearer\s+/i, '').trim();
  return token || null;
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
    if (typeof window !== 'undefined' && !window.location.pathname.includes('login.html')) {
      window.location.href = 'login.html';
    }
    return null;
  }

  // Strict Admin Isolation: Admin must ONLY access account governance views
  if (user.role === 'admin') {
    const operationalPages = [
      'students.html',
      'performance.html',
      'attendance.html',
      'achievements.html',
      'recommendations.html',
      'mentor-dashboard.html',
      'hod-dashboard.html',
      'dashboard.html'
    ];
    const currentPage = (window.location.pathname || '').split('/').pop().toLowerCase();
    if (operationalPages.includes(currentPage)) {
      window.location.href = 'admin-dashboard.html';
      return null;
    }
  }

  if (requiredRole) {
    let allowed = false;
    if (requiredRole === 'admin') {
      allowed = user.role === 'admin';
    } else if (requiredRole === 'hod') {
      // HOD portal strictly requires verified faculty with active HOD status (never admin)
      allowed = (user.role === 'faculty' && Boolean(user.isHOD));
    } else if (requiredRole === 'mentor' || requiredRole === 'faculty') {
      // Mentor/Faculty portal strictly requires faculty role (never admin)
      allowed = (user.role === 'faculty');
    } else if (requiredRole === 'student') {
      allowed = (user.role === 'student');
    }

    if (!allowed) {
      if (user.role === 'admin') {
        window.location.href = 'admin-dashboard.html';
      } else if (user.role === 'faculty') {
        window.location.href = (user.facultyRole === 'hod' && Boolean(user.isHOD)) ? 'hod-dashboard.html' : 'mentor-dashboard.html';
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
  const isAuthEndpoint = endpoint.startsWith('/auth/login') || endpoint.startsWith('/auth/forgot-password');

  if (!isAuthEndpoint && (!token || !token.trim())) {
    const sessionErr = 'Authentication required: Valid session token not found. Please log in.';
    showToast(sessionErr, 'error');
    if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('index.html')) {
      clearSession();
      window.location.href = 'login.html';
    }
    throw new Error(sessionErr);
  }

  const headers = {
    'Content-Type': 'application/json'
  };

  if (token && token.trim()) {
    headers['Authorization'] = `Bearer ${token.trim()}`;
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

// Global Reusable Mini-Dashboard Controller (Student, Faculty, HOD)
let activeMiniDashboardRequestId = 0;

window.closeMiniDashboard = function() {
  const modal = document.getElementById('mini-dashboard-modal');
  if (modal) {
    modal.classList.remove('open');
    modal.style.display = 'none';
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    const body = document.getElementById('mini-dashboard-body');
    if (body) body.innerHTML = '';
  }
};

function ensureMiniDashboardModal() {
  let modal = document.getElementById('mini-dashboard-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'mini-dashboard-modal';
    modal.className = 'modal-backdrop';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'mini-dashboard-modal-title');
    modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.88); backdrop-filter:blur(8px); z-index:99999; align-items:center; justify-content:center; padding:16px; opacity:0; pointer-events:none; transition:opacity 0.25s ease;';
    modal.innerHTML = `
      <div class="modal-card" style="background:var(--bg-card, #1e293b); border:1px solid rgba(255,255,255,0.12); border-radius:18px; max-width:880px; width:100%; max-height:90vh; overflow-y:auto; padding:24px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:16px; margin-bottom:18px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <img src="assets/ats-logo.svg" alt="ATS" style="width:36px; height:36px; filter:drop-shadow(0 0 8px rgba(56,189,248,0.5));">
            <div>
              <h3 id="mini-dashboard-modal-title" style="margin:0; font-size:1.25rem; font-weight:800; color:#fff;">Academic Mini-Dashboard</h3>
              <span id="mini-dashboard-modal-badge" style="font-size:0.75rem; color:var(--accent-cyan, #38bdf8); font-weight:700; letter-spacing:0.5px;">VERIFIED INSTITUTIONAL RECORD</span>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <span id="mini-dashboard-back-container"></span>
            <button onclick="closeMiniDashboard()" aria-label="Close modal" style="background:rgba(255,255,255,0.08); border:none; color:var(--text-muted, #94a3b8); font-size:1.4rem; cursor:pointer; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.18)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">&times;</button>
          </div>
        </div>
        <div id="mini-dashboard-body">
          <div style="text-align:center; padding:50px; color:var(--text-muted, #94a3b8);">Loading Profile Details... ⏳</div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeMiniDashboard();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) {
        closeMiniDashboard();
      }
    });
  }
  return modal;
}

function showMiniDashboardModal(modal) {
  if (!modal) return;
  modal.style.display = 'flex';
  modal.style.opacity = '1';
  modal.style.pointerEvents = 'auto';
  modal.classList.add('open');
}

// 1. Student Academic Mini-Dashboard
window.openStudentMiniDashboard = async function(studentId, options = {}) {
  const modal = ensureMiniDashboardModal();
  showMiniDashboardModal(modal);

  document.getElementById('mini-dashboard-modal-title').textContent = 'Student Academic Mini-Dashboard';
  document.getElementById('mini-dashboard-modal-badge').textContent = 'VERIFIED STUDENT ACADEMIC DOSSIER';

  const backContainer = document.getElementById('mini-dashboard-back-container');
  if (options && options.backToFacultyId) {
    backContainer.innerHTML = `
      <button onclick="openFacultyMiniDashboard(${options.backToFacultyId})" class="btn btn-secondary" style="font-size:0.75rem; padding:4px 10px;">
        ← Back to Faculty
      </button>
    `;
  } else {
    backContainer.innerHTML = '';
  }

  const body = document.getElementById('mini-dashboard-body');
  // Immediate state reset to prevent stale cross-student display
  body.innerHTML = `
    <div style="text-align:center; padding:60px 20px;">
      <div style="font-size:2rem; margin-bottom:12px;">⏳</div>
      <div style="color:#fff; font-weight:700; font-size:1rem;">Loading Student Record #${studentId}...</div>
      <div style="color:var(--text-muted, #94a3b8); font-size:0.82rem; margin-top:4px;">Retrieving attendance, academic results, fee status & activities...</div>
    </div>
  `;

  const token = getToken();
  if (!token || !token.trim()) {
    body.innerHTML = `
      <div style="text-align:center; padding:40px 20px;">
        <div style="font-size:2.2rem; margin-bottom:12px;">🔒</div>
        <div style="color:#f87171; font-weight:700; font-size:1.1rem; margin-bottom:8px;">Authentication Required</div>
        <p style="color:var(--text-muted, #94a3b8); font-size:0.85rem; max-width:440px; margin:0 auto 18px;">
          Valid session token required. Please sign in to access student academic dossiers.
        </p>
        <button class="btn btn-primary" onclick="window.location.href='login.html'">Sign In</button>
      </div>
    `;
    return;
  }

  const requestId = ++activeMiniDashboardRequestId;

  try {
    const res = await apiCall(`/students/${studentId}/mini-dashboard`);
    if (requestId !== activeMiniDashboardRequestId) return;
    if (!res || !res.success || !res.data) {
      body.innerHTML = `
        <div style="text-align:center; padding:40px 20px;">
          <div style="font-size:2.2rem; color:#f87171; margin-bottom:12px;">⚠️</div>
          <div style="color:#f87171; font-weight:700; font-size:1rem; margin-bottom:8px;">
            Could not load student record: ${res && res.message ? res.message : 'Record not accessible or permission denied'}
          </div>
          <p style="color:var(--text-muted, #94a3b8); font-size:0.82rem; max-width:440px; margin:0 auto 18px;">
            Ensure you have authorized mentorship or departmental permissions to view this student.
          </p>
          <button class="btn btn-primary" onclick="openStudentMiniDashboard(${studentId}, ${JSON.stringify(options).replace(/"/g, '&quot;')})">
            🔄 Retry Loading
          </button>
        </div>
      `;
      return;
    }

    const { student, assignedMentor, attendance, results, fees, leaves, activities } = res.data;
    const studentAvatar = student.avatar || getInitialsAvatar(student.name, 90);
    const mentorAvatar = assignedMentor ? (assignedMentor.avatar || getInitialsAvatar(assignedMentor.name, 50)) : '';

    const attPct = Number(student.attendance_percentage || 0);
    const attColor = attPct >= 85 ? '#22c55e' : attPct >= 75 ? '#f59e0b' : '#ef4444';

    body.innerHTML = `
      <!-- Header Profile Banner -->
      <div style="display:flex; flex-wrap:wrap; gap:18px; align-items:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px; margin-bottom:20px;">
        <img src="${studentAvatar}" alt="${student.name}" style="width:80px; height:80px; border-radius:50%; object-fit:cover; border:3px solid var(--accent-cyan, #38bdf8); box-shadow:0 0 15px rgba(56,189,248,0.3);" onerror="this.src='${getInitialsAvatar(student.name, 80)}'">
        <div style="flex:1; min-width:220px;">
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <h2 style="margin:0; font-size:1.35rem; font-weight:800; color:#fff;">${student.name}</h2>
            <span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); font-size:0.75rem; padding:3px 9px;">${student.register_number}</span>
            <span class="badge" style="background:rgba(129,140,248,0.15); color:#a5b4fc; font-size:0.75rem; padding:3px 9px;">${student.department_name || student.department || 'Department'}</span>
          </div>
          <div style="font-size:0.85rem; color:var(--text-muted, #94a3b8); margin-top:6px; display:flex; gap:14px; flex-wrap:wrap;">
            <span>📅 ${student.year || 'N/A'} • ${student.semester || 'N/A'}</span>
            <span>✉️ ${student.email || 'N/A'}</span>
            ${student.phone ? `<span>📞 ${student.phone}</span>` : ''}
          </div>
        </div>
      </div>

      <!-- Quick Metrics Grid -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-bottom:20px;">
        <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:14px; text-align:center;">
          <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8); font-weight:700; text-transform:uppercase;">Attendance</div>
          <div style="font-size:1.6rem; font-weight:900; color:${attColor}; margin-top:4px;">${attPct}%</div>
          <div style="font-size:0.72rem; color:var(--text-dim, #64748b);">${attPct >= 75 ? 'Eligible for Exams' : 'Attendance Shortage'}</div>
        </div>
        <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:14px; text-align:center;">
          <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8); font-weight:700; text-transform:uppercase;">Cumulative GPA</div>
          <div style="font-size:1.6rem; font-weight:900; color:#38bdf8; margin-top:4px;">${Number(student.cgpa || 0).toFixed(2)}</div>
          <div style="font-size:0.72rem; color:var(--text-dim, #64748b);">Current SGPA: ${Number(student.gpa || 0).toFixed(2)}</div>
        </div>
        <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:14px; text-align:center;">
          <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8); font-weight:700; text-transform:uppercase;">Verified Activities</div>
          <div style="font-size:1.6rem; font-weight:900; color:#a855f7; margin-top:4px;">${activities ? activities.filter(a => a.status === 'Verified').length : 0}</div>
          <div style="font-size:0.72rem; color:var(--text-dim, #64748b);">${activities ? activities.length : 0} Submissions</div>
        </div>
        <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:14px; text-align:center;">
          <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8); font-weight:700; text-transform:uppercase;">Fee Status</div>
          <div style="font-size:1.25rem; font-weight:800; color:${fees && fees.length > 0 && Number(fees[0].balance_amount) <= 0 ? '#10b981' : '#f87171'}; margin-top:6px;">
            ${fees && fees.length > 0 && Number(fees[0].balance_amount) <= 0 ? 'PAID' : 'PENDING'}
          </div>
          <div style="font-size:0.72rem; color:var(--text-dim, #64748b);">
            ${fees && fees.length > 0 ? `₹${Number(fees[0].balance_amount || 0).toLocaleString()} Due` : 'No Outstanding Dues'}
          </div>
        </div>
      </div>

      <!-- Assigned Faculty Mentor Card -->
      <div style="background:rgba(56,189,248,0.05); border:1px solid rgba(56,189,248,0.2); border-radius:12px; padding:14px 18px; margin-bottom:20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
        <div style="display:flex; align-items:center; gap:12px;">
          ${mentorAvatar ? `<img src="${mentorAvatar}" alt="Mentor" style="width:44px; height:44px; border-radius:50%; object-fit:cover; border:2px solid #38bdf8;" onerror="this.src='${getInitialsAvatar(assignedMentor ? assignedMentor.name : 'M', 44)}'">` : '<span style="font-size:1.8rem;">👨‍🏫</span>'}
          <div>
            <div style="font-size:0.72rem; color:#38bdf8; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Assigned Faculty Mentor</div>
            <div style="font-size:1rem; font-weight:700; color:#fff;">${assignedMentor ? assignedMentor.name : 'No Primary Mentor Assigned Yet'}</div>
            <div style="font-size:0.78rem; color:var(--text-muted, #94a3b8);">${assignedMentor ? `${assignedMentor.designation || 'Faculty'} • ${assignedMentor.email}` : 'Contact HOD to allocate a faculty mentor'}</div>
          </div>
        </div>
        ${assignedMentor ? `<a href="mailto:${assignedMentor.email}" class="btn btn-secondary" style="font-size:0.78rem; padding:6px 12px;">✉️ Contact Mentor</a>` : ''}
      </div>

      <!-- Mini-Dashboard Content Tabs -->
      <div style="display:flex; gap:8px; border-bottom:1px solid rgba(255,255,255,0.1); margin-bottom:16px;">
        <button class="tab-btn active" onclick="switchMiniDashTab('academics')" id="md-tab-academics" style="background:none; border:none; padding:8px 14px; font-weight:700; font-size:0.85rem; color:#fff; border-bottom:2px solid #38bdf8; cursor:pointer;">Academic Results (${results.total || (results.all ? results.all.length : 0)})</button>
        <button class="tab-btn" onclick="switchMiniDashTab('leaves')" id="md-tab-leaves" style="background:none; border:none; padding:8px 14px; font-weight:700; font-size:0.85rem; color:var(--text-muted, #94a3b8); cursor:pointer;">Leave History (${leaves ? leaves.length : 0})</button>
        <button class="tab-btn" onclick="switchMiniDashTab('activities')" id="md-tab-activities" style="background:none; border:none; padding:8px 14px; font-weight:700; font-size:0.85rem; color:var(--text-muted, #94a3b8); cursor:pointer;">Activities (${activities ? activities.length : 0})</button>
      </div>

      <!-- Tab: Academic Results -->
      <div id="md-sec-academics">
        ${results.all && results.all.length > 0 ? `
          <div style="overflow-x:auto;">
            <table class="table" style="width:100%; font-size:0.85rem;">
              <thead>
                <tr>
                  <th>Tier / Exam</th>
                  <th>Subject</th>
                  <th>Marks</th>
                  <th>Grade</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${results.all.map(r => `
                  <tr>
                    <td><span class="badge" style="background:rgba(255,255,255,0.06); font-size:0.75rem;">${r.assessment_type ? r.assessment_type.toUpperCase() : 'EXAM'}</span></td>
                    <td><strong>${r.subject_code ? `${r.subject_code} - ` : ''}${r.subject_name || r.assessment_name}</strong></td>
                    <td>${r.marks_obtained} / ${r.max_marks}</td>
                    <td><span style="font-weight:700; color:#38bdf8;">${r.grade || 'Pass'}</span></td>
                    <td><span class="badge badge-success" style="font-size:0.72rem;">${r.status || 'Pass'}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div style="text-align:center; padding:24px; color:var(--text-muted, #94a3b8);">No published academic marks recorded yet for this student.</div>'}
      </div>

      <!-- Tab: Leave History -->
      <div id="md-sec-leaves" style="display:none;">
        ${leaves && leaves.length > 0 ? `
          <div style="overflow-x:auto;">
            <table class="table" style="width:100%; font-size:0.85rem;">
              <thead>
                <tr>
                  <th>Leave Type</th>
                  <th>Dates</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Mentor Remarks</th>
                </tr>
              </thead>
              <tbody>
                ${leaves.map(l => `
                  <tr>
                    <td><strong>${l.leave_type}</strong></td>
                    <td>${l.start_date ? String(l.start_date).slice(0, 10) : ''} to ${l.end_date ? String(l.end_date).slice(0, 10) : ''}</td>
                    <td style="max-width:200px;">${l.reason}</td>
                    <td><span class="badge ${l.status === 'Approved' ? 'badge-success' : l.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}">${l.status}</span></td>
                    <td><span style="font-style:italic; font-size:0.8rem;">${l.remarks || 'Pending Review'}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div style="text-align:center; padding:24px; color:var(--text-muted, #94a3b8);">No leave applications recorded for this student.</div>'}
      </div>

      <!-- Tab: Activities -->
      <div id="md-sec-activities" style="display:none;">
        ${activities && activities.length > 0 ? `
          <div style="overflow-x:auto;">
            <table class="table" style="width:100%; font-size:0.85rem;">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Title & Institution</th>
                  <th>Event Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${activities.map(a => `
                  <tr>
                    <td><span class="badge" style="background:rgba(168,85,247,0.15); color:#c084fc;">${a.category}</span></td>
                    <td><strong>${a.title}</strong><br><span style="font-size:0.75rem; color:var(--text-muted, #94a3b8);">${a.organizing_institution || ''}</span></td>
                    <td>${a.event_date ? String(a.event_date).slice(0, 10) : ''}</td>
                    <td><span class="badge ${a.status === 'Verified' ? 'badge-success' : a.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}">${a.status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<div style="text-align:center; padding:24px; color:var(--text-muted, #94a3b8);">No activity submissions found.</div>'}
      </div>
    `;

  } catch (err) {
    const isForbidden = err.message && (err.message.includes('403') || err.message.toLowerCase().includes('access denied'));
    const isAuth = err.message && (err.message.includes('401') || err.message.toLowerCase().includes('token') || err.message.toLowerCase().includes('bearer'));
    body.innerHTML = `
      <div style="text-align:center; padding:40px 20px;">
        <div style="font-size:2.2rem; margin-bottom:12px;">${isForbidden ? '🛡️' : (isAuth ? '🔒' : '❌')}</div>
        <div style="color:#f87171; font-weight:700; font-size:1.1rem; margin-bottom:8px;">
          ${isForbidden ? 'Access Restricted' : (isAuth ? 'Session Authentication Required' : 'Failed to Load Record')}
        </div>
        <p style="color:var(--text-muted, #94a3b8); font-size:0.84rem; max-width:440px; margin:0 auto 18px;">
          ${err.message}
        </p>
        <button class="btn btn-secondary" onclick="closeMiniDashboard()">Close</button>
        ${isAuth ? `<button class="btn btn-primary" style="margin-left:8px;" onclick="window.location.href='login.html'">Sign In</button>` : (!isForbidden ? `<button class="btn btn-primary" style="margin-left:8px;" onclick="openStudentMiniDashboard(${studentId}, ${JSON.stringify(options).replace(/"/g, '&quot;')})">🔄 Retry</button>` : '')}
      </div>
    `;
  }
};

// 2. Faculty Mini-Dashboard (Section 6 & Requirement 5B)
window.openFacultyMiniDashboard = async function(facultyId, options = {}) {
  const modal = ensureMiniDashboardModal();
  showMiniDashboardModal(modal);

  document.getElementById('mini-dashboard-modal-title').textContent = 'Faculty Member Mini-Dashboard';
  document.getElementById('mini-dashboard-modal-badge').textContent = 'VERIFIED FACULTY PROFILE & MENTOR ROSTER';
  document.getElementById('mini-dashboard-back-container').innerHTML = '';

  const body = document.getElementById('mini-dashboard-body');
  // Immediate state reset
  body.innerHTML = `
    <div style="text-align:center; padding:60px 20px;">
      <div style="font-size:2rem; margin-bottom:12px;">⏳</div>
      <div style="color:#fff; font-weight:700; font-size:1rem;">Loading Faculty Record #${facultyId}...</div>
      <div style="color:var(--text-muted, #94a3b8); font-size:0.82rem; margin-top:4px;">Retrieving academic profile, mentee assignments & teaching allocations...</div>
    </div>
  `;

  const token = getToken();
  if (!token || !token.trim()) {
    body.innerHTML = `
      <div style="text-align:center; padding:40px 20px;">
        <div style="font-size:2.2rem; margin-bottom:12px;">🔒</div>
        <div style="color:#f87171; font-weight:700; font-size:1.1rem; margin-bottom:8px;">Authentication Required</div>
        <p style="color:var(--text-muted, #94a3b8); font-size:0.85rem; max-width:440px; margin:0 auto 18px;">
          Valid session token required. Please sign in to access faculty dossiers.
        </p>
        <button class="btn btn-secondary" onclick="closeMiniDashboard()">Close</button>
        <button class="btn btn-primary" style="margin-left:8px;" onclick="window.location.href='login.html'">Sign In</button>
      </div>
    `;
    return;
  }

  const requestId = ++activeMiniDashboardRequestId;

  try {
    const res = await apiCall(`/departments/faculty/${facultyId}/mini-dashboard`);
    if (requestId !== activeMiniDashboardRequestId) return;
    if (!res || !res.success || !res.data) {
      body.innerHTML = `
        <div style="text-align:center; padding:40px 20px;">
          <div style="font-size:2.2rem; color:#f87171; margin-bottom:12px;">⚠️</div>
          <div style="color:#f87171; font-weight:700; font-size:1rem; margin-bottom:8px;">
            Could not load faculty profile: ${res && res.message ? res.message : 'Record not accessible or permission denied'}
          </div>
          <button class="btn btn-secondary" onclick="closeMiniDashboard()">Close</button>
          <button class="btn btn-primary" style="margin-left:8px;" onclick="openFacultyMiniDashboard(${facultyId})">
            🔄 Retry Loading
          </button>
        </div>
      `;
      return;
    }

    const { faculty, mentees, courses } = res.data;
    const facAvatar = faculty.avatar || getInitialsAvatar(faculty.name, 90);

    body.innerHTML = `
      <!-- Faculty Header Banner -->
      <div style="display:flex; flex-wrap:wrap; gap:18px; align-items:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px; margin-bottom:20px;">
        <img src="${facAvatar}" alt="${faculty.name}" style="width:80px; height:80px; border-radius:50%; object-fit:cover; border:3px solid #38bdf8; box-shadow:0 0 15px rgba(56,189,248,0.3);" onerror="this.src='${getInitialsAvatar(faculty.name, 80)}'">
        <div style="flex:1; min-width:220px;">
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <h2 style="margin:0; font-size:1.35rem; font-weight:800; color:#fff;">${faculty.name}</h2>
            <span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); font-size:0.75rem; padding:3px 9px;">${faculty.faculty_code || 'FAC-' + faculty.id}</span>
            <span class="badge" style="background:${faculty.is_hod ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.15)'}; color:${faculty.is_hod ? '#facc15' : '#4ade80'}; font-size:0.75rem; padding:3px 9px;">
              ${faculty.is_hod ? '👑 Department Head (HOD)' : 'Faculty Mentor'}
            </span>
          </div>
          <div style="font-size:0.85rem; color:var(--text-muted, #94a3b8); margin-top:6px; display:flex; gap:14px; flex-wrap:wrap;">
            <span>🏛️ ${faculty.department || 'Department'} (${faculty.department_code || 'DEPT'})</span>
            <span>✉️ ${faculty.email || 'N/A'}</span>
            <span>💼 ${faculty.designation || 'Faculty Member'}</span>
          </div>
        </div>
      </div>

      <!-- Quick Metrics Grid -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-bottom:20px;">
        <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:14px; text-align:center;">
          <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8); font-weight:700; text-transform:uppercase;">Active Mentees</div>
          <div style="font-size:1.6rem; font-weight:900; color:#38bdf8; margin-top:4px;">${faculty.mentee_count || (mentees ? mentees.length : 0)}</div>
          <div style="font-size:0.72rem; color:var(--text-dim, #64748b);">Assigned Scholars</div>
        </div>
        <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:14px; text-align:center;">
          <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8); font-weight:700; text-transform:uppercase;">Courses Taught</div>
          <div style="font-size:1.6rem; font-weight:900; color:#a855f7; margin-top:4px;">${courses ? courses.length : 0}</div>
          <div style="font-size:0.72rem; color:var(--text-dim, #64748b);">Subject Allocations</div>
        </div>
        <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:14px; text-align:center;">
          <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8); font-weight:700; text-transform:uppercase;">Mentoring Scope</div>
          <div style="font-size:1.15rem; font-weight:800; color:#10b981; margin-top:6px;">${faculty.can_mentor ? 'AUTHORIZED' : 'OFFLINE'}</div>
          <div style="font-size:0.72rem; color:var(--text-dim, #64748b);">${faculty.is_hod ? 'Department Supervisor' : 'Cohort Advisor'}</div>
        </div>
        <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:14px; text-align:center;">
          <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8); font-weight:700; text-transform:uppercase;">Status</div>
          <div style="font-size:1.15rem; font-weight:800; color:#38bdf8; margin-top:6px;">ACTIVE</div>
          <div style="font-size:0.72rem; color:var(--text-dim, #64748b);">Institutional Record</div>
        </div>
      </div>

      <!-- Assigned Mentees Section -->
      <div style="margin-bottom:24px;">
        <h4 style="color:#fff; font-size:1rem; font-weight:800; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between;">
          <span>🎓 Assigned Mentee Roster (${mentees ? mentees.length : 0})</span>
          <span style="font-size:0.75rem; color:var(--text-muted, #94a3b8); font-weight:normal;">Click "View Dashboard" to inspect individual student dossier</span>
        </h4>
        ${mentees && mentees.length > 0 ? `
          <div style="overflow-x:auto;">
            <table class="table" style="width:100%; font-size:0.85rem;">
              <thead>
                <tr>
                  <th>Scholar</th>
                  <th>Register No</th>
                  <th>Year / Sem</th>
                  <th>CGPA</th>
                  <th>Attendance</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${mentees.map(m => {
                  const mAvatar = m.avatar || getInitialsAvatar(m.name, 36);
                  return `
                    <tr>
                      <td>
                        <div style="display:flex; align-items:center; gap:8px;">
                          <img src="${mAvatar}" alt="${m.name}" style="width:32px; height:32px; border-radius:50%; object-fit:cover; border:1px solid rgba(255,255,255,0.15);" onerror="this.src='${getInitialsAvatar(m.name, 32)}'">
                          <div>
                            <strong style="color:#fff;">${m.name}</strong>
                            <div style="font-size:0.72rem; color:var(--text-muted, #94a3b8);">${m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td><span style="font-family:monospace; color:#38bdf8; font-weight:700;">${m.register_number}</span></td>
                      <td>${m.year || 'III Year'}<br><span style="font-size:0.72rem; color:var(--text-muted, #94a3b8);">${m.semester || 'Sem 5'}</span></td>
                      <td><strong style="color:#fff;">${Number(m.cgpa || 0).toFixed(2)}</strong></td>
                      <td>
                        <span style="font-weight:700; color:${Number(m.attendance_percentage || 0) >= 75 ? '#22c55e' : '#f87171'};">
                          ${Number(m.attendance_percentage || 0).toFixed(1)}%
                        </span>
                      </td>
                      <td>
                        <button class="btn btn-primary btn-sm" style="font-size:0.75rem; padding:4px 9px;" onclick="openStudentMiniDashboard(${m.id}, { backToFacultyId: ${faculty.id} })">
                          📊 View Dashboard
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div style="text-align:center; padding:24px; background:rgba(255,255,255,0.02); border:1px dashed rgba(255,255,255,0.1); border-radius:10px; color:var(--text-muted, #94a3b8);">
            No students currently assigned under this faculty member's mentorship.
          </div>
        `}
      </div>

      <!-- Allocated Subjects / Courses -->
      <div>
        <h4 style="color:#fff; font-size:1rem; font-weight:800; margin-bottom:12px;">📚 Assigned Courses & Subjects (${courses ? courses.length : 0})</h4>
        ${courses && courses.length > 0 ? `
          <div style="overflow-x:auto;">
            <table class="table" style="width:100%; font-size:0.85rem;">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Subject Name</th>
                  <th>Section</th>
                  <th>Credits</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                ${courses.map(c => `
                  <tr>
                    <td><strong style="color:#38bdf8;">${c.subject_code}</strong></td>
                    <td>${c.subject_name}</td>
                    <td><span class="badge" style="background:rgba(255,255,255,0.08);">${c.section_code || 'A'}</span></td>
                    <td>${c.credits || 3}</td>
                    <td><span class="badge" style="background:rgba(168,85,247,0.15); color:#c084fc;">${c.subject_type || 'Theory'}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div style="text-align:center; padding:20px; background:rgba(255,255,255,0.02); border:1px dashed rgba(255,255,255,0.1); border-radius:10px; color:var(--text-muted, #94a3b8);">
            No course allocations on record for the current semester.
          </div>
        `}
      </div>
    `;

  } catch (err) {
    if (requestId !== activeMiniDashboardRequestId) return;
    const isForbidden = err.message && (err.message.includes('403') || err.message.toLowerCase().includes('access denied'));
    const isAuth = err.message && (err.message.includes('401') || err.message.toLowerCase().includes('token') || err.message.toLowerCase().includes('bearer'));
    body.innerHTML = `
      <div style="text-align:center; padding:40px 20px;">
        <div style="font-size:2.2rem; margin-bottom:12px;">${isForbidden ? '🛡️' : (isAuth ? '🔒' : '❌')}</div>
        <div style="color:#f87171; font-weight:700; font-size:1.1rem; margin-bottom:8px;">
          ${isForbidden ? 'Access Restricted' : (isAuth ? 'Session Authentication Required' : 'Failed to Load Record')}
        </div>
        <p style="color:var(--text-muted, #94a3b8); font-size:0.84rem; max-width:440px; margin:0 auto 18px;">
          ${err.message}
        </p>
        <button class="btn btn-secondary" onclick="closeMiniDashboard()">Close</button>
        ${isAuth ? `<button class="btn btn-primary" style="margin-left:8px;" onclick="window.location.href='login.html'">Sign In</button>` : (!isForbidden ? `<button class="btn btn-primary" style="margin-left:8px;" onclick="openFacultyMiniDashboard(${facultyId})">🔄 Retry</button>` : '')}
      </div>
    `;
  }
};

// 3. HOD Mini-Dashboard (Section 6 & Requirement 5A)
window.openHODMiniDashboard = function(hodData, options = {}) {
  const modal = ensureMiniDashboardModal();
  showMiniDashboardModal(modal);

  document.getElementById('mini-dashboard-modal-title').textContent = 'Department Leadership (HOD) Profile';
  document.getElementById('mini-dashboard-modal-badge').textContent = 'VERIFIED HEAD OF DEPARTMENT PROFILE';
  document.getElementById('mini-dashboard-back-container').innerHTML = '';

  const body = document.getElementById('mini-dashboard-body');
  if (!hodData) {
    body.innerHTML = `
      <div style="text-align:center; padding:40px 20px; color:var(--text-muted, #94a3b8);">
        No HOD data provided or unassigned leadership.
      </div>
    `;
    return;
  }

  const avatar = hodData.avatar || getInitialsAvatar(hodData.name, 90);

  body.innerHTML = `
    <div style="display:flex; flex-wrap:wrap; gap:18px; align-items:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:20px; margin-bottom:20px;">
      <img src="${avatar}" alt="${hodData.name}" style="width:84px; height:84px; border-radius:50%; object-fit:cover; border:3px solid #facc15; box-shadow:0 0 15px rgba(250,204,21,0.3);" onerror="this.src='${getInitialsAvatar(hodData.name, 84)}'">
      <div style="flex:1; min-width:220px;">
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <h2 style="margin:0; font-size:1.4rem; font-weight:800; color:#fff;">${hodData.name}</h2>
          <span class="badge" style="background:rgba(250,204,21,0.15); color:#facc15; border:1px solid rgba(250,204,21,0.3); font-size:0.75rem; padding:3px 9px;">
            👑 Head of Department
          </span>
        </div>
        <div style="font-size:0.88rem; color:var(--text-muted, #94a3b8); margin-top:8px; display:flex; gap:16px; flex-wrap:wrap;">
          <span>🏛️ ${hodData.department_name || options.departmentName || 'Department'}</span>
          <span>✉️ ${hodData.email || 'N/A'}</span>
          <span>📅 HOD Since: ${hodData.hod_since ? String(hodData.hod_since).slice(0, 10) : 'Active Term'}</span>
        </div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:14px; margin-bottom:20px;">
      <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px; text-align:center;">
        <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8); font-weight:700; text-transform:uppercase;">Authority Scope</div>
        <div style="font-size:1.15rem; font-weight:800; color:#38bdf8; margin-top:6px;">Department Leadership</div>
        <div style="font-size:0.72rem; color:var(--text-dim, #64748b);">Academic Supervision</div>
      </div>
      <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px; text-align:center;">
        <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8); font-weight:700; text-transform:uppercase;">Mentorship Governance</div>
        <div style="font-size:1.15rem; font-weight:800; color:#10b981; margin-top:6px;">Faculty Allocation</div>
        <div style="font-size:0.72rem; color:var(--text-dim, #64748b);">Advisory Oversight</div>
      </div>
      <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px; text-align:center;">
        <div style="font-size:0.75rem; color:var(--text-muted, #94a3b8); font-weight:700; text-transform:uppercase;">Credential Status</div>
        <div style="font-size:1.15rem; font-weight:800; color:#facc15; margin-top:6px;">Verified HOD</div>
        <div style="font-size:0.72rem; color:var(--text-dim, #64748b);">Active in Database</div>
      </div>
    </div>
  `;
};

window.switchMiniDashTab = function(tabName) {
  ['academics', 'leaves', 'activities'].forEach(t => {
    const sec = document.getElementById(`md-sec-${t}`);
    const btn = document.getElementById(`md-tab-${t}`);
    if (sec) sec.style.display = (t === tabName ? 'block' : 'none');
    if (btn) {
      if (t === tabName) {
        btn.style.color = '#fff';
        btn.style.borderBottom = '2px solid #38bdf8';
      } else {
        btn.style.color = 'var(--text-muted, #94a3b8)';
        btn.style.borderBottom = 'none';
      }
    }
  });
};
