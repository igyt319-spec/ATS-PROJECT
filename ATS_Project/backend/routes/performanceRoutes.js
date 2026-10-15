const express = require('express');
const router = express.Router();
const performanceController = require('../controllers/performanceController');
const { verifyToken, isFaculty, ownsStudent } = require('../middleware/authMiddleware');

router.get('/:studentId', verifyToken, ownsStudent, performanceController.getPerformanceByStudent);
router.post('/', verifyToken, isFaculty, performanceController.addMarks);
router.put('/:id', verifyToken, isFaculty, performanceController.updateMarks);
router.delete('/:id', verifyToken, isFaculty, performanceController.deleteMarks);

module.exports = router;
