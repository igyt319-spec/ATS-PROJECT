const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

router.get('/', departmentController.getAllDepartments);
router.get('/institutional-overview', verifyToken, isAdmin, departmentController.getInstitutionDepartmentOverview);
router.get('/faculty/:id/mini-dashboard', verifyToken, departmentController.getFacultyMiniDashboard);
router.get('/:id', departmentController.getDepartmentById);
router.put('/:id/hod', verifyToken, isAdmin, departmentController.assignDepartmentHOD);
router.post('/', verifyToken, isAdmin, departmentController.createDepartment);

module.exports = router;
