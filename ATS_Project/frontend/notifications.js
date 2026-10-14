// Notifications Page Controller
let studentId = 1;

document.addEventListener('DOMContentLoaded', async () => {
  const user = checkAuth();
  if (!user) return;
  initLayout();

  studentId = user.studentId || 1;

  if (user.role === 'admin' || user.role === 'faculty') {
    document.getElementById('sidebar-role-badge').textContent = 'ADMIN CONSOLE';
  }

  await loadNotifications();
});

async function loadNotifications() {
  try {
    const res = await apiCall(`/notifications/${studentId}`);
    if (!res.success) throw new Error(res.message);

    const { count, unreadCount, data } = res;
    document.getElementById('notif-count-text').textContent = 
      `You have ${unreadCount} unread alert${unreadCount === 1 ? '' : 's'} (${count} total notifications)`;

    renderNotifications(data);

    // Refresh layout badges
    await fetchUnreadNotificationsCount(studentId);

  } catch (err) {
    console.error('[Notifications Load Error]', err);
    showToast('Failed to load notifications', 'error');
  }
}

function renderNotifications(items) {
  const container = document.getElementById('notifications-list');
  if (!items || items.length === 0) {
    container.innerHTML = `<div class="glass-card" style="text-align: center; color: var(--text-dim); padding: 36px;">No notifications in your inbox.</div>`;
    return;
  }

  const iconMap = {
    'attendance': '⚠️',
    'marks': '📊',
    'recommendation': '💡',
    'achievement': '🏆',
    'faculty': '🏛️'
  };

  container.innerHTML = items.map(n => {
    const isUnread = !n.is_read;
    const borderLeftColor = isUnread ? '#38bdf8' : 'transparent';
    const bgOpacity = isUnread ? 'background: rgba(56, 189, 248, 0.04);' : '';
    const dateFormatted = new Date(n.created_at || Date.now()).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const readAction = isUnread
      ? `<button class="btn btn-secondary btn-sm" onclick="markOneRead(${n.id})" style="font-size: 0.75rem; padding: 4px 10px;">Mark Read ✓</button>`
      : `<span style="font-size: 0.75rem; color: var(--text-dim);">Read</span>`;

    return `
      <div class="glass-card" style="${bgOpacity} border-left: 4px solid ${borderLeftColor}; padding: 16px 20px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 14px;">
          <div style="display: flex; gap: 14px;">
            <span style="font-size: 1.6rem;">${iconMap[n.type] || '🔔'}</span>
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <strong style="color: #fff; font-size: 0.95rem;">${n.title}</strong>
                ${isUnread ? '<span class="kpi-pill pill-red">New</span>' : ''}
              </div>
              <p style="color: var(--text-muted); font-size: 0.86rem; line-height: 1.5; margin-bottom: 6px;">
                ${n.message}
              </p>
              <span style="font-size: 0.75rem; color: var(--text-dim);">📅 ${dateFormatted}</span>
            </div>
          </div>
          <div>
            ${readAction}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function markOneRead(id) {
  try {
    const res = await apiCall(`/notifications/${id}/read`, 'PUT');
    if (res.success) {
      await loadNotifications();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function markAllRead() {
  try {
    const res = await apiCall(`/notifications/student/${studentId}/read-all`, 'PUT');
    if (res.success) {
      showToast('All notifications marked as read.', 'success');
      await loadNotifications();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}
