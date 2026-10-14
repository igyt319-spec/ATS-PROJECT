const db = require('../../database/db');

// GET /api/leave/student/:studentId
async function getStudentLeaves(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);

    const [rows] = await db.query(
      `SELECT lr.*, 
              st.name AS student_name, st.register_number,
              u.name AS reviewed_by_name
       FROM leave_requests lr
       JOIN students st ON st.id = lr.student_id
       LEFT JOIN users u ON u.id = lr.reviewed_by
       WHERE lr.student_id = ?
       ORDER BY lr.created_at DESC`,
      [studentId]
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    console.error('[getStudentLeaves Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/leave/mentor/mentees
async function getMentorMenteeLeaves(req, res) {
  try {
    const facultyId = req.user.facultyId;
    if (!facultyId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Faculty profile not resolved.' });
    }

    let filterQuery = "WHERE sm.faculty_id = ? AND sm.status = 'active'";
    let filterParams = [facultyId];

    if (req.user.role === 'admin' && !facultyId) {
      filterQuery = '';
      filterParams = [];
    }

    const [rows] = await db.query(
      `SELECT lr.*, 
              st.name AS student_name, st.register_number, st.year,
              d.name AS department_name,
              u.name AS reviewed_by_name
       FROM leave_requests lr
       JOIN student_mentors sm ON sm.student_id = lr.student_id
       JOIN students st ON st.id = lr.student_id
       LEFT JOIN departments d ON d.id = st.department_id
       LEFT JOIN users u ON u.id = lr.reviewed_by
       ${filterQuery}
       ORDER BY lr.created_at DESC`,
      filterParams
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    console.error('[getMentorMenteeLeaves Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/leave/department
async function getDepartmentLeaves(req, res) {
  try {
    const departmentId = req.user.role === 'admin' && req.query.department_id
      ? parseInt(req.query.department_id, 10)
      : req.user.departmentId;

    if (!departmentId) {
      return res.status(400).json({ success: false, message: 'Department scope could not be determined.' });
    }

    const [rows] = await db.query(
      `SELECT lr.*, 
              st.name AS student_name, st.register_number, st.year,
              d.name AS department_name,
              u.name AS reviewed_by_name
       FROM leave_requests lr
       JOIN students st ON st.id = lr.student_id
       JOIN departments d ON d.id = st.department_id
       LEFT JOIN users u ON u.id = lr.reviewed_by
       WHERE st.department_id = ?
       ORDER BY lr.created_at DESC`,
      [departmentId]
    );

    return res.status(200).json({
      success: true,
      departmentId,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    console.error('[getDepartmentLeaves Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/leave/institution (Admin only)
async function getInstitutionLeaves(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT lr.*, 
              st.name AS student_name, st.register_number, st.year,
              d.name AS department_name,
              u.name AS reviewed_by_name
       FROM leave_requests lr
       JOIN students st ON st.id = lr.student_id
       JOIN departments d ON d.id = st.department_id
       LEFT JOIN users u ON u.id = lr.reviewed_by
       ORDER BY lr.created_at DESC`
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    console.error('[getInstitutionLeaves Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/leave (Student application)
async function applyLeave(req, res) {
  try {
    const studentId = req.user.role === 'student' ? req.user.studentId : parseInt(req.body.student_id, 10);
    const { leave_type, start_date, end_date, reason } = req.body;

    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Valid student ID is required.' });
    }

    if (!leave_type || !start_date || !end_date || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Leave type, start date, end date, and reason are required.'
      });
    }

    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format provided.' });
    }

    if (startDateObj > endDateObj) {
      return res.status(400).json({ success: false, message: 'Start date cannot be after end date.' });
    }

    // Check for duplicate pending requests on overlapping dates
    const [existing] = await db.query(
      `SELECT id FROM leave_requests 
       WHERE student_id = ? AND status = 'Pending' AND start_date = ? AND end_date = ?`,
      [studentId, start_date, end_date]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A pending leave application for these identical dates already exists.'
      });
    }

    const [result] = await db.query(
      `INSERT INTO leave_requests (student_id, leave_type, start_date, end_date, reason, status)
       VALUES (?, ?, ?, ?, ?, 'Pending')`,
      [studentId, leave_type, start_date, end_date, reason]
    );

    return res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully and forwarded to your assigned mentor.',
      leaveId: result.insertId
    });
  } catch (err) {
    console.error('[applyLeave Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/leave/:id/decision (Mentor, HOD, Admin)
async function reviewLeaveDecision(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, remarks } = req.body;

    if (!status || !['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid decision status (Approved or Rejected) is required.'
      });
    }

    // Retrieve leave request
    const [leaveRows] = await db.query(
      `SELECT lr.*, st.department_id 
       FROM leave_requests lr 
       JOIN students st ON st.id = lr.student_id 
       WHERE lr.id = ?`,
      [id]
    );

    if (leaveRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Leave request not found.' });
    }

    const leave = leaveRows[0];

    // Enforce role isolation:
    // Mentors can only approve their assigned mentees
    if (req.user.role === 'faculty') {
      if (req.user.facultyRole === 'mentor') {
        const [assignment] = await db.query(
          "SELECT id FROM student_mentors WHERE student_id = ? AND faculty_id = ? AND status = 'active'",
          [leave.student_id, req.user.facultyId]
        );
        if (assignment.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: You are only authorised to review leave requests for your assigned mentees.'
          });
        }
      } else if (req.user.facultyRole === 'hod') {
        if (req.user.departmentId !== leave.department_id) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: You can only review leave requests for students within your department.'
          });
        }
      }
    }

    await db.query(
      `UPDATE leave_requests 
       SET status = ?, remarks = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW() 
       WHERE id = ?`,
      [status, remarks || null, req.user.id, id]
    );

    return res.status(200).json({
      success: true,
      message: `Leave request has been ${status.toLowerCase()} successfully.`
    });
  } catch (err) {
    console.error('[reviewLeaveDecision Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getStudentLeaves,
  getMentorMenteeLeaves,
  getDepartmentLeaves,
  getInstitutionLeaves,
  applyLeave,
  reviewLeaveDecision
};
