const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { verifyToken, isStrictAdmin } = require('../middleware/authMiddleware');

// Accessible to administrators for system governance
router.get('/export', verifyToken, isStrictAdmin, auditController.exportAuditLogs);
router.get('/anomalies', verifyToken, isStrictAdmin, auditController.getAuditAnomalies);
router.get('/', verifyToken, isStrictAdmin, auditController.getAuditLogs);

module.exports = router;
