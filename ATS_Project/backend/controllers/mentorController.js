const db = require('../../database/db');

// GET /api/mentors/my-mentees (Faculty Mentor view)
async function getMyMentees(req, res) {
  try {
    const facultyId = req.user.facultyId;
    if (!facultyId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Faculty profile not resolved.' });
    }

    let query = `
      SELECT sm.id AS assignment_id, sm.assigned_at, sm.status AS assignment_status,
             st.id AS student_id, st.name AS student_name, st.register_number, st.email, st.phone, st.year, st.semester, st.bio, st.avatar,
             st.gpa, st.cgpa, st.attendance_percentage, st.risk_level,
             d.name AS department_name,
             (SELECT COUNT(*) FROM leave_requests lr WHERE lr.student_id = st.id AND lr.status = 'Pending') AS pending_leaves,
             (SELECT COUNT(*) FROM student_activities sa WHERE sa.student_id = st.id AND sa.status = 'Pending') AS pending_activities,
             (SELECT COUNT(*) FROM academic_results ar WHERE ar.student_id = st.id AND ar.status = 'Pending') AS pending_results,
             (SELECT COALESCE(SUM(sf.balance_amount), 0) FROM student_fees sf WHERE sf.student_id = st.id) AS outstanding_fee
      FROM student_mentors sm
      JOIN students st ON st.id = sm.student_id
      LEFT JOIN departments d ON d.id = st.department_id
      WHERE sm.faculty_id = ? AND sm.status = 'active'
      ORDER BY st.register_number ASC
    `;

    const [rows] = await db.query(query, [facultyId]);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    console.error('[getMyMentees Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/mentors/department-allocations (HOD & Admin view)
async function getDepartmentAllocations(req, res) {
  try {
    const departmentId = req.user.role === 'admin' && req.query.department_id
      ? parseInt(req.query.department_id, 10)
      : req.user.departmentId;

    if (!departmentId) {
      return res.status(400).json({ success: false, message: 'Department scope could not be determined.' });
    }

    // Get all students in department with current active mentor
    const [students] = await db.query(
      `SELECT st.id AS student_id, st.name AS student_name, st.register_number, st.year, st.semester, st.email, st.avatar,
              sm.id AS assignment_id, sm.assigned_at,
              f.id AS mentor_faculty_id, f.name AS mentor_name, f.email AS mentor_email, f.avatar AS mentor_avatar
       FROM students st
       LEFT JOIN student_mentors sm ON sm.student_id = st.id AND sm.status = 'active'
       LEFT JOIN faculty f ON f.id = sm.faculty_id
       WHERE st.department_id = ?
       ORDER BY st.register_number ASC`,
      [departmentId]
    );

    // Get all department faculty members (including HOD and all staff)
    const [faculty] = await db.query(
      `SELECT f.id, f.faculty_code, f.name, f.email, f.designation, f.avatar, f.is_hod, f.can_mentor,
              (SELECT COUNT(*) FROM student_mentors sm WHERE sm.faculty_id = f.id AND sm.status = 'active') AS mentee_count
       FROM faculty f
       WHERE f.department_id = ?
       ORDER BY f.is_hod DESC, f.name ASC`,
      [departmentId]
    );

    // Eligible mentors for assignment dropdown
    const mentors = faculty.filter(f => f.can_mentor == 1);

    return res.status(200).json({
      success: true,
      departmentId,
      studentsCount: students.length,
      mentorsCount: mentors.length,
      facultyCount: faculty.length,
      students,
      mentors,
      faculty
    });
  } catch (err) {
    console.error('[getDepartmentAllocations Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/mentors/assign (HOD or Admin assign/reassign mentor)
async function assignMentor(req, res) {
  try {
    const { student_id, faculty_id } = req.body;

    if (!student_id || !faculty_id) {
      return res.status(400).json({
        success: false,
        message: 'Both student ID and faculty mentor ID are required.'
      });
    }

    // Check student existence & department
    const [stRows] = await db.query('SELECT id, department_id, name FROM students WHERE id = ?', [student_id]);
    if (stRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }
    const student = stRows[0];

    // Check faculty mentor existence & department & can_mentor
    const [facRows] = await db.query('SELECT id, department_id, name, can_mentor FROM faculty WHERE id = ?', [faculty_id]);
    if (facRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Faculty mentor record not found.' });
    }
    const mentor = facRows[0];

    if (!mentor.can_mentor) {
      return res.status(400).json({
        success: false,
        message: 'Selected faculty member is not designated as an authorized mentor.'
      });
    }

    // Validate department scope
    if (req.user.role === 'faculty') {
      if (req.user.departmentId !== student.department_id || req.user.departmentId !== mentor.department_id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: HOD can only assign mentors and students within their own department.'
        });
      }
    } else if (student.department_id !== mentor.department_id) {
      return res.status(400).json({
        success: false,
        message: 'Department mismatch: Student and Mentor must belong to the same academic department.'
      });
    }

    // Deactivate any existing active assignment for this student
    await db.query(
      "UPDATE student_mentors SET status = 'inactive', updated_at = NOW() WHERE student_id = ? AND status = 'active'",
      [student_id]
    );

    // Insert new assignment
    const [result] = await db.query(
      `INSERT INTO student_mentors (student_id, faculty_id, assigned_by, status, assigned_at)
       VALUES (?, ?, ?, 'active', NOW())`,
      [student_id, faculty_id, req.user.id]
    );

    return res.status(200).json({
      success: true,
      message: `Successfully assigned ${mentor.name} as mentor for student ${student.name}.`,
      assignmentId: result.insertId
    });
  } catch (err) {
    console.error('[assignMentor Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/mentors/auto-assign-department (Deterministic Round-Robin Allocation)
async function autoAssignDepartment(req, res) {
  try {
    const departmentId = req.user.role === 'admin' && req.body.department_id
      ? parseInt(req.body.department_id, 10)
      : req.user.departmentId;

    if (!departmentId) {
      return res.status(400).json({ success: false, message: 'Department scope could not be determined.' });
    }

    // Get active mentors in department
    const [mentors] = await db.query(
      'SELECT id, name FROM faculty WHERE department_id = ? AND can_mentor = 1 ORDER BY id ASC',
      [departmentId]
    );

    if (mentors.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No eligible mentors found in this department. Please configure faculty can_mentor first.'
      });
    }

    // Get unassigned students in department
    const [unassignedStudents] = await db.query(
      `SELECT st.id, st.name, st.register_number 
       FROM students st
       LEFT JOIN student_mentors sm ON sm.student_id = st.id AND sm.status = 'active'
       WHERE st.department_id = ? AND sm.id IS NULL
       ORDER BY st.register_number ASC`,
      [departmentId]
    );

    if (unassignedStudents.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'All students in this department already have active mentor assignments.',
        assignedCount: 0
      });
    }

    let assignedCount = 0;
    for (let i = 0; i < unassignedStudents.length; i++) {
      const student = unassignedStudents[i];
      // Deterministic round-robin index
      const mentor = mentors[i % mentors.length];

      await db.query(
        `INSERT INTO student_mentors (student_id, faculty_id, assigned_by, status, assigned_at)
         VALUES (?, ?, ?, 'active', NOW())`,
        [student.id, mentor.id, req.user.id]
      );
      assignedCount++;
    }

    return res.status(200).json({
      success: true,
      message: `Successfully auto-allocated ${assignedCount} students across ${mentors.length} mentors.`,
      assignedCount
    });

  } catch (err) {
    console.error('[autoAssignDepartment Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/mentors/student-mentor/:studentId (Student view of their assigned mentor)
async function getStudentAssignedMentor(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);

    const [rows] = await db.query(
      `SELECT f.id, f.name, f.email, f.designation, f.avatar,
              d.name AS department_name, sm.assigned_at
       FROM student_mentors sm
       JOIN faculty f ON f.id = sm.faculty_id
       LEFT JOIN departments d ON d.id = f.department_id
       WHERE sm.student_id = ? AND sm.status = 'active'
       LIMIT 1`,
      [studentId]
    );

    if (rows.length === 0) {
      return res.status(200).json({
        success: true,
        assigned: false,
        mentor: null
      });
    }

    return res.status(200).json({
      success: true,
      assigned: true,
      mentor: rows[0]
    });
  } catch (err) {
    console.error('[getStudentAssignedMentor Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getMyMentees,
  getDepartmentAllocations,
  assignMentor,
  autoAssignDepartment,
  getStudentAssignedMentor
};
