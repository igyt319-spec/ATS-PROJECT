const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');
const { verifyToken, isFaculty, isHOD, isMentor, ownsStudentOrAssigned } = require('../middleware/authMiddleware');

// Public QR verification endpoint (No auth required, privacy-safe)
router.get('/passport/verify/:token', activityController.verifyPublicPassport);

// Student Placement-Ready Achievement Passport (Requires authorization)
router.get('/passport/:studentId', verifyToken, ownsStudentOrAssigned, activityController.getAchievementPassport);

router.get('/student/:studentId', verifyToken, ownsStudentOrAssigned, activityController.getStudentActivities);
router.get('/mentor-pending', verifyToken, isMentor, activityController.getMentorMenteeActivities);
router.get('/mentor/mentees', verifyToken, isMentor, activityController.getMentorMenteeActivities);
router.get('/department', verifyToken, isHOD, activityController.getDepartmentActivities);
router.get('/institution', verifyToken, isFaculty, activityController.getInstitutionActivities);
router.post('/', verifyToken, activityController.submitActivity);
router.post('/student', verifyToken, activityController.submitActivity);
router.put('/:id/verify', verifyToken, isFaculty, activityController.verifyActivity);

module.exports = router;
