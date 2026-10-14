const db = require('../../database/db');

const VALID_CATEGORIES = [
  'Hackathons',
  'Technical competitions',
  'Paper presentations',
  'NPTEL courses and certifications',
  'IEEE membership',
  'External vendor training'
];

// GET /api/activities/student/:studentId
async function getStudentActivities(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);

    const [rows] = await db.query(
      `SELECT sa.*, 
              st.name AS student_name, st.register_number,
              u.name AS verified_by_name
       FROM student_activities sa
       JOIN students st ON st.id = sa.student_id
       LEFT JOIN users u ON u.id = sa.verified_by
       WHERE sa.student_id = ?
       ORDER BY sa.created_at DESC`,
      [studentId]
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    console.error('[getStudentActivities Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/activities/mentor/mentees
async function getMentorMenteeActivities(req, res) {
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
      `SELECT sa.*, 
              st.name AS student_name, st.register_number, st.year,
              d.name AS department_name,
              u.name AS verified_by_name
       FROM student_activities sa
       JOIN student_mentors sm ON sm.student_id = sa.student_id
       JOIN students st ON st.id = sa.student_id
       LEFT JOIN departments d ON d.id = st.department_id
       LEFT JOIN users u ON u.id = sa.verified_by
       ${filterQuery}
       ORDER BY sa.created_at DESC`,
      filterParams
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    console.error('[getMentorMenteeActivities Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/activities/department
async function getDepartmentActivities(req, res) {
  try {
    const departmentId = req.user.role === 'admin' && req.query.department_id
      ? parseInt(req.query.department_id, 10)
      : req.user.departmentId;

    if (!departmentId) {
      return res.status(400).json({ success: false, message: 'Department scope could not be determined.' });
    }

    const [rows] = await db.query(
      `SELECT sa.*, 
              st.name AS student_name, st.register_number, st.year,
              d.name AS department_name,
              u.name AS verified_by_name
       FROM student_activities sa
       JOIN students st ON st.id = sa.student_id
       JOIN departments d ON d.id = st.department_id
       LEFT JOIN users u ON u.id = sa.verified_by
       WHERE st.department_id = ?
       ORDER BY sa.created_at DESC`,
      [departmentId]
    );

    return res.status(200).json({
      success: true,
      departmentId,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    console.error('[getDepartmentActivities Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/activities/institution (Admin only)
async function getInstitutionActivities(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT sa.*, 
              st.name AS student_name, st.register_number, st.year,
              d.name AS department_name,
              u.name AS verified_by_name
       FROM student_activities sa
       JOIN students st ON st.id = sa.student_id
       JOIN departments d ON d.id = st.department_id
       LEFT JOIN users u ON u.id = sa.verified_by
       ORDER BY sa.created_at DESC`
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    console.error('[getInstitutionActivities Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/activities (Student submission)
async function submitActivity(req, res) {
  try {
    const studentId = req.user.role === 'student' ? req.user.studentId : parseInt(req.body.student_id, 10);
    const {
      category,
      title,
      description,
      organizing_institution,
      event_date,
      participation_level,
      certificate_url
    } = req.body;

    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Valid student ID is required.' });
    }

    if (!category || !title) {
      return res.status(400).json({ success: false, message: 'Activity category and title are required.' });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`
      });
    }

    // Check for exact duplicate submission
    const [existing] = await db.query(
      'SELECT id FROM student_activities WHERE student_id = ? AND category = ? AND title = ? AND event_date = ?',
      [studentId, category, title, event_date || null]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A duplicate activity submission with this title and event date already exists.'
      });
    }

    const [result] = await db.query(
      `INSERT INTO student_activities 
       (student_id, category, title, description, organizing_institution, event_date, participation_level, certificate_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [
        studentId,
        category,
        title,
        description || '',
        organizing_institution || 'Institution / Provider',
        event_date || null,
        participation_level || 'Participant',
        certificate_url || null
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Student activity submitted successfully and queued for mentor review.',
      activityId: result.insertId
    });
  } catch (err) {
    console.error('[submitActivity Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/activities/:id/verify (Mentor, HOD, Admin)
async function verifyActivity(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, remarks } = req.body;

    if (!status || !['Verified', 'Rejected', 'Pending'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid verification status (Verified, Rejected, Pending) is required.'
      });
    }

    // Check scope
    const [act] = await db.query(
      `SELECT sa.*, st.department_id 
       FROM student_activities sa 
       JOIN students st ON st.id = sa.student_id 
       WHERE sa.id = ?`,
      [id]
    );

    if (act.length === 0) {
      return res.status(404).json({ success: false, message: 'Activity record not found.' });
    }

    const activity = act[0];

    // Check mentor or HOD scope
    if (req.user.role === 'faculty') {
      if (req.user.facultyRole === 'mentor') {
        const [assignment] = await db.query(
          "SELECT id FROM student_mentors WHERE student_id = ? AND faculty_id = ? AND status = 'active'",
          [activity.student_id, req.user.facultyId]
        );
        if (assignment.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: You can only verify activities for your assigned mentees.'
          });
        }
      } else if (req.user.facultyRole === 'hod') {
        if (req.user.departmentId !== activity.department_id) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: You can only verify activities for students in your department.'
          });
        }
      }
    }

    await db.query(
      `UPDATE student_activities 
       SET status = ?, mentor_remarks = ?, verified_by = ?, verified_at = NOW(), updated_at = NOW() 
       WHERE id = ?`,
      [status, remarks || null, req.user.id, id]
    );

    return res.status(200).json({
      success: true,
      message: `Activity marked as ${status} successfully.`
    });
  } catch (err) {
    console.error('[verifyActivity Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getStudentActivities,
  getMentorMenteeActivities,
  getDepartmentActivities,
  getInstitutionActivities,
  submitActivity,
  verifyActivity
};
