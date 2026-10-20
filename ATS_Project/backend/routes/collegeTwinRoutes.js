const express = require('express');
const router = express.Router();
const collegeTwinController = require('../controllers/collegeTwinController');
const { verifyToken, isHOD } = require('../middleware/authMiddleware');

router.get('/department/:departmentId', verifyToken, isHOD, collegeTwinController.getDepartmentTwin);
router.get('/department-summary', verifyToken, isHOD, collegeTwinController.getDepartmentTwin);
router.get('/institution', verifyToken, collegeTwinController.getInstitutionTwin);
router.get('/institutional-summary', verifyToken, collegeTwinController.getInstitutionTwin);

module.exports = router;
