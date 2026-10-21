const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { verifyToken, isAdmin, isStrictAdmin, isFaculty } = require('../middleware/authMiddleware');

router.get('/', departmentController.getAllDepartments);
router.get('/institutional-overview', verifyToken, isAdmin, departmentController.getInstitutionDepartmentOverview);
router.get('/mini-dashboards', verifyToken, isAdmin, departmentController.getDepartmentMiniDashboards);
router.get('/faculty/:id/mini-dashboard', verifyToken, isFaculty, departmentController.getFacultyMiniDashboard);
router.get('/:id/student-mini-dashboards', verifyToken, isAdmin, departmentController.getDepartmentStudentCards);
router.get('/:id', departmentController.getDepartmentById);
router.put('/:id/hod', verifyToken, isStrictAdmin, departmentController.assignDepartmentHOD);
router.post('/', verifyToken, isStrictAdmin, departmentController.createDepartment);

module.exports = router;
