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
    const { register_number, name, email, phone, department, year, semester, bio, avatar } = req.body;

    if (!register_number || !name || !email || !department) {
      return res.status(400).json({
        success: false,
        message: 'Register number, name, email, and department are required.'
      });
    }

    // Insert user first
    const temporaryPassword = crypto.randomBytes(8).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const photoToSave = avatar || null;

    const [userRes] = await db.query(
      'INSERT INTO users (name, email, register_number, password, role, avatar) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, register_number, passwordHash, 'student', photoToSave]
    );

    const userId = userRes.insertId;

    const [result] = await db.query(
      `INSERT INTO students (user_id, register_number, name, email, phone, department_id, program_id, current_semester_id, year, semester, academic_year, bio, avatar)
       SELECT ?, ?, ?, ?, ?, d.id, (SELECT MIN(p.id) FROM programs p WHERE p.department_id=d.id), sem.id, ?, ?, ay.label, ?, ?
       FROM departments d JOIN academic_years ay ON ay.label='2026-2027' JOIN semesters sem ON sem.academic_year_id=ay.id AND sem.semester_number=1 WHERE d.name=?`,
      [
        userId,
        register_number,
        name,
        email,
        phone || null,
        year || 'III Year',
        semester || 'Semester 1',
        bio || 'Newly enrolled undergraduate student.',
        photoToSave,
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

    // If student user: least-privilege enforcement
    if (req.user && req.user.role === 'student') {
      const { phone, bio, avatar } = req.body;
      const updates = [];
      const params = [];

      if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
      if (bio !== undefined) { updates.push('bio = ?'); params.push(bio); }
      if (avatar !== undefined) { updates.push('avatar = ?'); params.push(avatar); }

      if (updates.length > 0) {
        params.push(id);
        await db.query(`UPDATE students SET ${updates.join(', ')} WHERE id = ?`, params);

        if (avatar !== undefined) {
          const [st] = await db.query('SELECT user_id FROM students WHERE id = ?', [id]);
          if (st.length > 0) {
            await db.query('UPDATE users SET avatar = ? WHERE id = ?', [avatar, st[0].user_id]);
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Student profile updated successfully (permitted fields: phone, bio, avatar).'
      });
    }

    // If faculty/HOD: ensure department scope
    if (req.user && req.user.role === 'faculty') {
      const [st] = await db.query('SELECT department_id FROM students WHERE id = ?', [id]);
      if (st.length === 0) return res.status(404).json({ success: false, message: 'Student not found.' });
      if (req.user.departmentId && st[0].department_id !== req.user.departmentId) {
        return res.status(403).json({ success: false, message: 'Access denied: Student is outside your department.' });
      }
    }

    // Admin full update
    const { name, email, phone, department, year, bio, avatar } = req.body;

    await db.query(
      `UPDATE students st 
       LEFT JOIN departments d ON d.name = ?
       SET st.name = COALESCE(?, st.name),
           st.email = COALESCE(?, st.email),
           st.phone = ?,
           st.department_id = COALESCE(d.id, st.department_id),
           st.year = COALESCE(?, st.year),
           st.bio = COALESCE(?, st.bio),
           st.avatar = COALESCE(?, st.avatar)
       WHERE st.id = ?`,
      [department, name, email, phone || null, year, bio, avatar, id]
    );

    const [student] = await db.query('SELECT user_id FROM students WHERE id = ?', [id]);
    if (student.length && (name || email || avatar)) {
      await db.query(
        'UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), avatar = COALESCE(?, avatar) WHERE id = ?',
        [name, email, avatar, student[0].user_id]
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Student details updated successfully by administrator.'
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

// GET /api/students/:id/mini-dashboard (Section 5)
async function getStudentMiniDashboard(req, res) {
  try {
    const studentId = parseInt(req.params.id, 10);

    // 1. Fetch Student Profile with Department info
    const [students] = await db.query(
      `SELECT st.*, d.name AS department_name, d.code AS department_code,
              u.email AS user_email, u.avatar AS user_avatar
       FROM students st
       LEFT JOIN departments d ON d.id = st.department_id
       LEFT JOIN users u ON u.id = st.user_id
       WHERE st.id = ?`,
      [studentId]
    );

    if (!students || students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }
    const student = students[0];

    // 2. Fetch Active Assigned Mentor
    const [mentorRows] = await db.query(
      `SELECT f.id, f.name, f.email, f.faculty_code, f.designation, f.avatar,
              d.name AS department_name, sm.assigned_at
       FROM student_mentors sm
       JOIN faculty f ON f.id = sm.faculty_id
       LEFT JOIN departments d ON d.id = f.department_id
       WHERE sm.student_id = ? AND sm.status = 'active'
       LIMIT 1`,
      [studentId]
    );
    const assignedMentor = mentorRows.length > 0 ? mentorRows[0] : null;

    // 3. Fetch Attendance Summary & Subject Records
    const [attRows] = await db.query(
      `SELECT a.*, s.subject_name, s.subject_code, s.credits
       FROM attendance a
       LEFT JOIN subjects s ON s.id = a.subject_id
       WHERE a.student_id = ?
       ORDER BY s.subject_code ASC`,
      [studentId]
    ).catch(() => [[]]);
    const totalConducted = (attRows || []).reduce((sum, r) => sum + (Number(r.classes_conducted) || 0), 0);
    const totalAttended = (attRows || []).reduce((sum, r) => sum + (Number(r.classes_attended) || 0), 0);
    const attendancePercentage = totalConducted > 0 ? ((totalAttended / totalConducted) * 100).toFixed(1) : (student.attendance_percentage || 0);

    // 4. Fetch 3-Tier Academic Results (Only published for students, all for faculty/HOD/admin)
    const isStudentUser = req.user.role === 'student';
    const publishFilter = isStudentUser ? 'AND ar.is_published = 1' : '';
    const [results] = await db.query(
      `SELECT ar.*, s.subject_name, s.subject_code, s.credits
       FROM academic_results ar
       LEFT JOIN subjects s ON s.id = ar.subject_id
       WHERE ar.student_id = ? ${publishFilter}
       ORDER BY ar.academic_year DESC, ar.assessment_type ASC, ar.created_at DESC`,
      [studentId]
    ).catch(() => [[]]);

    // 5. Fetch Fee Records & Payment History safely
    let parsedFees = [];
    try {
      const [feeRows] = await db.query(
        `SELECT sf.*,
                (SELECT JSON_ARRAYAGG(JSON_OBJECT(
                  'transaction_ref', fp.transaction_ref,
                  'amount', fp.amount,
                  'payment_method', fp.payment_method,
                  'payment_date', fp.payment_date,
                  'status', fp.status
                )) FROM fee_payments fp WHERE fp.fee_id = sf.id) AS payments
         FROM student_fees sf
         WHERE sf.student_id = ?
         ORDER BY sf.academic_year DESC, sf.semester ASC`,
        [studentId]
      );
      parsedFees = (feeRows || []).map(f => {
        let p = [];
        try {
          p = typeof f.payments === 'string' ? JSON.parse(f.payments) : (f.payments || []);
        } catch (_) { p = []; }
        return { ...f, payments: p };
      });
    } catch (feeErr) {
      console.warn('[Mini-Dashboard] Fee query warning:', feeErr.message);
      parsedFees = [];
    }

    // 6. Fetch Leave History
    const [leaves] = await db.query(
      `SELECT lr.*, u.name AS reviewed_by_name
       FROM leave_requests lr
       LEFT JOIN users u ON u.id = lr.reviewed_by
       WHERE lr.student_id = ?
       ORDER BY lr.created_at DESC
       LIMIT 10`,
      [studentId]
    ).catch(() => [[]]);

    // 7. Fetch Student Activities (6 Categories)
    const [activities] = await db.query(
      `SELECT sa.*, u.name AS verified_by_name
       FROM student_activities sa
       LEFT JOIN users u ON u.id = sa.verified_by
       WHERE sa.student_id = ?
       ORDER BY sa.event_date DESC
       LIMIT 10`,
      [studentId]
    ).catch(() => [[]]);

    // 8. Fetch Academic Alerts & Trends
    const [alerts] = await db.query(
      `SELECT * FROM risk_alerts WHERE student_id = ? ORDER BY created_at DESC LIMIT 5`,
      [studentId]
    ).catch(() => [[]]);

    return res.status(200).json({
      success: true,
      data: {
        student: {
          id: student.id,
          name: student.name,
          register_number: student.register_number,
          email: student.email || student.user_email,
          phone: student.phone,
          bio: student.bio,
          avatar: student.avatar || student.user_avatar,
          department: student.department_name || student.department,
          department_id: student.department_id,
          year: student.year,
          semester: student.semester,
          academic_year: '2026-2027',
          cgpa: Number(student.cgpa || 0),
          gpa: Number(student.gpa || 0),
          attendance_percentage: Number(attendancePercentage)
        },
        assignedMentor,
        attendance: {
          overallPercentage: Number(attendancePercentage),
          totalConducted,
          totalAttended,
          subjects: attRows
        },
        results: {
          total: results.length,
          internals: results.filter(r => r.assessment_type === 'internal' || r.assessment_type === 'internal_exam'),
          labs: results.filter(r => r.assessment_type === 'lab' || r.assessment_type === 'lab_practical'),
          semesters: results.filter(r => r.assessment_type === 'semester' || r.assessment_type === 'semester_result'),
          all: results
        },
        fees: parsedFees,
        leaves,
        activities,
        alerts
      }
    });

  } catch (error) {
    console.error('[Student Mini-Dashboard Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getAllStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentMiniDashboard
};
