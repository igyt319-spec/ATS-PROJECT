const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { verifyToken, ownsStudent } = require('../middleware/authMiddleware');

router.get('/:studentId', verifyToken, ownsStudent, notificationController.getNotificationsByStudent);
router.put('/:id/read', verifyToken, notificationController.markAsRead);
router.put('/student/:studentId/read-all', verifyToken, ownsStudent, notificationController.markAllAsRead);

module.exports = router;
