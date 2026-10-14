const express = require('express');
const router = express.Router();
const performanceController = require('../controllers/performanceController');
const { verifyToken, isAdmin, ownsStudent } = require('../middleware/authMiddleware');

router.get('/:studentId', verifyToken, ownsStudent, performanceController.getPerformanceByStudent);
router.post('/', verifyToken, isAdmin, performanceController.addMarks);
router.put('/:id', verifyToken, isAdmin, performanceController.updateMarks);
router.delete('/:id', verifyToken, isAdmin, performanceController.deleteMarks);

module.exports = router;
