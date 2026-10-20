const express = require('express');
const router = express.Router();
const careerController = require('../controllers/careerController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/roles', careerController.getCareerRoles);
router.get('/roles/:id', careerController.getCareerRoleById);
router.post('/target', verifyToken, careerController.setStudentCareerTarget);
router.get('/evaluation/:studentId', verifyToken, careerController.getCareerReadinessEvaluation);
router.get('/assess/:studentId', verifyToken, careerController.getCareerReadinessEvaluation);
router.get('/roadmap/:studentId', verifyToken, careerController.getCareerReadinessEvaluation);
router.post('/skills', verifyToken, careerController.addStudentSkill);
router.put('/skills/:id/verify', verifyToken, careerController.verifyStudentSkill);
router.put('/roles/:id', verifyToken, careerController.updateCareerRole);

module.exports = router;
