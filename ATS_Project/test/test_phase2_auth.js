const jwt = require('jsonwebtoken');
const {
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
} = require('../backend/middleware/authMiddleware');

// Mock response object
function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

async function runPhase2Tests() {
  console.log('===============================================================');
  console.log('=== PHASE 2 REGRESSION TEST SUITE: AUTHENTICATION & STRICT RBAC');
  console.log('===============================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(testName, condition, extra = '') {
    if (condition) {
      passedCount++;
      console.log(`✅ PASS: ${testName} ${extra ? '(' + extra + ')' : ''}`);
    } else {
      failedCount++;
      console.error(`❌ FAIL: ${testName} ${extra ? '(' + extra + ')' : ''}`);
    }
  }

  // -------------------------------------------------------------
  // Test 1: Role-to-Dashboard Mapping Logic
  // -------------------------------------------------------------
  console.log('--- Test Group 1: Explicit Role-to-Dashboard Mapping ---');
  
  // Client mapping function replicated from login.js
  function getRoleRedirect(user) {
    if (!user) return 'login.html';
    if (user.dashboardUrl) return user.dashboardUrl;
    if (user.role === 'admin') return 'admin-dashboard.html';
    if (user.role === 'student') return 'dashboard.html';
    if (user.role === 'faculty') {
      if (user.facultyRole === 'hod' && Boolean(user.isHOD)) return 'hod-dashboard.html';
      return 'mentor-dashboard.html';
    }
    return 'dashboard.html';
  }

  const studentUser = { id: 1, role: 'student', studentId: 1, dashboardUrl: 'dashboard.html' };
  const facultyUser = { id: 2, role: 'faculty', facultyId: 10, isHOD: false, facultyRole: 'mentor', dashboardUrl: 'mentor-dashboard.html' };
  const hodUser = { id: 3, role: 'faculty', facultyId: 11, isHOD: true, facultyRole: 'hod', dashboardUrl: 'hod-dashboard.html' };
  const adminUser = { id: 4, role: 'admin', dashboardUrl: 'admin-dashboard.html' };

  assert('1.1 Student maps strictly to student dashboard', getRoleRedirect(studentUser) === 'dashboard.html');
  assert('1.2 Ordinary Faculty maps strictly to Faculty & Mentor Console (never HOD)', getRoleRedirect(facultyUser) === 'mentor-dashboard.html');
  assert('1.3 Faculty does NOT open HOD dashboard', getRoleRedirect(facultyUser) !== 'hod-dashboard.html');
  assert('1.4 Verified HOD maps to HOD dashboard', getRoleRedirect(hodUser) === 'hod-dashboard.html');
  assert('1.5 Admin maps strictly to Institutional Admin dashboard', getRoleRedirect(adminUser) === 'admin-dashboard.html');

  // Fallback when dashboardUrl is missing from payload
  const facultyWithoutUrl = { id: 2, role: 'faculty', facultyId: 10, isHOD: false, facultyRole: 'faculty' };
  assert('1.6 Fallback: Faculty without dashboardUrl still opens mentor-dashboard.html', getRoleRedirect(facultyWithoutUrl) === 'mentor-dashboard.html');

  // -------------------------------------------------------------
  // Test 2: HOD Access Middleware (isHOD)
  // -------------------------------------------------------------
  console.log('\n--- Test Group 2: Head of Department (isHOD) Protection ---');

  // 2.1 Ordinary faculty must be rejected
  let reqFaculty = { user: { id: 2, role: 'faculty', isHOD: false, facultyRole: 'mentor' } };
  let resFaculty = createMockRes();
  let nextCalled = false;
  isHOD(reqFaculty, resFaculty, () => { nextCalled = true; });
  assert('2.1 Ordinary faculty is rejected by isHOD middleware (HTTP 403)', resFaculty.statusCode === 403 && !nextCalled);

  // 2.2 Verified HOD must be allowed
  let reqHOD = { user: { id: 3, role: 'faculty', isHOD: true, facultyRole: 'hod' } };
  let resHOD = createMockRes();
  nextCalled = false;
  isHOD(reqHOD, resHOD, () => { nextCalled = true; });
  assert('2.2 Verified HOD is permitted by isHOD middleware', nextCalled && resHOD.statusCode === 200);

  // 2.3 Student attempting HOD access must be rejected
  let reqStudent = { user: { id: 1, role: 'student', studentId: 1 } };
  let resStudent = createMockRes();
  nextCalled = false;
  isHOD(reqStudent, resStudent, () => { nextCalled = true; });
  assert('2.3 Student is rejected by isHOD middleware (HTTP 403)', resStudent.statusCode === 403 && !nextCalled);

  // 2.4 Unauthenticated request must be rejected with 401
  let reqUnauth = { user: null };
  let resUnauth = createMockRes();
  nextCalled = false;
  isHOD(reqUnauth, resUnauth, () => { nextCalled = true; });
  assert('2.4 Unauthenticated request rejected by isHOD (HTTP 401)', resUnauth.statusCode === 401 && !nextCalled);

  // -------------------------------------------------------------
  // Test 3: Faculty Mentor Access Middleware (isMentor)
  // -------------------------------------------------------------
  console.log('\n--- Test Group 3: Faculty Mentor (isMentor) Protection ---');

  // 3.1 Faculty must be allowed
  reqFaculty = { user: { id: 2, role: 'faculty', isHOD: false } };
  resFaculty = createMockRes();
  nextCalled = false;
  isMentor(reqFaculty, resFaculty, () => { nextCalled = true; });
  assert('3.1 Faculty is permitted by isMentor middleware', nextCalled);

  // 3.2 Student must be rejected
  reqStudent = { user: { id: 1, role: 'student' } };
  resStudent = createMockRes();
  nextCalled = false;
  isMentor(reqStudent, resStudent, () => { nextCalled = true; });
  assert('3.2 Student is rejected by isMentor middleware (HTTP 403)', resStudent.statusCode === 403 && !nextCalled);

  // -------------------------------------------------------------
  // Test 4: Strict Admin Protection (isStrictAdmin)
  // -------------------------------------------------------------
  console.log('\n--- Test Group 4: Strict Admin (isStrictAdmin) Protection ---');

  // 4.1 Admin allowed
  let reqAdmin = { user: { id: 4, role: 'admin' } };
  let resAdmin = createMockRes();
  nextCalled = false;
  isStrictAdmin(reqAdmin, resAdmin, () => { nextCalled = true; });
  assert('4.1 System Administrator is permitted by isStrictAdmin', nextCalled);

  // 4.2 Faculty rejected
  reqFaculty = { user: { id: 2, role: 'faculty' } };
  resFaculty = createMockRes();
  nextCalled = false;
  isStrictAdmin(reqFaculty, resFaculty, () => { nextCalled = true; });
  assert('4.2 Faculty cannot access isStrictAdmin endpoints (HTTP 403)', resFaculty.statusCode === 403 && !nextCalled);

  // 4.3 Student rejected
  reqStudent = { user: { id: 1, role: 'student' } };
  resStudent = createMockRes();
  nextCalled = false;
  isStrictAdmin(reqStudent, resStudent, () => { nextCalled = true; });
  assert('4.3 Student cannot access isStrictAdmin endpoints (HTTP 403)', resStudent.statusCode === 403 && !nextCalled);

  // -------------------------------------------------------------
  // Test 5: Student Data Isolation & IDOR Protection (ownsStudent)
  // -------------------------------------------------------------
  console.log('\n--- Test Group 5: Student IDOR Protection (ownsStudent) ---');

  // 5.1 Student accessing own records
  let reqOwnStudent = { user: { id: 1, role: 'student', studentId: 101 }, params: { id: 101 } };
  let resOwnStudent = createMockRes();
  nextCalled = false;
  ownsStudent(reqOwnStudent, resOwnStudent, () => { nextCalled = true; });
  assert('5.1 Student accessing own record is permitted', nextCalled);

  // 5.2 Student accessing another student's records (IDOR attempt)
  let reqIdorStudent = { user: { id: 1, role: 'student', studentId: 101 }, params: { id: 999 } };
  let resIdorStudent = createMockRes();
  nextCalled = false;
  ownsStudent(reqIdorStudent, resIdorStudent, () => { nextCalled = true; });
  assert('5.2 IDOR attempt rejected with HTTP 403', resIdorStudent.statusCode === 403 && !nextCalled);

  // -------------------------------------------------------------
  // Test 6: Secure Password Verification & Transparent Legacy Upgrade
  // -------------------------------------------------------------
  console.log('\n--- Test Group 6: Secure Password Verification & Legacy Upgrade ---');

  const bcrypt = require('bcryptjs');
  const { verifyUserPassword } = require('../backend/controllers/authController');

  // 6.1 Valid bcrypt hash comparison
  const samplePlain = 'StudentSecretPass#2026';
  const validHash = await bcrypt.hash(samplePlain, 10);
  const check1 = await verifyUserPassword(samplePlain, validHash);
  assert('6.1 Valid bcrypt password matches successfully', check1.isMatch && !check1.needsUpgrade);

  // 6.2 Incorrect password against bcrypt hash
  const check2 = await verifyUserPassword('WrongPassword!', validHash);
  assert('6.2 Incorrect password returns false match', !check2.isMatch);

  // 6.3 Malformed stored hash
  const check3 = await verifyUserPassword(samplePlain, '$2a$10$malformed_corrupt_hash_string');
  assert('6.3 Malformed stored hash returns false match safely without crashing', !check3.isMatch);

  // 6.4 Legacy plaintext password verification with timing-safe comparison
  const legacyPlain = 'legacy_demo_plain_pwd';
  const check4 = await verifyUserPassword(legacyPlain, legacyPlain);
  assert('6.4 Legacy plaintext password matches and correctly flags needsUpgrade: true', check4.isMatch && check4.needsUpgrade);

  // 6.5 Incorrect legacy password
  const check5 = await verifyUserPassword('not_the_legacy_pwd', legacyPlain);
  assert('6.5 Incorrect legacy password returns false match', !check5.isMatch);

  // 6.6 Simulated upgrade creates valid bcrypt hash that matches subsequently
  const upgradedHash = await bcrypt.hash(legacyPlain, 10);
  const check6 = await verifyUserPassword(legacyPlain, upgradedHash);
  assert('6.6 Upgraded hash is standard bcrypt ($2a/$2b) and verifies successfully without needsUpgrade', check6.isMatch && !check6.needsUpgrade);

  // -------------------------------------------------------------
  // Test 7: Secure Token Handling & Route RBAC Guard
  // -------------------------------------------------------------
  console.log('\n--- Test Group 7: Secure Token Extraction & Expiry Handling ---');

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    process.env.JWT_SECRET = 'test_jwt_secret_key_minimum_16_chars_long';
  }

  // 7.1 Valid Bearer token
  const validToken = jwt.sign(
    { id: 1, email: 'admin@ats.com', role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  let reqValid = { headers: { authorization: `Bearer ${validToken}` } };
  let resValid = createMockRes();
  nextCalled = false;
  await verifyToken(reqValid, resValid, () => { nextCalled = true; });
  assert('7.1 Valid Bearer token in Authorization header passes verifyToken', nextCalled && reqValid.user && reqValid.user.role === 'admin');

  // 7.1b Privilege escalation prevention: Forged role claim overridden by trusted DB identity
  const forgedToken = jwt.sign(
    { id: 99, email: 'test@ats.edu', role: 'admin' }, // student user 99 attempting to forge admin claim
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  let reqForged = { headers: { authorization: `Bearer ${forgedToken}` } };
  let resForged = createMockRes();
  nextCalled = false;
  await verifyToken(reqForged, resForged, () => { nextCalled = true; });
  assert('7.1b Privilege escalation prevented: Forged admin claim overridden by database student role', nextCalled && reqForged.user && reqForged.user.role === 'student');

  // 7.2 Query parameter token rejection (req.query.token must NOT authenticate)
  let reqQueryToken = { headers: {}, query: { token: validToken } };
  let resQueryToken = createMockRes();
  nextCalled = false;
  await verifyToken(reqQueryToken, resQueryToken, () => { nextCalled = true; });
  assert('7.2 Query parameter token (?token=...) is strictly rejected with HTTP 401', !nextCalled && resQueryToken.statusCode === 401);

  // 7.3 Expired token rejection with HTTP 401 (for clean client session expiry)
  const expiredToken = jwt.sign(
    { id: 99, email: 'test@ats.edu', role: 'student' },
    process.env.JWT_SECRET,
    { expiresIn: -10 } // expired 10 seconds ago
  );
  let reqExpired = { headers: { authorization: `Bearer ${expiredToken}` } };
  let resExpired = createMockRes();
  nextCalled = false;
  await verifyToken(reqExpired, resExpired, () => { nextCalled = true; });
  assert('7.3 Expired token is rejected with HTTP 401 (enables clean logout/redirect)', !nextCalled && resExpired.statusCode === 401);

  // 7.4 Tampered / invalid token rejection
  let reqTampered = { headers: { authorization: 'Bearer invalid.tampered.token.signature' } };
  let resTampered = createMockRes();
  nextCalled = false;
  await verifyToken(reqTampered, resTampered, () => { nextCalled = true; });
  assert('7.4 Tampered token is rejected with HTTP 401', !nextCalled && resTampered.statusCode === 401);

  // 7.5 Missing Authorization header
  let reqMissing = { headers: {} };
  let resMissing = createMockRes();
  nextCalled = false;
  await verifyToken(reqMissing, resMissing, () => { nextCalled = true; });
  assert('7.5 Missing Authorization header rejected with HTTP 401', !nextCalled && resMissing.statusCode === 401);

  // 7.6 isAdmin blocks student role from faculty mini-dashboard (HTTP 403)
  let reqStudentMini = { user: { id: 1, role: 'student' } };
  let resStudentMini = createMockRes();
  nextCalled = false;
  isAdmin(reqStudentMini, resStudentMini, () => { nextCalled = true; });
  assert('7.6 isAdmin middleware blocks student role with HTTP 403', !nextCalled && resStudentMini.statusCode === 403);

  // 7.7 isAdmin blocks faculty member (HTTP 403) and isFaculty allows faculty
  let reqFacultyMini = { user: { id: 2, role: 'faculty' } };
  let resFacultyMini = createMockRes();
  nextCalled = false;
  isAdmin(reqFacultyMini, resFacultyMini, () => { nextCalled = true; });
  assert('7.7 isAdmin blocks faculty role with HTTP 403', !nextCalled && resFacultyMini.statusCode === 403);

  let resFacultyAllowed = createMockRes();
  nextCalled = false;
  isFaculty(reqFacultyMini, resFacultyAllowed, () => { nextCalled = true; });
  assert('7.7b isFaculty allows faculty role', nextCalled && resFacultyAllowed.statusCode === 200);

  // 7.8 isAdmin allows system admin
  let reqAdminMini = { user: { id: 4, role: 'admin' } };
  let resAdminMini = createMockRes();
  nextCalled = false;
  isAdmin(reqAdminMini, resAdminMini, () => { nextCalled = true; });
  assert('7.8 isAdmin middleware allows admin role', nextCalled && resAdminMini.statusCode === 200);

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`=== PHASE 2 TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED ===`);
  console.log('===============================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase2Tests();
