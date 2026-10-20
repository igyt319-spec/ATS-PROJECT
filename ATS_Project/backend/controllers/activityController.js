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

// GET /api/activities/institution (Faculty/Leadership only)
async function getInstitutionActivities(req, res) {
  try {
    if (!req.user || req.user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Administrators do not have access to student activity management.'
      });
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

// PUT /api/activities/:id/verify (Mentor, HOD)
async function verifyActivity(req, res) {
  try {
    if (!req.user || req.user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Administrators do not manage or verify operational student activities.'
      });
    }

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

    // If verified, synchronize to achievements table and dispatch notification
    if (status === 'Verified') {
      try {
        const [existingAch] = await db.query(
          'SELECT id FROM achievements WHERE student_id = ? AND title = ?',
          [activity.student_id, activity.title]
        );
        function mapToAchCat(c) {
          if (!c) return 'Technical Competition';
          const s = String(c).toLowerCase().trim();
          if (s.includes('hackathon')) return 'Hackathon';
          if (s.includes('paper')) return 'Paper Presentation';
          if (s.includes('competition') || s.includes('contest') || s.includes('hack')) return 'Technical Competition';
          if (s.includes('workshop') || s.includes('seminar') || s.includes('webinar')) return 'Workshop';
          if (s.includes('sport') || s.includes('athletic')) return 'Sports';
          if (s.includes('nptel') || s.includes('cert') || s.includes('course') || s.includes('ieee') || s.includes('training')) return 'Certification';
          return 'Technical Competition';
        }

        if (existingAch.length === 0) {
          await db.query(
            `INSERT INTO achievements (student_id, title, category, achievement_date, description, certificate_url, status)
             VALUES (?, ?, ?, COALESCE(?, CURDATE()), ?, ?, 'Verified')`,
            [
              activity.student_id,
              activity.title,
              mapToAchCat(activity.category),
              activity.event_date,
              activity.description || 'Verified student co-curricular contribution',
              activity.certificate_url || '',
            ]
          );
        }

        // Generate verification token if not present
        const crypto = require('crypto');
        const token = crypto.randomBytes(16).toString('hex');
        await db.query(
          'UPDATE student_activities SET verification_token = COALESCE(verification_token, ?) WHERE id = ?',
          [token, id]
        );

        await db.query(
          `INSERT INTO notifications (student_id, type, title, message)
           VALUES (?, 'achievement', 'Activity Verified', ?)`,
          [activity.student_id, `Your activity "${activity.title}" (${activity.category}) has been verified by your mentor.`]
        );
      } catch (syncErr) {
        console.error('[Activity-Achievement Sync Notice]', syncErr.message);
      }
    } else if (status === 'Rejected') {
      try {
        await db.query(
          `INSERT INTO notifications (student_id, type, title, message)
           VALUES (?, 'achievement', 'Activity Review Update', ?)`,
          [activity.student_id, `Your activity submission "${activity.title}" was reviewed: ${remarks || 'Revision requested by mentor'}.`]
        );
      } catch (notifErr) {
        console.error('[Activity Rejection Notif Error]', notifErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Activity marked as ${status} successfully.`
    });
  } catch (err) {
    console.error('[verifyActivity Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/activities/passport/:studentId (Feature 3: Verified Achievement Passport Portfolio)
async function getAchievementPassport(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const crypto = require('crypto');

    // 1. Fetch student basics
    const [students] = await db.query(
      `SELECT st.id, st.name, st.register_number, st.year, st.semester, st.avatar,
              d.name AS department_name, p.name AS program_name,
              c.name AS college_name
       FROM students st
       LEFT JOIN departments d ON d.id = st.department_id
       LEFT JOIN programs p ON p.id = st.program_id
       LEFT JOIN colleges c ON c.id = d.college_id
       WHERE st.id = ?`,
      [studentId]
    );

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    const student = students[0];

    // 2. Fetch all verified activities
    const [activities] = await db.query(
      `SELECT sa.*, u.name AS verified_by_name, u.role AS verified_by_role
       FROM student_activities sa
       LEFT JOIN users u ON u.id = sa.verified_by
       WHERE sa.student_id = ? AND sa.status = 'Verified'
       ORDER BY sa.event_date DESC`,
      [studentId]
    );

    // Ensure all verified activities have verification tokens
    for (const act of activities) {
      if (!act.verification_token) {
        const token = crypto.randomBytes(16).toString('hex');
        act.verification_token = token;
        await db.query('UPDATE student_activities SET verification_token = ? WHERE id = ?', [token, act.id]);
      }
    }

    // 3. Category Breakdown
    const categoryStats = {};
    activities.forEach(a => {
      categoryStats[a.category] = (categoryStats[a.category] || 0) + 1;
    });

    const passportData = {
      student: {
        id: student.id,
        name: student.name,
        registerNumber: student.register_number,
        department: student.department_name,
        program: student.program_name,
        year: student.year,
        semester: student.semester,
        institution: student.college_name || 'Autonomous Engineering College',
        avatar: student.avatar
      },
      summary: {
        totalVerifiedAchievements: activities.length,
        categoriesRepresented: Object.keys(categoryStats).length,
        categoryBreakdown: categoryStats,
        passportIssuedDate: new Date().toISOString()
      },
      verifiedAchievements: activities.map(a => ({
        id: a.id,
        title: a.title,
        category: a.category,
        description: a.description,
        organizingInstitution: a.organizing_institution,
        eventDate: a.event_date,
        participationLevel: a.participation_level,
        certificateUrl: a.certificate_url,
        verifiedByName: a.verified_by_name || 'Department Faculty Advisor',
        verifiedAt: a.verified_at,
        verificationToken: a.verification_token,
        verificationUrl: `/verify-passport.html?token=${a.verification_token}`
      }))
    };

    return res.status(200).json({
      success: true,
      passport: passportData
    });

  } catch (error) {
    console.error('[Get Achievement Passport Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/activities/passport/verify/:token (Feature 3: Public QR Verification)
// Strictly exposes only public non-sensitive verification facts (NO student ID, NO phone/email, NO marks)
async function verifyPublicPassport(req, res) {
  try {
    const token = (req.params.token || '').trim();

    if (!token || token.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'A valid verification token is required.'
      });
    }

    const [rows] = await db.query(
      `SELECT sa.id, sa.title, sa.category, sa.description, sa.organizing_institution,
              sa.event_date, sa.participation_level, sa.verified_at, sa.status, sa.verification_token,
              st.name AS student_full_name,
              d.name AS department_name,
              c.name AS college_name,
              u.name AS verified_by_name
       FROM student_activities sa
       JOIN students st ON st.id = sa.student_id
       LEFT JOIN departments d ON d.id = st.department_id
       LEFT JOIN colleges c ON c.id = d.college_id
       LEFT JOIN users u ON u.id = sa.verified_by
       WHERE sa.verification_token = ? AND sa.status = 'Verified'`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        verified: false,
        message: 'No verified achievement certificate matches this verification code. The certificate may be invalid, unapproved, or revoked.'
      });
    }

    const record = rows[0];

    // Privacy mask: Show First name and Last initial only (e.g., "Kavitha M.")
    const nameParts = (record.student_full_name || 'Student').trim().split(/\s+/);
    const maskedName = nameParts.length > 1 
      ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
      : nameParts[0];

    return res.status(200).json({
      success: true,
      verified: true,
      verificationNotice: 'OFFICIAL ATS INTEGRITY RECORD — VERIFIED BY INSTITUTIONAL MENTOR',
      data: {
        achievementTitle: record.title,
        category: record.category,
        organizingInstitution: record.organizing_institution,
        eventDate: record.event_date,
        participationLevel: record.participation_level || 'Participant',
        recipientDisplayName: maskedName,
        academicDepartment: record.department_name,
        institutionName: record.college_name || 'Autonomous Engineering College',
        verificationTimestamp: record.verified_at,
        verifyingAuthority: 'Faculty Mentor & Academic Advisory Board',
        verificationCode: record.verification_token
      }
    });

  } catch (error) {
    console.error('[Verify Public Passport Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getStudentActivities,
  getMentorMenteeActivities,
  getDepartmentActivities,
  getInstitutionActivities,
  submitActivity,
  verifyActivity,
  getAchievementPassport,
  verifyPublicPassport
};

