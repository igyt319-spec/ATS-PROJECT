const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

router.get('/', verifyToken, isAdmin, auditController.getAuditLogs);

module.exports = router;
