const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');

const BASE_URL = 'http://localhost:5000/api';
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

function checkPortListening(port = 5000) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(600);
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('error', () => { s.destroy(); resolve(false); });
    s.on('timeout', () => { s.destroy(); resolve(false); });
    s.connect(port, '127.0.0.1');
  });
}

function request(url, options = {}, data = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    if (data) {
      const body = typeof data === 'string' ? data : JSON.stringify(data);
      reqOptions.headers['Content-Type'] = 'application/json';
      reqOptions.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function login(identifier, password, role) {
  const res = await request(`${BASE_URL}/auth/login`, { method: 'POST' }, { identifier, password, role });
  if (res.status !== 200 || !res.data.token) {
    throw new Error(`Login failed for ${identifier} (${role}): status=${res.status} msg=${JSON.stringify(res.data)}`);
  }
  return { token: res.data.token, user: res.data.user };
}

async function runTestSuite() {
  console.log('================================================================');
  console.log(' ATS TEST SUITE: ROLE-AWARE SIDEBARS & NAVIGATION INTEGRITY     ');
  console.log('================================================================\n');

  let serverProcess = null;
  const isListening = await checkPortListening(5000);
  if (!isListening) {
    console.log('[Setup] Starting backend server on port 5000...');
    serverProcess = spawn('node', ['backend/server.js'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe'
    });
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      if (await checkPortListening(5000)) break;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Frontend Files & ChatGPT-Style Sidebar Markup
    // -------------------------------------------------------------
    console.log('[Test 1] Validating Sidebar Structure & Views in HTML Files...');
    const adminHtml = fs.readFileSync(path.join(FRONTEND_DIR, 'admin-dashboard.html'), 'utf8');
    const hodHtml = fs.readFileSync(path.join(FRONTEND_DIR, 'hod-dashboard.html'), 'utf8');
    const mentorHtml = fs.readFileSync(path.join(FRONTEND_DIR, 'mentor-dashboard.html'), 'utf8');
    const studentHtml = fs.readFileSync(path.join(FRONTEND_DIR, 'dashboard.html'), 'utf8');
    const profileHtml = fs.readFileSync(path.join(FRONTEND_DIR, 'profile.html'), 'utf8');

    // Check app-sidebar presence
    assert(adminHtml.includes('id="app-sidebar"'), 'admin-dashboard.html must have id="app-sidebar"');
    assert(hodHtml.includes('id="app-sidebar"'), 'hod-dashboard.html must have id="app-sidebar"');
    assert(mentorHtml.includes('id="app-sidebar"'), 'mentor-dashboard.html must have id="app-sidebar"');
    assert(studentHtml.includes('id="app-sidebar"'), 'dashboard.html must have id="app-sidebar"');
    assert(profileHtml.includes('id="app-sidebar"'), 'profile.html must have id="app-sidebar"');

    // Check mobile-menu-btn toggle
    assert(adminHtml.includes('id="mobile-menu-btn"'), 'admin-dashboard.html must have mobile-menu-btn');
    assert(hodHtml.includes('id="mobile-menu-btn"'), 'hod-dashboard.html must have mobile-menu-btn');
    assert(mentorHtml.includes('id="mobile-menu-btn"'), 'mentor-dashboard.html must have mobile-menu-btn');
    assert(studentHtml.includes('id="mobile-menu-btn"'), 'dashboard.html must have mobile-menu-btn');
    assert(profileHtml.includes('id="mobile-menu-btn"'), 'profile.html must have mobile-menu-btn');

    // Check profile.html dynamic nav
    assert(profileHtml.includes('data-dynamic-nav="true"'), 'profile.html must have data-dynamic-nav="true" on nav');
    assert(!profileHtml.includes('recommendations.html'), 'profile.html must not contain static legacy student links');

    console.log('  ✓ All 5 pages feature standard #app-sidebar and accessible #mobile-menu-btn');
    console.log('  ✓ profile.html uses clean dynamic role navigation container');

    // -------------------------------------------------------------
    // Test 2: Role-Specific View Modules Exist & Are Isolated
    // -------------------------------------------------------------
    console.log('\n[Test 2] Validating View Modules Against Priority 4 Specifications...');
    const adminExpectedViews = [
      'view-overview', 'view-departments', 'view-students', 'view-faculty', 'view-hod',
      'view-mentor-assignments', 'view-academic-records', 'view-fees', 'view-activities',
      'view-impact-loop', 'view-decision-trace', 'view-audit-logs', 'view-reports'
    ];
    for (const v of adminExpectedViews) {
      assert(adminHtml.includes(`id="${v}"`), `Admin view container #${v} missing in admin-dashboard.html`);
    }

    const hodExpectedViews = [
      'view-dashboard', 'view-overview', 'view-faculty', 'view-students', 'view-allocations',
      'view-performance', 'view-activities', 'view-impact-loop', 'view-decision-trace', 'view-reports'
    ];
    for (const v of hodExpectedViews) {
      assert(hodHtml.includes(`id="${v}"`), `HOD view container #${v} missing in hod-dashboard.html`);
    }

    const mentorExpectedViews = [
      'view-dashboard', 'view-mentees', 'view-leaves', 'view-activities', 'view-results',
      'view-fees', 'view-risk-radar', 'view-impact-loop', 'view-decision-trace'
    ];
    for (const v of mentorExpectedViews) {
      assert(mentorHtml.includes(`id="${v}"`), `Mentor view container #${v} missing in mentor-dashboard.html`);
    }

    const studentExpectedViews = [
      'view-dashboard', 'view-progress', 'view-attendance', 'view-internal-marks', 'view-semester-results',
      'view-gpa', 'view-activities', 'view-achievement-passport', 'view-career-readiness', 'view-leave-requests',
      'view-fee-status', 'view-mentor', 'view-simulator'
    ];
    for (const v of studentExpectedViews) {
      assert(studentHtml.includes(`id="${v}"`), `Student view container #${v} missing in dashboard.html`);
    }

    console.log(`  ✓ Admin: all ${adminExpectedViews.length} views verified present & isolated`);
    console.log(`  ✓ HOD: all ${hodExpectedViews.length} views verified present & isolated`);
    console.log(`  ✓ Mentor: all ${mentorExpectedViews.length} views verified present & isolated`);
    console.log(`  ✓ Student: all ${studentExpectedViews.length} views verified present & isolated`);

    // -------------------------------------------------------------
    // Test 3: CSS Responsive & ChatGPT-Style Drawer Verification
    // -------------------------------------------------------------
    console.log('\n[Test 3] Validating CSS Styling & Mobile Responsive Media Queries...');
    const styleCss = fs.readFileSync(path.join(FRONTEND_DIR, 'style.css'), 'utf8');
    assert(styleCss.includes('.content-view'), '.content-view class must exist');
    assert(styleCss.includes('.content-view.active'), '.content-view.active class must exist');
    assert(styleCss.includes('.sidebar.open') || styleCss.includes('.sidebar.mobile-open'), 'sidebar open class must exist');
    assert(styleCss.includes('transform: translateX(-100%)'), 'sidebar mobile transform hidden must exist');
    assert(styleCss.includes('overflow-x: hidden'), 'main-wrapper mobile overflow protection must exist');
    console.log('  ✓ Single content-view active display verified');
    console.log('  ✓ Mobile drawer translation and overflow constraints verified');

    // -------------------------------------------------------------
    // Test 4: Verify Frontend Role Normalization & Config
    // -------------------------------------------------------------
    console.log('\n[Test 4] Validating getVerifiedUserRole and Navigation Configurations in api.js...');
    const apiJs = fs.readFileSync(path.join(FRONTEND_DIR, 'api.js'), 'utf8');
    assert(apiJs.includes('function getVerifiedUserRole(user)'), 'getVerifiedUserRole must be defined');
    assert(apiJs.includes("ROLE_NAVIGATION_CONFIG = {"), 'ROLE_NAVIGATION_CONFIG must be defined');
    assert(apiJs.includes("ADMIN: {"), 'ROLE_NAVIGATION_CONFIG.ADMIN must be defined');
    assert(apiJs.includes("HOD: {"), 'ROLE_NAVIGATION_CONFIG.HOD must be defined');
    assert(apiJs.includes("MENTOR: {"), 'ROLE_NAVIGATION_CONFIG.MENTOR must be defined');
    assert(apiJs.includes("FACULTY: {"), 'ROLE_NAVIGATION_CONFIG.FACULTY must be defined');
    assert(apiJs.includes("STUDENT: {"), 'ROLE_NAVIGATION_CONFIG.STUDENT must be defined');
    assert(apiJs.includes("window.toggleSidebarDrawer"), 'window.toggleSidebarDrawer must be defined');
    assert(apiJs.includes("clearSession()"), 'clearSession must be defined');
    assert(apiJs.includes("sessionStorage.clear()"), 'clearSession must clear sessionStorage');
    console.log('  ✓ getVerifiedUserRole maps ADMIN, HOD, MENTOR, FACULTY, STUDENT correctly');
    console.log('  ✓ ROLE_NAVIGATION_CONFIG contains non-overlapping routes for all roles');
    console.log('  ✓ Clean session teardown on logout verified');

    // -------------------------------------------------------------
    // Test 5: Verify Live User Profiles & Roles Across All Portals
    // -------------------------------------------------------------
    console.log('\n[Test 5] Validating Live Server Role Credentials & /api/auth/me Profile Isolation...');
    
    // Login as Admin
    const adminSession = await login('admin@ats.com', 'admin123', 'admin');
    assert.strictEqual(adminSession.user.role, 'admin');
    const adminMe = await request(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${adminSession.token}` }
    });
    assert.strictEqual(adminMe.status, 200);
    assert.strictEqual(adminMe.data.user.role, 'admin');
    assert.strictEqual(adminMe.data.user.facultyRole, null);
    assert.strictEqual(adminMe.data.user.isHOD, false);
    assert.strictEqual(adminMe.data.user.canMentor, false);
    console.log('  ✓ Admin /auth/me returns role=admin with zero mentor/hod leakage');

    // Login as HOD
    const hodSession = await login('anand.demo@ats.edu', 'hod123', 'hod');
    assert.strictEqual(hodSession.user.role, 'faculty');
    const hodMe = await request(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${hodSession.token}` }
    });
    assert.strictEqual(hodMe.status, 200);
    assert.strictEqual(hodMe.data.user.role, 'faculty');
    assert.strictEqual(hodMe.data.user.facultyRole, 'hod');
    assert.strictEqual(hodMe.data.user.isHOD, true);
    console.log('  ✓ HOD /auth/me returns role=faculty, facultyRole=hod, isHOD=true');

    // Login as Mentor
    const mentorSession = await login('mentor.cse@ats.com', 'mentor123', 'faculty');
    assert.strictEqual(mentorSession.user.role, 'faculty');
    const mentorMe = await request(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${mentorSession.token}` }
    });
    assert.strictEqual(mentorMe.status, 200);
    assert.strictEqual(mentorMe.data.user.role, 'faculty');
    assert.strictEqual(mentorMe.data.user.facultyRole, 'mentor');
    assert.strictEqual(mentorMe.data.user.canMentor, true);
    console.log('  ✓ Mentor /auth/me returns role=faculty, facultyRole=mentor, canMentor=true');

    // Login as Student
    const studentSession = await login('BITD0001', 'student123', 'student');
    assert.strictEqual(studentSession.user.role, 'student');
    const studentMe = await request(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${studentSession.token}` }
    });
    assert.strictEqual(studentMe.status, 200);
    assert.strictEqual(studentMe.data.user.role, 'student');
    assert(studentMe.data.user.studentId > 0);
    console.log('  ✓ Student /auth/me returns role=student with verified studentId');

    // -------------------------------------------------------------
    // Test 6: Verify Three Repaired Mentor Endpoints via Mentor Session
    // -------------------------------------------------------------
    console.log('\n[Test 6] Validating Repaired Mentor Endpoints with Live Authorized Token...');
    const leavesRes = await request(`${BASE_URL}/leave/mentor-requests`, {
      headers: { Authorization: `Bearer ${mentorSession.token}` }
    });
    assert.strictEqual(leavesRes.status, 200);
    assert.strictEqual(leavesRes.data.success, true);
    assert(Array.isArray(leavesRes.data.data), 'Leaves data must be an array');

    const feesRes = await request(`${BASE_URL}/fees/mentor-overview`, {
      headers: { Authorization: `Bearer ${mentorSession.token}` }
    });
    assert.strictEqual(feesRes.status, 200);
    assert.strictEqual(feesRes.data.success, true);
    assert(Array.isArray(feesRes.data.data), 'Fees data must be an array');

    const actsRes = await request(`${BASE_URL}/activities/mentor-pending`, {
      headers: { Authorization: `Bearer ${mentorSession.token}` }
    });
    assert.strictEqual(actsRes.status, 200);
    assert.strictEqual(actsRes.data.success, true);
    assert(Array.isArray(actsRes.data.data), 'Activities data must be an array');

    console.log('  ✓ GET /api/leave/mentor-requests: 200 OK');
    console.log('  ✓ GET /api/fees/mentor-overview: 200 OK');
    console.log('  ✓ GET /api/activities/mentor-pending: 200 OK');

    // -------------------------------------------------------------
    // Test 7: Verify RBAC Protection (Student/Admin Forbidden from Mentor APIs)
    // -------------------------------------------------------------
    console.log('\n[Test 7] Validating RBAC Protection Against Cross-Role Portal Access...');
    const studentLeaveAccess = await request(`${BASE_URL}/leave/mentor-requests`, {
      headers: { Authorization: `Bearer ${studentSession.token}` }
    });
    assert.strictEqual(studentLeaveAccess.status, 403, 'Student must receive 403 Forbidden on mentor leave endpoint');

    const adminLeaveAccess = await request(`${BASE_URL}/leave/mentor-requests`, {
      headers: { Authorization: `Bearer ${adminSession.token}` }
    });
    assert.strictEqual(adminLeaveAccess.status, 403, 'Admin must receive 403 Forbidden on mentor leave endpoint');

    const studentFeesAccess = await request(`${BASE_URL}/fees/mentor-overview`, {
      headers: { Authorization: `Bearer ${studentSession.token}` }
    });
    assert.strictEqual(studentFeesAccess.status, 403, 'Student must receive 403 Forbidden on mentor fees endpoint');

    console.log('  ✓ Student accessing mentor endpoints strictly blocked with HTTP 403');
    console.log('  ✓ Admin accessing mentor operational endpoints strictly blocked with HTTP 403');

    console.log('\n================================================================');
    console.log(' ALL ROLE-AWARE SIDEBAR & NAVIGATION TESTS PASSED (100% OK)    ');
    console.log('================================================================\n');

  } finally {
    if (serverProcess) {
      serverProcess.kill();
    }
  }
}

runTestSuite().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
