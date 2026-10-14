const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { verifyToken, isAdmin, ownsStudent } = require('../middleware/authMiddleware');

router.get('/:studentId', verifyToken, ownsStudent, attendanceController.getAttendanceByStudent);
router.post('/', verifyToken, isAdmin, attendanceController.addAttendance);
router.put('/:id', verifyToken, isAdmin, attendanceController.updateAttendance);

module.exports = router;
