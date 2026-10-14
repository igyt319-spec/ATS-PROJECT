const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { verifyToken, isAdmin, ownsStudent } = require('../middleware/authMiddleware');

router.get('/admin/summary', verifyToken, isAdmin, dashboardController.getAdminSummary);
router.get('/:studentId', verifyToken, ownsStudent, dashboardController.getStudentDashboard);

module.exports = router;
