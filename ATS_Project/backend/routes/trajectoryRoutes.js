const express = require('express');
const router = express.Router();
const trajectoryController = require('../controllers/trajectoryController');
const { verifyToken, ownsStudentOrAssigned } = require('../middleware/authMiddleware');

router.get('/predict/:studentId', verifyToken, ownsStudentOrAssigned, trajectoryController.getTrajectoryPrediction);

module.exports = router;
