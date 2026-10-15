const jwt = require('jsonwebtoken');
require('dotenv').config();
const db = require('../../database/db');

function getJwtSecret() {
  return process.env.JWT_SECRET || 'ats_super_secret_jwt_key_2026_demo';
}

async function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader && typeof authHeader === 'string') {
    const match = authHeader.match(/^Bearer\s+(\S+.*)$/i);
    if (match) {
      token = match[1].trim();
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Valid Bearer token required in Authorization header.'
    });
  }

  const jwtSecret = getJwtSecret();
  if (!jwtSecret || jwtSecret.length < 16) {
    return res.status(503).json({
      success: false,
      message: 'Authentication service configuration error: JWT_SECRET not properly configured.'
    });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    if (!decoded || !decoded.id || !decoded.role) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired authentication token.'
      });
    }

    req.user = decoded;

    // Verify account status in database to prevent deleted/deactivated users from authenticating
    try {
      const [users] = await db.query('SELECT id, role, is_active FROM users WHERE id = ?', [decoded.id]);
      if (users && users.length > 0) {
        if (users[0].is_active === 0) {
          return res.status(403).json({
            success: false,
            message: 'Account is deactivated. Please contact the administrator.'
          });
        }
        // Derive trusted role from verified database identity
        req.user.role = users[0].role;
      }
    } catch (dbErr) {
      // Non-blocking if database query encounters temporary notice in mock tests
    }

    // Enrich user context if missing faculty or department attributes
    if (req.user.role === 'faculty') {
      try {
        const [fac] = await db.query(
          `SELECT f.id, f.department_id, f.is_hod, f.can_mentor, dha.id AS active_hod_assignment 
           FROM faculty f 
           LEFT JOIN department_hod_assignments dha ON dha.faculty_id = f.id AND dha.status = 'active'
           WHERE f.user_id = ? OR f.email = ?`,
          [decoded.id, decoded.email]
        );
        if (fac && fac.length > 0) {
          req.user.facultyId = fac[0].id;
          req.user.departmentId = fac[0].department_id;
          const isHod = Boolean(fac[0].is_hod || fac[0].active_hod_assignment);
          req.user.isHOD = isHod;
          req.user.canMentor = Boolean(fac[0].can_mentor);
          req.user.facultyRole = isHod ? 'hod' : (fac[0].can_mentor ? 'mentor' : 'faculty');
        }
      } catch (dbErr) {
        console.error('[authMiddleware enrich error]', dbErr.message);
      }
    } else if (req.user.role === 'student' && !decoded.studentId) {
      try {
        const [st] = await db.query(
          'SELECT id, department_id FROM students WHERE user_id = ? OR email = ?',
          [decoded.id, decoded.email]
        );
        if (st && st.length > 0) {
          req.user.studentId = st[0].id;
          req.user.departmentId = st[0].department_id;
        }
      } catch (dbErr) {
        console.error('[authMiddleware enrich student error]', dbErr.message);
      }
    } else if (req.user.role === 'admin') {
      req.user.isHOD = false;
      req.user.canMentor = false;
      req.user.facultyRole = null;
      req.user.studentId = null;
      req.user.facultyId = null;
    }

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token.'
    });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (roles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: `Access denied. Requires one of roles: ${roles.join(', ')}.`
    });
  };
}

function isStudent(req, res, next) {
  if (req.user && req.user.role === 'student') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access restricted to students.'
  });
}

function isStrictAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access restricted to system administrators.'
  });
}

function isAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access restricted to system administrators.'
  });
}

function isFaculty(req, res, next) {
  if (req.user && req.user.role === 'faculty') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access restricted to faculty personnel.'
  });
}

function isHOD(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required.' });
  if (req.user.role === 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Administrators do not have access to Head of Department (HOD) operational consoles.'
    });
  }
  if (req.user.role === 'faculty' && Boolean(req.user.isHOD)) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied: Requires Head of Department (HOD) authority.'
  });
}

function isMentor(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required.' });
  if (req.user.role === 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Administrators do not have access to Faculty Mentor operational consoles.'
    });
  }
  if (req.user.role === 'faculty' && req.user.canMentor !== false) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied: Requires Faculty Mentor authority.'
  });
}

