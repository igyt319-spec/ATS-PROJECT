const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');
const { verifyToken, isAdmin, isHOD, isMentor, isStrictAdmin, ownsStudentOrAssigned } = require('../middleware/authMiddleware');

router.get('/student/:studentId', verifyToken, ownsStudentOrAssigned, leaveController.getStudentLeaves);
router.get('/mentor/mentees', verifyToken, isMentor, leaveController.getMentorMenteeLeaves);
router.get('/department', verifyToken, isHOD, leaveController.getDepartmentLeaves);
router.get('/institution', verifyToken, isStrictAdmin, leaveController.getInstitutionLeaves);
router.post('/', verifyToken, leaveController.applyLeave);
router.put('/:id/decision', verifyToken, isAdmin, leaveController.reviewLeaveDecision);

module.exports = router;
