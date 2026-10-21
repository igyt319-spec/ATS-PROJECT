const express = require('express');
const router = express.Router();
const studyPlannerController = require('../controllers/studyPlannerController');
const { verifyToken, ownsStudentOrAssigned } = require('../middleware/authMiddleware');

router.get('/:studentId', verifyToken, ownsStudentOrAssigned, studyPlannerController.getStudyPlan);
router.post('/', verifyToken, ownsStudentOrAssigned, studyPlannerController.updateStudyPlanSettings);
router.post('/task', verifyToken, ownsStudentOrAssigned, studyPlannerController.addStudyTask);
router.put('/task/:taskId', verifyToken, studyPlannerController.updateStudyTask);
router.delete('/task/:taskId', verifyToken, studyPlannerController.deleteStudyTask);

module.exports = router;
