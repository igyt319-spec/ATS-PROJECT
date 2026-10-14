const express = require('express');
const router = express.Router();
const catalog = require('../controllers/catalogController');
router.get('/departments', catalog.getDepartments);
router.get('/subjects', catalog.getSubjects);
module.exports = router;
