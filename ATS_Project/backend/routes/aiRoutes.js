const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { verifyToken, isAdmin, ownsStudent } = require('../middleware/authMiddleware');

router.get('/analysis/:studentId', verifyToken, ownsStudent, aiController.getAnalysis);
router.post('/run-agent', verifyToken, (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'faculty') return next();
  const targetId = Number(req.body.student_id || req.body.studentId);
  if (req.user.studentId && Number(req.user.studentId) === targetId) return next();
  return res.status(403).json({ success: false, message: 'Unauthorized: You can only run AI heuristic diagnosis on your own profile.' });
}, aiController.runAgent);

module.exports = router;
