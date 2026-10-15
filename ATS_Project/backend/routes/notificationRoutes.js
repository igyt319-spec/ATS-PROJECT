const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { verifyToken, ownsStudent } = require('../middleware/authMiddleware');

router.get('/:studentId', verifyToken, ownsStudent, notificationController.getNotificationsByStudent);
router.put('/:id/read', verifyToken, notificationController.markAsRead);
router.put('/student/:studentId/read-all', verifyToken, ownsStudent, notificationController.markAllAsRead);
router.delete('/:id', verifyToken, notificationController.deleteNotification);
router.delete('/student/:studentId/clear-read', verifyToken, ownsStudent, notificationController.clearReadNotifications);

module.exports = router;
