const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { verifyToken, isAdmin, ownsStudent } = require('../middleware/authMiddleware');

router.get('/', verifyToken, isAdmin, studentController.getAllStudents);
router.get('/:id', verifyToken, ownsStudent, studentController.getStudentById);
router.post('/', verifyToken, isAdmin, studentController.createStudent);
router.put('/:id', verifyToken, ownsStudent, studentController.updateStudent);
router.delete('/:id', verifyToken, isAdmin, studentController.deleteStudent);

module.exports = router;
