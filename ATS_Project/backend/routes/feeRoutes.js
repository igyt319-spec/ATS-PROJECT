const express = require('express');
const router = express.Router();
const feeController = require('../controllers/feeController');
const { verifyToken, isHOD, isMentor, isStrictAdmin, ownsStudentOrAssigned } = require('../middleware/authMiddleware');

router.get('/student/:studentId', verifyToken, ownsStudentOrAssigned, feeController.getStudentFees);
router.get('/mentor/mentees', verifyToken, isMentor, feeController.getMentorMenteeFees);
router.get('/department', verifyToken, isHOD, feeController.getDepartmentFees);
router.get('/institution', verifyToken, isStrictAdmin, feeController.getInstitutionFees);
router.post('/checkout', verifyToken, feeController.createCheckoutSession);
router.post('/pay', verifyToken, feeController.processDemoPayment);
router.get('/receipt/:transactionRef', verifyToken, feeController.getPaymentReceipt);
router.get('/invoice/:feeId', verifyToken, feeController.getFeeInvoice);

module.exports = router;
