const db = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// GET /api/students
async function getAllStudents(req, res) {
  try {
    const { search, department, risk, semester } = req.query;
    const [students] = await db.query(`SELECT st.*,d.name AS department_name,
      (SELECT COALESCE(SUM(m.grade_point*su.credits)/NULLIF(SUM(su.credits),0),0) FROM marks m JOIN subjects su ON su.id=m.subject_id WHERE m.student_id=st.id AND m.semester_id=st.current_semester_id) AS computed_gpa,
      (SELECT COALESCE(SUM(m.grade_point*su.credits)/NULLIF(SUM(su.credits),0),0) FROM marks m JOIN subjects su ON su.id=m.subject_id WHERE m.student_id=st.id) AS computed_cgpa,
      (SELECT COALESCE(100*SUM(a.classes_attended)/NULLIF(SUM(a.classes_conducted),0),0) FROM attendance a WHERE a.student_id=st.id AND a.semester_id=st.current_semester_id) AS computed_attendance,
      (SELECT COUNT(*) FROM marks m WHERE m.student_id=st.id AND m.semester_id=st.current_semester_id AND m.total_marks<60) AS weak_count
      FROM students st LEFT JOIN departments d ON d.id=st.department_id ORDER BY st.id ASC`);

    const enriched = students.map(s => {
      const gpa = Number(s.computed_gpa ?? s.gpa ?? 0), attendance = Number(s.computed_attendance ?? s.attendance_percentage ?? 0), weak = Number(s.weak_count || 0);
      const risk_level = attendance < 75 || gpa < 6 || weak >= 2 ? 'HIGH' : attendance < 85 || gpa < 7.5 || weak ? 'MEDIUM' : 'LOW';
      return { ...s, department: s.department_name || s.department, gpa, cgpa: Number(s.computed_cgpa ?? s.cgpa ?? 0), attendance_percentage: attendance, risk_level };
    });
    let filtered = enriched;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.register_number.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      );
    }
    if (department && department !== 'All') {
      filtered = filtered.filter(s => s.department === department);
    }
    if (risk && risk !== 'All') {
      filtered = filtered.filter(s => s.risk_level === risk);
    }
    if (semester && semester !== 'All') filtered = filtered.filter(s => s.semester === semester);

    return res.status(200).json({
      success: true,
      count: filtered.length,
      data: filtered
    });
  } catch (error) {
    console.error('[Student GetAll Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/students/:id
async function getStudentById(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const [rows] = await db.query(`SELECT st.*,d.name AS department_name,
      COALESCE((SELECT SUM(m.grade_point*su.credits)/NULLIF(SUM(su.credits),0) FROM marks m JOIN subjects su ON su.id=m.subject_id WHERE m.student_id=st.id AND m.semester_id=st.current_semester_id),0) AS computed_gpa,
      COALESCE((SELECT SUM(m.grade_point*su.credits)/NULLIF(SUM(su.credits),0) FROM marks m JOIN subjects su ON su.id=m.subject_id WHERE m.student_id=st.id),0) AS computed_cgpa,
      COALESCE((SELECT 100*SUM(a.classes_attended)/NULLIF(SUM(a.classes_conducted),0) FROM attendance a WHERE a.student_id=st.id AND a.semester_id=st.current_semester_id),0) AS computed_attendance
      FROM students st LEFT JOIN departments d ON d.id=st.department_id WHERE st.id = ?`, [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    const student = rows[0];

    // Fetch related marks, attendance, achievements
    const [marks] = await db.query('SELECT m.*,su.subject_name,su.credits FROM marks m JOIN subjects su ON su.id=m.subject_id WHERE m.student_id = ?', [id]);
    const [attendance] = await db.query('SELECT a.*,su.subject_name FROM attendance a JOIN subjects su ON su.id=a.subject_id WHERE a.student_id = ?', [id]);
    const [achievements] = await db.query('SELECT * FROM achievements WHERE student_id = ?', [id]);
    const [recommendations] = await db.query('SELECT * FROM recommendations WHERE student_id = ?', [id]);

    const markAverage = marks.length ? marks.reduce((sum, m) => sum + Number(m.total_marks || 0), 0) / marks.length : 0;
    const verifiedAchievements = achievements.filter(a => a.status === 'Verified').length;
    const attendancePercentage = Number(student.computed_attendance ?? student.attendance_percentage ?? 0);
    const academicScore = Math.round(0.7 * markAverage + 0.2 * attendancePercentage + 0.1 * Math.min(100, verifiedAchievements * 12.5));
    const currentGpa = Number(student.computed_gpa ?? student.gpa ?? 0);
    const cumulativeGpa = Number(student.computed_cgpa ?? student.cgpa ?? 0);
    const risk = attendancePercentage < 75 || currentGpa < 6 || marks.filter(m => Number(m.total_marks) < 60).length >= 2 ? 'HIGH'
      : attendancePercentage < 85 || currentGpa < 7.5 || marks.some(m => Number(m.total_marks) < 60) ? 'MEDIUM' : 'LOW';

    return res.status(200).json({
      success: true,
      data: {
        ...student,
        department: student.department_name || student.department,
        gpa: currentGpa,
        cgpa: cumulativeGpa,
        attendance_percentage: attendancePercentage,
        academic_score: academicScore,
        risk_level: risk,
        marks,
        attendance,
        achievements,
        recommendations
      }
    });
  } catch (error) {
    console.error('[Student GetById Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// POST /api/students
async function createStudent(req, res) {
  try {
    const { register_number, name, email, phone, department, year, semester, gpa, cgpa, attendance_percentage, academic_score, risk_level, bio } = req.body;

    if (!register_number || !name || !email || !department) {
      return res.status(400).json({
        success: false,
        message: 'Register number, name, email, and department are required.'
      });
    }

    // Insert user first
    const temporaryPassword = crypto.randomBytes(8).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const [userRes] = await db.query(
      'INSERT INTO users (name, email, register_number, password, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, register_number, passwordHash, 'student']
    );

    const userId = userRes.insertId || 10;

    const [result] = await db.query(
      `INSERT INTO students (user_id, register_number, name, email, phone, department_id, program_id, current_semester_id, year, semester, academic_year, bio)
       SELECT ?, ?, ?, ?, ?, d.id, (SELECT MIN(p.id) FROM programs p WHERE p.department_id=d.id), sem.id, ?, ?, ay.label, ?
       FROM departments d JOIN academic_years ay ON ay.label='2026-2027' JOIN semesters sem ON sem.academic_year_id=ay.id AND sem.semester_number=1 WHERE d.name=?`,
      [
        userId,
        register_number,
        name,
        email,
        phone || null,
        year || 'III Year',
        semester || 'Semester 1',
        bio || 'Newly enrolled student.',
        department
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Student record created successfully.',
      studentId: result.insertId,
      temporaryPassword
    });
  } catch (error) {
    console.error('[Student Create Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// PUT /api/students/:id
async function updateStudent(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, email, phone, department, year, bio, gpa, attendance_percentage, risk_level } = req.body;

    await db.query(
      `UPDATE students st JOIN departments d ON d.name=?
       SET st.name=?,st.email=?,st.phone=?,st.department_id=d.id,st.program_id=(SELECT MIN(p.id) FROM programs p WHERE p.department_id=d.id),st.year=? WHERE st.id=?`,
      [department, name, email, phone || null, year, id]
    );
    const [student] = await db.query('SELECT user_id FROM students WHERE id=?', [id]);
    if (student.length) await db.query('UPDATE users SET name=?,email=? WHERE id=?', [name,email,student[0].user_id]);

    return res.status(200).json({
      success: true,
      message: 'Student details updated successfully.'
    });
  } catch (error) {
    console.error('[Student Update Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// DELETE /api/students/:id
async function deleteStudent(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    await db.query('DELETE FROM students WHERE id = ?', [id]);

    return res.status(200).json({
      success: true,
      message: 'Student record deleted successfully.'
    });
  } catch (error) {
    console.error('[Student Delete Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getAllStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent
};
