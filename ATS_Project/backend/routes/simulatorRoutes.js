const express = require('express');
const router = express.Router();
const simulatorController = require('../controllers/simulatorController');
const { verifyToken } = require('../middleware/authMiddleware');

// Simulation routes are accessible to authenticated students and mentors
router.post('/target-gpa', verifyToken, simulatorController.simulateTargetGpa);
router.post('/marks-impact', verifyToken, simulatorController.simulateMarksImpact);
router.post('/attendance', verifyToken, simulatorController.simulateAttendance);
router.get('/leverage-priorities/:studentId', verifyToken, simulatorController.getLeveragePriorities);

module.exports = router;
