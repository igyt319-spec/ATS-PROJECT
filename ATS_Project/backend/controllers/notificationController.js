const db = require('../config/db');

// GET /api/notifications/:studentId
async function getNotificationsByStudent(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const [notifications] = await db.query(
      'SELECT * FROM notifications WHERE student_id = ? ORDER BY is_read ASC, created_at DESC',
      [studentId]
    );

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount,
      data: notifications
    });
  } catch (error) {
    console.error('[Notification Get Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// PUT /api/notifications/:id/read
async function markAsRead(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    await db.query('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
    return res.status(200).json({ success: true, message: 'Notification marked as read.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// PUT /api/notifications/student/:studentId/read-all
async function markAllAsRead(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    await db.query('UPDATE notifications SET is_read = 1 WHERE student_id = ?', [studentId]);
    return res.status(200).json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getNotificationsByStudent,
  markAsRead,
  markAllAsRead
};
