const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', verifyToken, authController.getMe);
router.put('/me', verifyToken, authController.updateProfile);
router.put('/profile-photo', verifyToken, authController.updateProfilePhoto);
router.post('/forgot-password', authController.forgotPassword);
router.put('/change-password', verifyToken, authController.changePassword);
router.put('/change-identifier', verifyToken, authController.changeIdentifier);

module.exports = router;
