/**
 * Verification Script: Restrict Advanced Academic Modules to Student Sidebar Only
 * 
 * Verifies:
 * 1. The 5 items:
 *    - Academic Risk Overview
 *    - Academic Knowledge Graph
 *    - Adaptive Study Planner
 *    - Skill Evidence Graph
 *    - Intervention Effectiveness
 * 2. Present in Student Sidebar (dashboard.html & ROLE_NAVIGATION_CONFIG.STUDENT)
 * 3. Absent from Faculty/Mentor Sidebar (mentor-dashboard.html & ROLE_NAVIGATION_CONFIG.FACULTY / MENTOR)
 * 4. Absent from HOD Sidebar (hod-dashboard.html & ROLE_NAVIGATION_CONFIG.HOD)
 * 5. Absent from Admin Sidebar (admin-dashboard.html & ROLE_NAVIGATION_CONFIG.ADMIN)
 * 6. Unauthorized access via URLs strictly blocked (frontend tab guards & backend RBAC)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE_URL = 'http://127.0.0.1:5000';
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

function request(method, urlPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };
    let reqBody = null;
    if (body) {
      reqBody = typeof body === 'string' ? body : JSON.stringify(body);
      reqHeaders['Content-Length'] = Buffer.byteLength(reqBody);
    }

    const req = http.request(url, { method, headers: reqHeaders }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) { json = data; }
        resolve({ status: res.statusCode, headers: res.headers, data: json });
      });
    });

    req.on('error', reject);
    if (reqBody) req.write(reqBody);
    req.end();
  });
}

async function loginUser(identifier, password, role) {
  const res = await request('POST', '/api/auth/login', { identifier, password, role });
  if (res.status !== 200 || !res.data?.token) {
    throw new Error(`Login failed for ${identifier}: ${JSON.stringify(res.data)}`);
  }
  return { token: res.data.token, user: res.data.user };
}

let passed = 0;
let failed = 0;

function check(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('========================================================================');
  console.log('🎯 VERIFYING ADVANCED MODULES RESTRICTED TO STUDENT SIDEBAR ONLY');
  console.log('========================================================================\n');

  const FIVE_MODULE_NAMES = [
    'Academic Risk Overview',
    'Academic Knowledge Graph',
    'Adaptive Study Planner',
    'Skill Evidence Graph',
    'Intervention Effectiveness'
  ];

  const adminHtml = fs.readFileSync(path.join(FRONTEND_DIR, 'admin-dashboard.html'), 'utf8');
  const hodHtml = fs.readFileSync(path.join(FRONTEND_DIR, 'hod-dashboard.html'), 'utf8');
  const mentorHtml = fs.readFileSync(path.join(FRONTEND_DIR, 'mentor-dashboard.html'), 'utf8');
  const studentHtml = fs.readFileSync(path.join(FRONTEND_DIR, 'dashboard.html'), 'utf8');
  const apiJs = fs.readFileSync(path.join(FRONTEND_DIR, 'api.js'), 'utf8');
  const adminJs = fs.readFileSync(path.join(FRONTEND_DIR, 'admin.js'), 'utf8');
  const hodJs = fs.readFileSync(path.join(FRONTEND_DIR, 'hod-dashboard.js'), 'utf8');
  const mentorJs = fs.readFileSync(path.join(FRONTEND_DIR, 'mentor-dashboard.js'), 'utf8');

  // Helper to extract sidebar nav block
  function getSidebarNav(html) {
    const start = html.indexOf('<nav class="sidebar-nav"');
    if (start === -1) return '';
    const end = html.indexOf('</nav>', start);
    return html.substring(start, end + 6);
  }

  const adminNav = getSidebarNav(adminHtml);
  const hodNav = getSidebarNav(hodHtml);
  const mentorNav = getSidebarNav(mentorHtml);
  const studentNav = getSidebarNav(studentHtml);

  // 1. Verify Student Sidebar Navigation
  console.log('--- 1. Student Sidebar Navigation ---');
  for (const name of FIVE_MODULE_NAMES) {
    check(studentNav.includes(name), `Student sidebar contains "${name}"`);
  }
  check(studentNav.includes('data-view="view-risk-overview"'), 'Student sidebar has data-view="view-risk-overview"');
  check(studentNav.includes('data-view="view-knowledge-graph"'), 'Student sidebar has data-view="view-knowledge-graph"');
  check(studentNav.includes('data-view="view-study-planner"'), 'Student sidebar has data-view="view-study-planner"');
  check(studentNav.includes('data-view="view-skill-evidence"'), 'Student sidebar has data-view="view-skill-evidence"');
  check(studentNav.includes('data-view="view-interventions"'), 'Student sidebar has data-view="view-interventions"');

  // 2. Verify Absence from Faculty/Mentor Sidebar
  console.log('\n--- 2. Faculty / Mentor Sidebar Navigation ---');
  for (const name of FIVE_MODULE_NAMES) {
    check(!mentorNav.includes(name), `Faculty/Mentor sidebar DOES NOT contain "${name}"`);
  }
  check(!mentorNav.includes('id="nav-knowledge-graph"'), 'Mentor sidebar removed nav-knowledge-graph');
  check(!mentorNav.includes('id="nav-study-planner"'), 'Mentor sidebar removed nav-study-planner');
  check(!mentorNav.includes('id="nav-skill-evidence"'), 'Mentor sidebar removed nav-skill-evidence');
  check(!mentorNav.includes('id="nav-interventions"'), 'Mentor sidebar removed nav-interventions');
  check(mentorNav.includes('id="nav-career-readiness"'), 'Mentor sidebar keeps standard Career Readiness option');
  check(mentorNav.includes('id="nav-mentees"'), 'Mentor sidebar keeps Mentee Management');
  check(mentorNav.includes('id="nav-leaves"'), 'Mentor sidebar keeps Leave Approvals');

  // 3. Verify Absence from HOD Sidebar
  console.log('\n--- 3. HOD Sidebar Navigation ---');
  for (const name of FIVE_MODULE_NAMES) {
    check(!hodNav.includes(name), `HOD sidebar DOES NOT contain "${name}"`);
  }
  check(!hodNav.includes('id="nav-risk-overview"'), 'HOD sidebar removed nav-risk-overview');
  check(!hodNav.includes('id="nav-knowledge-graph"'), 'HOD sidebar removed nav-knowledge-graph');
  check(!hodNav.includes('id="nav-study-planner"'), 'HOD sidebar removed nav-study-planner');
  check(!hodNav.includes('id="nav-skill-evidence"'), 'HOD sidebar removed nav-skill-evidence');
  check(!hodNav.includes('id="nav-interventions"'), 'HOD sidebar removed nav-interventions');
  check(hodNav.includes('id="nav-students"'), 'HOD sidebar keeps Department Students');
  check(hodNav.includes('id="nav-faculty"'), 'HOD sidebar keeps Faculty Directory');
  check(hodNav.includes('id="nav-allocations"'), 'HOD sidebar keeps Mentor Allocations');

  // 4. Verify Absence from Admin Sidebar
  console.log('\n--- 4. Admin Sidebar Navigation ---');
  for (const name of FIVE_MODULE_NAMES) {
    check(!adminNav.includes(name), `Admin sidebar DOES NOT contain "${name}"`);
  }
  check(!adminNav.includes('id="nav-knowledge-graph"'), 'Admin sidebar removed nav-knowledge-graph');
  check(!adminNav.includes('id="nav-study-planner"'), 'Admin sidebar removed nav-study-planner');
  check(!adminNav.includes('id="nav-skill-evidence"'), 'Admin sidebar removed nav-skill-evidence');
  check(!adminNav.includes('id="nav-interventions"'), 'Admin sidebar removed nav-interventions');
  check(adminNav.includes('id="nav-departments"'), 'Admin sidebar keeps Department Hub');
  check(adminNav.includes('id="nav-overview"'), 'Admin sidebar keeps Institution Executive Overview');
  check(adminNav.includes('id="nav-audit-logs"'), 'Admin sidebar keeps Security Audit Trail');

  // 5. Verify ROLE_NAVIGATION_CONFIG in api.js
  console.log('\n--- 5. Dynamic ROLE_NAVIGATION_CONFIG Verification ---');
  // Extract STUDENT config block
  const studentCfgMatch = apiJs.match(/STUDENT:\s*\{[\s\S]*?items:\s*\[([\s\S]*?)\]\s*\}/);
  check(studentCfgMatch !== null, 'ROLE_NAVIGATION_CONFIG.STUDENT exists');
  const studentCfg = studentCfgMatch ? studentCfgMatch[1] : '';
  for (const name of FIVE_MODULE_NAMES) {
    check(studentCfg.includes(name), `ROLE_NAVIGATION_CONFIG.STUDENT contains "${name}"`);
  }

  const adminCfgMatch = apiJs.match(/ADMIN:\s*\[([\s\S]*?)\]/);
  const adminCfg = adminCfgMatch ? adminCfgMatch[1] : '';
  for (const name of FIVE_MODULE_NAMES) {
    check(!adminCfg.includes(name), `ROLE_NAVIGATION_CONFIG.ADMIN does NOT contain "${name}"`);
  }

  const hodCfgMatch = apiJs.match(/HOD:\s*\[([\s\S]*?)\]/);
  const hodCfg = hodCfgMatch ? hodCfgMatch[1] : '';
  for (const name of FIVE_MODULE_NAMES) {
    check(!hodCfg.includes(name), `ROLE_NAVIGATION_CONFIG.HOD does NOT contain "${name}"`);
  }

  const mentorCfgMatch = apiJs.match(/MENTOR:\s*\[([\s\S]*?)\]/);
  const mentorCfg = mentorCfgMatch ? mentorCfgMatch[1] : '';
  for (const name of FIVE_MODULE_NAMES) {
    check(!mentorCfg.includes(name), `ROLE_NAVIGATION_CONFIG.MENTOR does NOT contain "${name}"`);
  }

  // 6. Verify URL Manually Entered Guards in JS Files
  console.log('\n--- 6. Manual URL Route Interception Guards ---');
  check(adminJs.includes('RESTRICTED_STUDENT_MODULES'), 'admin.js includes RESTRICTED_STUDENT_MODULES guard');
  check(hodJs.includes('RESTRICTED_STUDENT_MODULES'), 'hod-dashboard.js includes RESTRICTED_STUDENT_MODULES guard');
  check(mentorJs.includes('RESTRICTED_STUDENT_MODULES'), 'mentor-dashboard.js includes RESTRICTED_STUDENT_MODULES guard');

  // 7. Verify Live Backend RBAC Security
  console.log('\n--- 7. Live Backend RBAC Protection ---');
  const adminAuth = await loginUser('admin@ats.com', 'admin123', 'admin');
  const studentAuth = await loginUser('BITD0001', 'student123', 'student');
  const mentorAuth = await loginUser('mentor.cse@ats.com', 'mentor123', 'faculty');

  const adminHeaders = { 'Authorization': `Bearer ${adminAuth.token}` };
  const studentHeaders = { 'Authorization': `Bearer ${studentAuth.token}` };
  const mentorHeaders = { 'Authorization': `Bearer ${mentorAuth.token}` };

  // Admin trying to access knowledge graph
  const adminKgRes = await request('GET', '/api/knowledge-graph', null, adminHeaders);
  check(adminKgRes.status === 403, 'Admin blocked from /api/knowledge-graph (HTTP 403 Forbidden)');

  // Admin trying to access student trajectory prediction
  const adminTrajRes = await request('GET', `/api/trajectory/predict/${studentAuth.user.studentId}`, null, adminHeaders);
  check(adminTrajRes.status === 403, 'Admin blocked from /api/trajectory/predict/:id (HTTP 403 Forbidden)');

  // Admin trying to access student study planner
  const adminPlanRes = await request('GET', `/api/study-planner/${studentAuth.user.studentId}`, null, adminHeaders);
  check(adminPlanRes.status === 403, 'Admin blocked from /api/study-planner/:id (HTTP 403 Forbidden)');

  // Student accessing their own knowledge graph succeeds
  const studentKgRes = await request('GET', `/api/knowledge-graph?studentId=${studentAuth.user.studentId}`, null, studentHeaders);
  check(studentKgRes.status === 200 && studentKgRes.data?.success, 'Student authorized for /api/knowledge-graph (HTTP 200 OK)');

  // Student accessing their study planner succeeds
  const studentPlanRes = await request('GET', `/api/study-planner/${studentAuth.user.studentId}`, null, studentHeaders);
  check(studentPlanRes.status === 200 && studentPlanRes.data?.success, 'Student authorized for /api/study-planner/:id (HTTP 200 OK)');

  console.log('\n========================================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
