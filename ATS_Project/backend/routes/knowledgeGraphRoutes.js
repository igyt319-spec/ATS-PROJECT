const express = require('express');
const router = express.Router();
const knowledgeGraphController = require('../controllers/knowledgeGraphController');
const { verifyToken } = require('../middleware/authMiddleware');

function rejectAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Administrators cannot access student academic intelligence modules.'
    });
  }
  next();
}

router.get('/', verifyToken, rejectAdmin, knowledgeGraphController.getKnowledgeGraph);
router.get('/node/:nodeId', verifyToken, rejectAdmin, knowledgeGraphController.getNodeDetails);

module.exports = router;
