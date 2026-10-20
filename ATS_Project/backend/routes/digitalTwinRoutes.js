const express = require('express');
const router = express.Router();
const digitalTwinController = require('../controllers/digitalTwinController');
const { verifyToken, ownsStudent } = require('../middleware/authMiddleware');

// GET /api/digital-twin/:studentId - Protected, requires authenticated ownership or assigned mentor/HOD
router.get('/:studentId', verifyToken, ownsStudent, digitalTwinController.getDigitalTwinProfile);

module.exports = router;
