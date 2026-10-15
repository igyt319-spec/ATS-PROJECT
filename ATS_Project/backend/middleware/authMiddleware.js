const jwt = require('jsonwebtoken');
require('dotenv').config();
const db = require('../../database/db');

const JWT_SECRET = process.env.JWT_SECRET;

async function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Valid Bearer token required in Authorization header.'
    });
  }

  try {
    if (!JWT_SECRET || JWT_SECRET.length < 16) throw new Error('JWT_SECRET is not configured');
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    // Enrich user context if missing faculty or department attributes
    if (decoded.role === 'faculty' && (!decoded.facultyId || decoded.departmentId === undefined)) {
      try {
        const [fac] = await db.query(
          `SELECT f.id, f.department_id, f.is_hod, f.can_mentor, dha.id AS active_hod_assignment 
           FROM faculty f 
           LEFT JOIN department_hod_assignments dha ON dha.faculty_id = f.id AND dha.status = 'active'
           WHERE f.user_id = ? OR f.email = ?`,
          [decoded.id, decoded.email]
        );
        if (fac.length > 0) {
          req.user.facultyId = fac[0].id;
          req.user.departmentId = fac[0].department_id;
          const isHod = Boolean(fac[0].is_hod || fac[0].active_hod_assignment);
          req.user.isHOD = isHod;
          req.user.canMentor = Boolean(fac[0].can_mentor);
          if (isHod) req.user.facultyRole = 'hod';
          else if (fac[0].can_mentor) req.user.facultyRole = 'mentor';
        }
      } catch (dbErr) {
        console.error('[authMiddleware enrich error]', dbErr.message);
      }
    }

    if (decoded.role === 'student' && !decoded.studentId) {
      try {
        const [st] = await db.query(
          'SELECT id, department_id FROM students WHERE user_id = ? OR email = ?',
          [decoded.id, decoded.email]
        );
        if (st.length > 0) {
          req.user.studentId = st[0].id;
          req.user.departmentId = st[0].department_id;
        }
      } catch (dbErr) {
        console.error('[authMiddleware enrich student error]', dbErr.message);
      }
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
  if (req.user && (req.user.role === 'admin' || req.user.role === 'faculty')) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access restricted to faculty and administrative personnel.'
  });
}

function isHOD(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required.' });
  if (req.user.role === 'admin') return next();
  if (req.user.role === 'faculty' && Boolean(req.user.isHOD)) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied: Requires Head of Department (HOD) or Admin authority.'
  });
}

function isMentor(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required.' });
  if (req.user.role === 'admin') return next();
  if (req.user.role === 'faculty') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied: Requires Faculty Mentor or Admin authority.'
  });
}

function ownsStudent(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required.' });
  if (req.user.role === 'admin') return next();
  const requestedId = Number(req.params.studentId || req.params.id || (req.body && req.body.student_id));
  if (req.user.role === 'student') {
    if (requestedId && requestedId === Number(req.user.studentId)) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: 'Access denied: You can only access your own student records.'
    });
  }
  return next();
}

async function ownsStudentOrAssigned(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required.' });
  if (req.user.role === 'admin') return next();

  const requestedId = Number(req.params.studentId || req.params.id || (req.body && req.body.student_id));
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
    // If facultyId is missing, resolve it from database
    if (!req.user.facultyId) {
      try {
        const [fac] = await db.query(
          `SELECT f.id, f.department_id, f.is_hod, dha.id AS active_hod_assignment 
           FROM faculty f 
           LEFT JOIN department_hod_assignments dha ON dha.faculty_id = f.id AND dha.status = 'active'
           WHERE f.user_id = ? OR f.email = ?`,
          [req.user.id, req.user.email]
        );
        if (fac.length > 0) {
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
        if (studentRows.length > 0 && studentRows[0].department_id === req.user.departmentId) {
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
      if (assignment.length > 0) {
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
  isHOD,
  isMentor,
  ownsStudent,
  ownsStudentOrAssigned
};
