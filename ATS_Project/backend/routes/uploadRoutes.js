const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/avatar', verifyToken, uploadController.uploadAvatar);

module.exports = router;
