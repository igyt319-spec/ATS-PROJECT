const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.'
    });
  }

  try {
    if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error('JWT_SECRET is not configured');
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired authentication token.'
    });
  }
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

function isAdmin(req, res, next) {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'faculty')) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access restricted to faculty and administrative personnel.'
  });
}

function ownsStudent(req, res, next) {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'faculty')) return next();
  const requestedId = Number(req.params.studentId || req.params.id || req.body.student_id);
  if (req.user && req.user.role === 'student' && requestedId === Number(req.user.studentId)) return next();
  return res.status(403).json({ success: false, message: 'You can only access your own academic records.' });
}

module.exports = {
  verifyToken,
  isStudent,
  isAdmin,
  ownsStudent
};
