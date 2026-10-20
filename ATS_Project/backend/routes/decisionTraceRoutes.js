const express = require('express');
const router = express.Router();
const decisionTraceController = require('../controllers/decisionTraceController');
const { verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/', decisionTraceController.getDecisionTraces);
router.post('/', decisionTraceController.createDecisionTrace);
router.put('/:id/decision', decisionTraceController.reviewDecisionTrace);
router.get('/rules', decisionTraceController.getDecisionRulesCatalog);

module.exports = router;
