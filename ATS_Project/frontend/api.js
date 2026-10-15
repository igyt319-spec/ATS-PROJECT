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

// Global Student Mini-Dashboard Controller (Section 5)
window.closeMiniDashboard = function() {
  const modal = document.getElementById('mini-dashboard-modal');
  if (modal) modal.style.display = 'none';
};

window.openStudentMiniDashboard = async function(studentId) {
  let modal = document.getElementById('mini-dashboard-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'mini-dashboard-modal';
    modal.className = 'modal-backdrop';
    modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.85); backdrop-filter:blur(8px); z-index:99999; align-items:center; justify-content:center; padding:16px;';
    modal.innerHTML = `
      <div class="modal-card" style="background:var(--bg-card, #1e293b); border:1px solid rgba(255,255,255,0.12); border-radius:18px; max-width:880px; width:100%; max-height:90vh; overflow-y:auto; padding:24px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:16px; margin-bottom:18px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <img src="assets/ats-logo.svg" alt="ATS" style="width:36px; height:36px; filter:drop-shadow(0 0 8px rgba(56,189,248,0.5));">
            <div>
              <h3 style="margin:0; font-size:1.25rem; font-weight:800; color:#fff;">Student Academic Mini-Dashboard</h3>
              <span style="font-size:0.75rem; color:var(--accent-cyan, #38bdf8); font-weight:700; letter-spacing:0.5px;">VERIFIED INSTITUTIONAL RECORD</span>
            </div>
          </div>
          <button onclick="closeMiniDashboard()" style="background:rgba(255,255,255,0.08); border:none; color:var(--text-muted, #94a3b8); font-size:1.4rem; cursor:pointer; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center;">&times;</button>
        </div>
        <div id="mini-dashboard-body">
          <div style="text-align:center; padding:50px; color:var(--text-muted, #94a3b8);">Loading Student Academic Profile... ⏳</div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeMiniDashboard();
    });
  }

  modal.style.display = 'flex';
  const body = document.getElementById('mini-dashboard-body');
  body.innerHTML = '<div style="text-align:center; padding:50px; color:var(--text-muted, #94a3b8);">Loading Student Academic Profile... ⏳</div>';

  try {
    const res = await apiCall(`/students/${studentId}/mini-dashboard`);
    if (!res || !res.success || !res.data) {
      body.innerHTML = `<div style="text-align:center; padding:30px; color:#f87171;">Could not load student profile: ${res.message || 'Record not accessible'}</div>`;
      return;
    }

    const { student, assignedMentor, attendance, results, fees, leaves, activities, alerts } = res.data;
    const studentAvatar = student.avatar || getInitialsAvatar(student.name, 90);
    const mentorAvatar = assignedMentor ? (assignedMentor.avatar || getInitialsAvatar(assignedMentor.name, 50)) : '';

    const attPct = Number(student.attendance_percentage || 0);
    const attColor = attPct >= 85 ? '#22c55e' : attPct >= 75 ? '#f59e0b' : '#ef4444';

    body.innerHTML = `
      <!-- Header Profile Banner -->
      <div style="display:flex; flex-wrap:wrap; gap:18px; align-items:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:18px; margin-bottom:20px;">
        <img src="${studentAvatar}" alt="${student.name}" style="width:80px; height:80px; border-radius:50%; object-fit:cover; border:3px solid var(--accent-cyan, #38bdf8); box-shadow:0 0 15px rgba(56,189,248,0.3);">
        <div style="flex:1; min-width:220px;">
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <h2 style="margin:0; font-size:1.35rem; font-weight:800; color:#fff;">${student.name}</h2>
            <span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); font-size:0.75rem; padding:3px 9px;">${student.register_number}</span>
            <span class="badge" style="background:rgba(129,140,248,0.15); color:#a5b4fc; font-size:0.75rem; padding:3px 9px;">${student.department}</span>
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
          <div style="font-size:1.25rem; font-weight:800; color:#10b981; margin-top:6px;">${fees && fees.length > 0 && Number(fees[0].balance_amount) <= 0 ? 'PAID' : 'PENDING'}</div>
          <div style="font-size:0.72rem; color:var(--text-dim, #64748b);">${fees && fees.length > 0 ? `₹${Number(fees[0].balance_amount || 0).toLocaleString()} Due` : 'No Dues'}</div>
        </div>
      </div>

      <!-- Assigned Faculty Mentor Card -->
      <div style="background:rgba(56,189,248,0.05); border:1px solid rgba(56,189,248,0.2); border-radius:12px; padding:14px 18px; margin-bottom:20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
        <div style="display:flex; align-items:center; gap:12px;">
          ${mentorAvatar ? `<img src="${mentorAvatar}" alt="Mentor" style="width:44px; height:44px; border-radius:50%; object-fit:cover; border:2px solid #38bdf8;">` : '<span style="font-size:1.8rem;">👨‍🏫</span>'}
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
        <button class="tab-btn active" onclick="switchMiniDashTab('academics')" id="md-tab-academics" style="background:none; border:none; padding:8px 14px; font-weight:700; font-size:0.85rem; color:#fff; border-bottom:2px solid #38bdf8; cursor:pointer;">Academic Results (${results.total})</button>
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
        ` : '<div style="text-align:center; padding:24px; color:var(--text-muted, #94a3b8);">No published academic marks recorded yet.</div>'}
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
    body.innerHTML = `<div style="text-align:center; padding:30px; color:#f87171;">Failed to load mini-dashboard: ${err.message}</div>`;
  }
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
