const jwt = require('jsonwebtoken');
const {
  verifyToken,
  requireRole,
  isStudent,
  isStrictAdmin,
  isAdmin,
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
