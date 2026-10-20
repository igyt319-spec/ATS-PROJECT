const express = require('express');
const router = express.Router();
const impactLoopController = require('../controllers/impactLoopController');
const { verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/', impactLoopController.getInterventions);
router.post('/', impactLoopController.createIntervention);
router.post('/interventions', impactLoopController.createIntervention);
router.put('/interventions/:id', impactLoopController.updateIntervention);
router.get('/analytics', impactLoopController.getImpactLoopAnalytics);
router.get('/summary', impactLoopController.getImpactLoopAnalytics);

module.exports = router;
