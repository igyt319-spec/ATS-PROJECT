const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { verifyToken, isFaculty, ownsStudent } = require('../middleware/authMiddleware');

router.get('/:studentId', verifyToken, ownsStudent, attendanceController.getAttendanceByStudent);
router.post('/', verifyToken, isFaculty, attendanceController.addAttendance);
router.put('/:id', verifyToken, isFaculty, attendanceController.updateAttendance);

module.exports = router;
