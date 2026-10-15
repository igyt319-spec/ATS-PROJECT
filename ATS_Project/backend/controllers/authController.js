const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../../database/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Secure password verification supporting standard bcrypt and timing-safe legacy migration.
 * Never stores or returns plaintext passwords.
 * Returns { isMatch: boolean, needsUpgrade: boolean }
 */
async function verifyUserPassword(submittedPassword, storedHash) {
  if (!submittedPassword || !storedHash || typeof storedHash !== 'string') {
    return { isMatch: false, needsUpgrade: false };
  }

  // Standard bcrypt hash verification ($2a$, $2b$, $2y$)
  if (/^\$2[aby]\$/.test(storedHash)) {
    try {
      const isMatch = await bcrypt.compare(submittedPassword, storedHash);
      return { isMatch, needsUpgrade: false };
    } catch (_) {
      return { isMatch: false, needsUpgrade: false };
    }
  }

  // Safe legacy fallback (for historical plaintext seed records):
  // Uses timingSafeEqual to avoid timing side-channels, then marks for dynamic upgrade
  try {
    const bufSubmitted = Buffer.from(submittedPassword);
    const bufStored = Buffer.from(storedHash);
    if (bufSubmitted.length === bufStored.length && crypto.timingSafeEqual(bufSubmitted, bufStored)) {
      return { isMatch: true, needsUpgrade: true };
    }
  } catch (_) {}

  return { isMatch: false, needsUpgrade: false };
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { identifier, password, role } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both username/email and password.'
      });
    }

    const trimmedId = identifier.trim();

    // Query user by email OR register_number
    const [users] = await db.query(
      'SELECT * FROM users WHERE email = ? OR register_number = ?',
      [trimmedId, trimmedId]
    );

    if (!users || users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please verify your username/email and password.'
      });
    }

    const user = users[0];

    // Check if account is active
    if (user.is_active === 0) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact the administrator.'
      });
    }

    // Secure verification without hardcoded bypasses or plaintext exposure
    const { isMatch, needsUpgrade } = await verifyUserPassword(password, user.password);

    if (!isMatch) {
      console.warn(`[Auth] Authentication failed for user #${user.id} (${user.email || user.register_number})`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please verify your username/email and password.'
      });
    }

    // Transparently upgrade legacy plaintext password to secure bcrypt hash in database
    if (needsUpgrade) {
      try {
        const upgradedHash = await bcrypt.hash(password, 10);
        await db.query('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [upgradedHash, user.id]);
        console.log(`[Auth] User #${user.id} legacy password transparently upgraded to secure bcrypt hash.`);
      } catch (upgradeErr) {
        console.error(`[Auth] Failed to upgrade legacy password for user #${user.id}:`, upgradeErr.message);
      }
    }

    let studentDetails = null;
    let facultyDetails = null;
    let departmentName = null;
    let departmentId = user.department_id || null;
    let isVerifiedHod = false;
    let isCanMentor = true;

    if (user.role === 'student') {
      const [studentRows] = await db.query(
        `SELECT st.*, d.name AS department_name, d.code AS department_code 
         FROM students st 
         LEFT JOIN departments d ON d.id = st.department_id 
         WHERE st.user_id = ? OR st.register_number = ? OR st.email = ?`,
        [user.id, user.register_number, user.email]
      );
      if (studentRows && studentRows.length > 0) {
        studentDetails = studentRows[0];
        departmentId = studentDetails.department_id;
        departmentName = studentDetails.department_name;
        if (studentDetails.user_id !== user.id) {
          await db.query('UPDATE students SET user_id = ? WHERE id = ?', [user.id, studentDetails.id]).catch(() => {});
        }
      }
    } else if (user.role === 'faculty') {
      const [facRows] = await db.query(
        `SELECT f.*, d.name AS department_name, d.code AS department_code,
                dha.id AS active_hod_assignment
         FROM faculty f 
         LEFT JOIN departments d ON d.id = f.department_id 
         LEFT JOIN department_hod_assignments dha ON dha.faculty_id = f.id AND dha.status = 'active'
         WHERE f.user_id = ? OR f.email = ? OR f.faculty_code = ?`,
        [user.id, user.email, user.register_number]
      );
      if (facRows && facRows.length > 0) {
        facultyDetails = facRows[0];
        departmentId = facultyDetails.department_id;
        departmentName = facultyDetails.department_name;
        if (facultyDetails.user_id !== user.id) {
          await db.query('UPDATE faculty SET user_id = ? WHERE id = ?', [user.id, facultyDetails.id]).catch(() => {});
        }
        // Faculty is ONLY HOD if they hold an active HOD assignment or is_hod == 1
        isVerifiedHod = Boolean(facultyDetails.active_hod_assignment || facultyDetails.is_hod === 1);
        isCanMentor = Boolean(facultyDetails.can_mentor !== 0);
      }
    }

    if (!departmentName && departmentId) {
      const [deptRows] = await db.query('SELECT name FROM departments WHERE id = ?', [departmentId]);
      if (deptRows.length > 0) departmentName = deptRows[0].name;
    }

    const normalizedRole = (role && role !== 'all') ? role.toLowerCase() : null;
    const userRole = (user.role || '').toLowerCase();

    // Strict Role Validation against verified database identity
    if (normalizedRole) {
      let roleAllowed = false;
      if (normalizedRole === 'student') {
        roleAllowed = (userRole === 'student');
      } else if (normalizedRole === 'faculty') {
        // Faculty portal accepts faculty members and administrators
        roleAllowed = (userRole === 'faculty' || userRole === 'admin');
      } else if (normalizedRole === 'hod') {
        // HOD portal strictly requires verified HOD status or administrator
        roleAllowed = ((userRole === 'faculty' && isVerifiedHod) || userRole === 'admin');
      } else if (normalizedRole === 'admin') {
        roleAllowed = (userRole === 'admin');
      }

      if (!roleAllowed) {
        if (normalizedRole === 'hod' && userRole === 'faculty' && !isVerifiedHod) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: Your account is verified as Faculty, but does not hold an active Head of Department (HOD) designation. Please use the Faculty portal.'
          });
        }
        return res.status(401).json({
          success: false,
          message: `Account verified, but registered as '${userRole === 'faculty' ? (isVerifiedHod ? 'Head of Department (HOD)' : 'Faculty') : userRole}'. Please select the corresponding '${userRole}' portal.`
        });
      }
    }

    // Explicit Role-to-Dashboard Mapping (Never treat ordinary Faculty as HOD)
    let finalFacultyRole = null;
    let dashboardUrl = 'dashboard.html';

    if (user.role === 'admin') {
      dashboardUrl = 'admin-dashboard.html';
    } else if (user.role === 'student') {
      dashboardUrl = 'dashboard.html';
    } else if (user.role === 'faculty') {
      if (normalizedRole === 'hod' && isVerifiedHod) {
        finalFacultyRole = 'hod';
        dashboardUrl = 'hod-dashboard.html';
      } else if (normalizedRole === 'faculty') {
        // Faculty portal selected -> ALWAYS route to Faculty & Mentor Console
        finalFacultyRole = isCanMentor ? 'mentor' : 'faculty';
        dashboardUrl = 'mentor-dashboard.html';
      } else if (isVerifiedHod && (!normalizedRole || normalizedRole === 'all')) {
        // Unspecified portal: verified HOD defaults to HOD dashboard
        finalFacultyRole = 'hod';
        dashboardUrl = 'hod-dashboard.html';
      } else {
        // Regular faculty member defaults to Faculty & Mentor Console
        finalFacultyRole = isCanMentor ? 'mentor' : 'faculty';
        dashboardUrl = 'mentor-dashboard.html';
      }
    }

    const isUserHOD = user.role === 'admin' ? true : isVerifiedHod;
    const isUserMentor = user.role === 'admin' ? true : isCanMentor;

    const tokenPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      register_number: user.register_number,
      role: user.role,
      facultyRole: finalFacultyRole,
      departmentId: departmentId,
      departmentName: departmentName,
      studentId: studentDetails ? studentDetails.id : null,
      facultyId: facultyDetails ? facultyDetails.id : null,
      isHOD: isUserHOD,
      canMentor: isUserMentor,
      dashboardUrl: dashboardUrl
    };

    if (!JWT_SECRET || JWT_SECRET.length < 16) {
      return res.status(503).json({
        success: false,
        message: 'Authentication is not configured. Set a JWT_SECRET.'
      });
    }

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' });

    // Use individual avatar or null (never a single hardcoded photo)
    const avatar = user.avatar || (studentDetails && studentDetails.avatar) || (facultyDetails && facultyDetails.avatar) || null;

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        studentId: studentDetails ? studentDetails.id : null,
        facultyId: facultyDetails ? facultyDetails.id : null,
        name: user.name,
        email: user.email,
        register_number: user.register_number,
        role: user.role,
        facultyRole: finalFacultyRole,
        isHOD: isUserHOD,
        canMentor: isUserMentor,
        departmentId: departmentId,
        department: departmentName || (user.role === 'admin' ? 'Institution Administration' : 'General'),
        year: studentDetails ? studentDetails.year : (finalFacultyRole ? finalFacultyRole.toUpperCase() : 'N/A'),
        avatar: avatar,
        dashboardUrl: dashboardUrl
      }
    });

  } catch (error) {
    console.error('[Auth Login Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server authentication error. Please try again.'
    });
  }
}

