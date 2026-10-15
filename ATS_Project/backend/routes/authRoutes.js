const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken, isStrictAdmin } = require('../middleware/authMiddleware');

router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', verifyToken, authController.getMe);
router.put('/me', verifyToken, authController.updateProfile);
router.put('/profile-photo', verifyToken, authController.updateProfilePhoto);
router.post('/forgot-password', authController.forgotPassword);
router.put('/change-password', verifyToken, authController.changePassword);
router.put('/change-identifier', verifyToken, authController.changeIdentifier);
router.post('/seed-demo', verifyToken, authController.seedDemoData);

// Strict Admin Only: Account Creation & Maintenance
router.get('/users', verifyToken, isStrictAdmin, authController.listUsers);
router.post('/users', verifyToken, isStrictAdmin, authController.createUser);
router.put('/users/:id/status', verifyToken, isStrictAdmin, authController.toggleUserStatus);
router.put('/users/:id/reset-password', verifyToken, isStrictAdmin, authController.adminResetPassword);
router.put('/users/:id/department', verifyToken, isStrictAdmin, authController.adminUpdateDepartment);

module.exports = router;
