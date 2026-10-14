const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');
const { verifyToken, isAdmin, isHOD, isMentor, isStrictAdmin, ownsStudentOrAssigned } = require('../middleware/authMiddleware');

router.get('/student/:studentId', verifyToken, ownsStudentOrAssigned, activityController.getStudentActivities);
router.get('/mentor/mentees', verifyToken, isMentor, activityController.getMentorMenteeActivities);
router.get('/department', verifyToken, isHOD, activityController.getDepartmentActivities);
router.get('/institution', verifyToken, isStrictAdmin, activityController.getInstitutionActivities);
router.post('/', verifyToken, activityController.submitActivity);
router.put('/:id/verify', verifyToken, isAdmin, activityController.verifyActivity);

module.exports = router;