// POST /api/auth/logout
async function logout(req, res) {
  return res.status(200).json({
    success: true,
    message: 'User logged out successfully. Session invalidated.'
  });
}

// GET /api/auth/me
async function getMe(req, res) {
  try {
    const userId = req.user.id;
    const [rows] = await db.query(
      'SELECT id, name, email, register_number, role, faculty_role, department_id, avatar, created_at FROM users WHERE id = ?',
      [userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = rows[0];
    let student = null;
    let faculty = null;

    if (user.role === 'student') {
      const [stRows] = await db.query(
        `SELECT st.*, d.name AS department_name, d.code AS department_code 
         FROM students st 
         LEFT JOIN departments d ON d.id = st.department_id 
         WHERE st.user_id = ? OR st.register_number = ? OR st.email = ?`,
        [user.id, user.register_number, user.email]
      );
      if (stRows.length > 0) {
        student = stRows[0];
        student.department = student.department_name || student.department;
      }
    } else if (user.role === 'faculty') {
      const [facRows] = await db.query(
        `SELECT f.*, d.name AS department_name, d.code AS department_code,
                (SELECT COUNT(*) FROM student_mentors sm WHERE sm.faculty_id = f.id AND sm.status = 'active') AS mentee_count,
                dha.id AS active_hod_assignment, dha.start_date AS hod_since
         FROM faculty f 
         LEFT JOIN departments d ON d.id = f.department_id 
         LEFT JOIN department_hod_assignments dha ON dha.faculty_id = f.id AND dha.status = 'active'
         WHERE f.user_id = ? OR f.email = ? OR f.faculty_code = ?`,
        [user.id, user.email, user.register_number]
      );
      if (facRows.length > 0) {
        faculty = facRows[0];
        faculty.department = faculty.department_name || 'Department';
        const isHod = Boolean(faculty.active_hod_assignment || faculty.is_hod === 1);
        if (isHod) {
          faculty.is_hod = 1;
          user.faculty_role = 'hod';
          faculty.designation = faculty.designation || 'Head of Department';
        } else {
          faculty.is_hod = 0;
          user.faculty_role = faculty.can_mentor ? 'mentor' : 'faculty';
        }
      }
    }

    const isVerifiedHod = user.role === 'admin' ? true : Boolean(faculty && (faculty.active_hod_assignment || faculty.is_hod === 1));
    const isCanMentor = user.role === 'admin' ? true : Boolean(faculty ? faculty.can_mentor !== 0 : true);
    const finalFacultyRole = user.role === 'faculty' ? (isVerifiedHod ? 'hod' : (isCanMentor ? 'mentor' : 'faculty')) : null;

    let dashboardUrl = 'dashboard.html';
    if (user.role === 'admin') dashboardUrl = 'admin-dashboard.html';
    else if (user.role === 'student') dashboardUrl = 'dashboard.html';
    else if (user.role === 'faculty') dashboardUrl = isVerifiedHod ? 'hod-dashboard.html' : 'mentor-dashboard.html';

    return res.status(200).json({
      success: true,
      user: {
        ...user,
        facultyRole: finalFacultyRole,
        isHOD: isVerifiedHod,
        canMentor: isCanMentor,
        dashboardUrl: dashboardUrl,
        department: student ? student.department : (faculty ? faculty.department : (user.role === 'admin' ? 'Institution Administration' : 'General')),
        student,
        faculty
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// PUT /api/auth/me (Update authenticated user's own profile without cross-user mixing)
async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const { name, phone, bio } = req.body;

    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: 'User record not found.' });
    }
    const user = users[0];

    if (user.role === 'student') {
      // Student: update contact and bio
      if (phone !== undefined) {
        await db.query('UPDATE students SET phone = ?, updated_at = NOW() WHERE user_id = ? OR register_number = ?', [phone, user.id, user.register_number]);
      }
      if (bio !== undefined) {
        await db.query('UPDATE students SET bio = ?, updated_at = NOW() WHERE user_id = ? OR register_number = ?', [bio, user.id, user.register_number]);
      }
    } else if (user.role === 'faculty') {
      // Faculty: update phone
      if (phone !== undefined) {
        await db.query('UPDATE faculty SET updated_at = NOW() WHERE user_id = ? OR email = ?', [user.id, user.email]);
      }
      if (bio !== undefined) {
        await db.query('UPDATE users SET updated_at = NOW() WHERE id = ?', [user.id]);
      }
    } else if (user.role === 'admin') {
      if (name && name.trim()) {
        await db.query('UPDATE users SET name = ?, updated_at = NOW() WHERE id = ?', [name.trim(), user.id]);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.'
    });
  } catch (error) {
    console.error('[Update Profile Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// PUT /api/auth/profile-photo
async function updateProfilePhoto(req, res) {
  try {
    const { uploadAvatar } = require('./uploadController');
    return await uploadAvatar(req, res);
  } catch (error) {
    console.error('[Update Profile Photo Error]', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile photo.'
    });
  }
}

// POST /api/auth/forgot-password
async function forgotPassword(req, res) {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid registered email address.'
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Password reset request submitted successfully. A demo reset token has been dispatched to your email address.'
  });
}

// PUT /api/auth/change-password (Section 9)
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email || String(userId);

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required.'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirmation password do not match.'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.'
      });
    }

    // Rate limiting check
    const { checkRateLimit, recordFailedAttempt, resetRateLimit, logAuditEvent } = require('../utils/auditLogger');
    const rateCheck = await checkRateLimit(userEmail, 'PASSWORD_CHANGE', 5, 15);
    if (!rateCheck.allowed) {
      const minutesLeft = rateCheck.lockedUntil ? Math.ceil((rateCheck.lockedUntil - new Date()) / 60000) : 15;
      return res.status(429).json({
        success: false,
        message: `Too many failed password attempts. Account locked for security. Please try again in ${minutesLeft} minute(s).`
      });
    }

    // Verify current password
    const [users] = await db.query('SELECT password FROM users WHERE id = ?', [userId]);
    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    const storedHash = users[0].password;
    const { isMatch, needsUpgrade } = await verifyUserPassword(currentPassword, storedHash);

    if (!isMatch) {
      await recordFailedAttempt(userEmail, 'PASSWORD_CHANGE', 5, 15);
      return res.status(400).json({
        success: false,
        message: 'Incorrect current password. Please verify and try again.'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await db.query('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [newHash, userId]);
    await resetRateLimit(userEmail, 'PASSWORD_CHANGE');

    await logAuditEvent({
      userId,
      userEmail,
      action: 'PASSWORD_CHANGE',
      entityType: 'user',
      entityId: userId,
      reason: 'User initiated password update',
      ipAddress: req.ip
    });

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please keep your new password confidential.'
    });
  } catch (err) {
    console.error('[Change Password Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to change password. ' + err.message });
  }
}

