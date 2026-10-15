const express = require('express');
const router = express.Router();
const academicResultsController = require('../controllers/academicResultsController');
const { verifyToken, isAdmin, isHOD, isMentor, ownsStudentOrAssigned } = require('../middleware/authMiddleware');

router.get('/student/:studentId', verifyToken, ownsStudentOrAssigned, academicResultsController.getStudentResults);
router.get('/mentor/mentees', verifyToken, isMentor, academicResultsController.getMentorMenteeResults);
router.get('/department', verifyToken, isHOD, academicResultsController.getDepartmentResults);
router.post('/', verifyToken, isAdmin, academicResultsController.createAcademicResult);
router.post('/correct', verifyToken, isHOD, academicResultsController.correctAcademicResult);
router.put('/:id/publish', verifyToken, isAdmin, academicResultsController.publishResult);

module.exports = router;
