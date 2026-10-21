const express = require('express');
const router = express.Router();
const knowledgeGraphController = require('../controllers/knowledgeGraphController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/', verifyToken, knowledgeGraphController.getKnowledgeGraph);
router.get('/node/:nodeId', verifyToken, knowledgeGraphController.getNodeDetails);

module.exports = router;