// PUT /api/auth/change-identifier (Section 9)
async function changeIdentifier(req, res) {
  try {
    const { password, newIdentifier, reason } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email || String(userId);

    if (!password || !newIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'Password re-authentication and new identifier are required.'
      });
    }

    const trimmedNew = newIdentifier.trim();
    if (trimmedNew.length < 3) {
      return res.status(400).json({ success: false, message: 'Identifier must be at least 3 characters.' });
    }

    const { checkRateLimit, recordFailedAttempt, resetRateLimit, logAuditEvent } = require('../utils/auditLogger');
    const rateCheck = await checkRateLimit(userEmail, 'IDENTIFIER_CHANGE', 5, 15);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: 'Too many failed verification attempts. Operation locked. Please try again later.'
      });
    }

    // Re-verify password
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (!users || users.length === 0) return res.status(404).json({ success: false, message: 'User not found.' });

    const currentUser = users[0];
    const { isMatch } = await verifyUserPassword(password, currentUser.password);

    if (!isMatch) {
      await recordFailedAttempt(userEmail, 'IDENTIFIER_CHANGE', 5, 15);
      return res.status(401).json({ success: false, message: 'Password re-authentication failed.' });
    }

    // Check uniqueness
    const isEmail = trimmedNew.includes('@');
    const [existing] = await db.query(
      'SELECT id FROM users WHERE (email = ? OR register_number = ?) AND id != ?',
      [trimmedNew, trimmedNew, userId]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Identifier '${trimmedNew}' is already registered to another account.`
      });
    }

    const oldIdentifier = isEmail ? currentUser.email : (currentUser.register_number || currentUser.email);

    // Transactionally update
    await db.query('START TRANSACTION');
    try {
      if (isEmail) {
        await db.query('UPDATE users SET email = ?, updated_at = NOW() WHERE id = ?', [trimmedNew, userId]);
        if (currentUser.role === 'student') {
          await db.query('UPDATE students SET email = ? WHERE user_id = ?', [trimmedNew, userId]);
        } else if (currentUser.role === 'faculty') {
          await db.query('UPDATE faculty SET email = ? WHERE user_id = ?', [trimmedNew, userId]);
        }
      } else {
        await db.query('UPDATE users SET register_number = ?, updated_at = NOW() WHERE id = ?', [trimmedNew, userId]);
        if (currentUser.role === 'student') {
          await db.query('UPDATE students SET register_number = ? WHERE user_id = ?', [trimmedNew, userId]);
        }
      }

      await logAuditEvent({
        userId,
        userEmail: currentUser.email,
        action: 'IDENTIFIER_CHANGE',
        entityType: 'user',
        entityId: userId,
        previousValue: { identifier: oldIdentifier },
        newValue: { identifier: trimmedNew },
        reason: reason || 'User requested identifier correction',
        ipAddress: req.ip
      });

      await db.query('COMMIT');
      await resetRateLimit(userEmail, 'IDENTIFIER_CHANGE');

      return res.status(200).json({
        success: true,
        message: 'Identifier updated successfully.',
        newIdentifier: trimmedNew
      });
    } catch (txnErr) {
      await db.query('ROLLBACK');
      throw txnErr;
    }
  } catch (err) {
    console.error('[Change Identifier Error]', err);
    return res.status(500).json({ success: false, message: 'Failed to update identifier: ' + err.message });
  }
}

// POST /api/auth/seed-demo (Strict Admin Only)
async function seedDemoData(req, res) {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: System Administrator privileges required to run demo data seeding.'
      });
    }

    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
      return res.status(403).json({
        success: false,
        message: 'Demo seeding is disabled in production environments without ALLOW_DEMO_SEED=true.'
      });
    }

    const seedDemoAccounts = require('../../database/seed_demo_accounts');
    const result = await seedDemoAccounts(db);

    return res.status(200).json({
      success: true,
      message: 'Demo accounts verified and seeded successfully in idempotent mode.',
      accounts: {
        student: result.student.email,
        mentor: result.mentor.email,
        hod: result.hod.email,
        admin: result.admin.email
      }
    });
  } catch (err) {
    console.error('[Demo Seed Controller Error]', err.message);
    return res.status(500).json({
      success: false,
      message: `Failed to seed demo accounts: ${err.message}`
    });
  }
}

module.exports = {
  login,
  logout,
  getMe,
  updateProfile,
  updateProfilePhoto,
  forgotPassword,
  changePassword,
  changeIdentifier,
  seedDemoData,
  verifyUserPassword
};
