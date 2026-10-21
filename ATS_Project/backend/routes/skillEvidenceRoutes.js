const express = require('express');
const router = express.Router();
const skillEvidenceController = require('../controllers/skillEvidenceController');
const { verifyToken, isFaculty, ownsStudentOrAssigned } = require('../middleware/authMiddleware');

router.get('/:studentId', verifyToken, ownsStudentOrAssigned, skillEvidenceController.getSkillEvidenceGraph);
router.post('/verify', verifyToken, isFaculty, skillEvidenceController.verifyStudentSkill);

module.exports = router;
