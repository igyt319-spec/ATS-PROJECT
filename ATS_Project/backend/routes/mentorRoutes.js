const express = require('express');
const router = express.Router();
const mentorController = require('../controllers/mentorController');
const { verifyToken, isHOD, isMentor, ownsStudentOrAssigned } = require('../middleware/authMiddleware');

router.get('/my-mentees', verifyToken, isMentor, mentorController.getMyMentees);
router.get('/department-allocations', verifyToken, isHOD, mentorController.getDepartmentAllocations);
router.post('/assign', verifyToken, isHOD, mentorController.assignMentor);
router.post('/auto-assign-department', verifyToken, isHOD, mentorController.autoAssignDepartment);
router.get('/student-mentor/:studentId', verifyToken, ownsStudentOrAssigned, mentorController.getStudentAssignedMentor);

module.exports = router;
