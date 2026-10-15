const express = require('express');
const router = express.Router();
const achievementController = require('../controllers/achievementController');
const { verifyToken, isFaculty, ownsStudent } = require('../middleware/authMiddleware');

router.get('/', verifyToken, isFaculty, achievementController.getAllAchievements);
router.get('/:studentId', verifyToken, ownsStudent, achievementController.getAchievementsByStudent);
router.post('/', verifyToken, (req, res, next) => {
  if (req.user.role === 'faculty') return next();
  const targetId = Number(req.body.student_id || req.body.studentId);
  if (req.user.studentId && Number(req.user.studentId) === targetId) return next();
  return res.status(403).json({ success: false, message: 'Unauthorized to add achievement for this student profile.' });
}, achievementController.addAchievement);
router.put('/:id', verifyToken, achievementController.updateAchievement);
router.delete('/:id', verifyToken, isFaculty, achievementController.deleteAchievement);

module.exports = router;
