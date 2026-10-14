const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbotController');
const { verifyToken, ownsStudent } = require('../middleware/authMiddleware');

// The controller derives the student ID from the authenticated student token.
// Admin/faculty requests still require an explicit student_id in the body.
router.post('/message', verifyToken, chatbotController.handleMessage);
router.get('/history/:studentId', verifyToken, ownsStudent, chatbotController.getChatHistory);
router.delete('/history/:studentId', verifyToken, ownsStudent, chatbotController.clearChatHistory);

module.exports = router;
