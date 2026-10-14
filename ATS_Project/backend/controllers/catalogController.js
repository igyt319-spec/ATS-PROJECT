const db = require('../config/db');

async function getDepartments(req, res) {
  try {
    const [rows] = await db.query('SELECT id,code,name,college_id FROM departments ORDER BY name');
    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
}

async function getSubjects(req, res) {
  try {
    const [rows] = await db.query('SELECT s.id,s.subject_code AS code,s.subject_name AS name,d.name AS department,s.credits,s.semester_number,s.subject_type FROM subjects s LEFT JOIN departments d ON d.id=s.department_id ORDER BY s.subject_code');
    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
}

module.exports = { getDepartments, getSubjects };