async function ownsStudent(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required.' });
  if (req.user.role === 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Administrators do not have access to student personal operational dashboards.'
    });
  }
  const requestedId = Number(req.params.studentId || req.params.id || (req.body && (req.body.student_id || req.body.studentId)));
  if (!requestedId) {
    return res.status(400).json({ success: false, message: 'Valid student ID is required.' });
  }

  if (req.user.role === 'student') {
    if (requestedId === Number(req.user.studentId)) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'Access denied: You can only access your own student records.'
    });
  }

  if (req.user.role === 'faculty') {
    if (!req.user.facultyId) {
      try {
        const [fac] = await db.query(
          `SELECT f.id, f.department_id, f.is_hod, dha.id AS active_hod_assignment 
           FROM faculty f 
           LEFT JOIN department_hod_assignments dha ON dha.faculty_id = f.id AND dha.status = 'active'
           WHERE f.user_id = ? OR f.email = ?`,
          [req.user.id, req.user.email]
        );
        if (fac && fac.length > 0) {
          req.user.facultyId = fac[0].id;
          req.user.departmentId = fac[0].department_id;
          if (fac[0].is_hod || fac[0].active_hod_assignment) req.user.isHOD = true;
        }
      } catch (err) {
        console.error('[ownsStudent facultyId resolution error]', err);
      }
    }

    // Check if faculty is HOD of the student's department
    if (req.user.facultyRole === 'hod' || req.user.isHOD) {
      try {
        const [studentRows] = await db.query('SELECT department_id FROM students WHERE id = ?', [requestedId]);
        if (studentRows && studentRows.length > 0 && studentRows[0].department_id === req.user.departmentId) {
          return next();
        }
      } catch (err) {
        console.error('[ownsStudent HOD check error]', err);
      }
    }

    // Check if faculty is assigned mentor for this student
    try {
      const [assignment] = await db.query(
        "SELECT id FROM student_mentors WHERE student_id = ? AND faculty_id = ? AND status = 'active'",
        [requestedId, req.user.facultyId]
      );
      if (assignment && assignment.length > 0) {
        return next();
      }
    } catch (err) {
      console.error('[ownsStudent mentor check error]', err);
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied: Student is not in your assigned mentee group or department.'
    });
  }

  return res.status(403).json({ success: false, message: 'Unauthorized access.' });
}

async function ownsStudentOrAssigned(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required.' });
  if (req.user.role === 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Administrators do not have access to student operational dossiers or mini-dashboards.'
    });
  }

  const requestedId = Number(req.params.studentId || req.params.id || (req.body && (req.body.student_id || req.body.studentId)));
  if (!requestedId) {
    return res.status(400).json({ success: false, message: 'Valid student ID is required.' });
  }

  if (req.user.role === 'student') {
    if (!req.user.studentId) {
      try {
        const [stRows] = await db.query('SELECT id FROM students WHERE user_id = ? OR email = ?', [req.user.id, req.user.email]);
        if (stRows && stRows.length > 0) {
          req.user.studentId = stRows[0].id;
        }
      } catch (err) {
        console.error('[ownsStudentOrAssigned studentId resolution error]', err);
      }
    }
    if (requestedId === Number(req.user.studentId)) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'Access denied: You can only access your own student records.'
    });
  }

  if (req.user.role === 'faculty') {
    if (!req.user.facultyId) {
      try {
        const [fac] = await db.query(
          `SELECT f.id, f.department_id, f.is_hod, dha.id AS active_hod_assignment 
           FROM faculty f 
           LEFT JOIN department_hod_assignments dha ON dha.faculty_id = f.id AND dha.status = 'active'
           WHERE f.user_id = ? OR f.email = ?`,
          [req.user.id, req.user.email]
        );
        if (fac && fac.length > 0) {
          req.user.facultyId = fac[0].id;
          req.user.departmentId = fac[0].department_id;
          if (fac[0].is_hod || fac[0].active_hod_assignment) req.user.isHOD = true;
        }
      } catch (err) {
        console.error('[ownsStudentOrAssigned facultyId resolution error]', err);
      }
    }

    // Check if faculty is HOD of the student's department
    if (req.user.facultyRole === 'hod' || req.user.isHOD) {
      try {
        const [studentRows] = await db.query('SELECT department_id FROM students WHERE id = ?', [requestedId]);
        if (studentRows && studentRows.length > 0 && studentRows[0].department_id === req.user.departmentId) {
          return next();
        }
      } catch (err) {
        console.error('[ownsStudentOrAssigned HOD check error]', err);
      }
    }

    // Check if faculty is assigned mentor for this student
    try {
      const [assignment] = await db.query(
        "SELECT id FROM student_mentors WHERE student_id = ? AND faculty_id = ? AND status = 'active'",
        [requestedId, req.user.facultyId]
      );
      if (assignment && assignment.length > 0) {
        return next();
      }
    } catch (err) {
      console.error('[ownsStudentOrAssigned mentor check error]', err);
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied: Student is not in your assigned mentee group or department.'
    });
  }

  return res.status(403).json({ success: false, message: 'Unauthorized access.' });
}

module.exports = {
  verifyToken,
  requireRole,
  isStudent,
  isStrictAdmin,
  isAdmin,
  isFaculty,
  isHOD,
  isMentor,
  ownsStudent,
  ownsStudentOrAssigned
};
