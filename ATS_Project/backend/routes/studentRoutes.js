const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { verifyToken, isAdmin, isStrictAdmin, ownsStudent, ownsStudentOrAssigned } = require('../middleware/authMiddleware');

router.get('/', verifyToken, isAdmin, studentController.getAllStudents);
router.get('/:id', verifyToken, ownsStudent, studentController.getStudentById);
router.get('/:id/mini-dashboard', verifyToken, ownsStudentOrAssigned, studentController.getStudentMiniDashboard);
router.post('/', verifyToken, isAdmin, studentController.createStudent);
router.put('/:id', verifyToken, ownsStudent, studentController.updateStudent);
router.delete('/:id', verifyToken, isStrictAdmin, studentController.deleteStudent);

module.exports = router;
