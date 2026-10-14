const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');
const { verifyToken, ownsStudent, isAdmin } = require('../middleware/authMiddleware');

router.get('/:studentId', verifyToken, ownsStudent, recommendationController.getRecommendationsByStudent);
router.post('/', verifyToken, isAdmin, recommendationController.addRecommendation);
router.put('/:id', verifyToken, recommendationController.updateRecommendationStatus);

module.exports = router;
