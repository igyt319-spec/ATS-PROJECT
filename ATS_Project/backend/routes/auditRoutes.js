const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { verifyToken, isStrictAdmin } = require('../middleware/authMiddleware');

router.get('/', verifyToken, isStrictAdmin, auditController.getAuditLogs);

module.exports = router;
