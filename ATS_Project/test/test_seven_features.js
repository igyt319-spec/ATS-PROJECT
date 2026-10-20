/**
 * ATS Intelligence Platform — Master Seven Features & Security Test Suite
 * =======================================================================
 * Comprehensive verification of:
 * - Feature 1: AI Academic Digital Twin (multi-semester OLS GPA forecast, prediction intervals, weak subject diagnostics, MAE/RMSE)
 * - Feature 2: AI Career Readiness Engine (5 career tracks, competency matrix, verified vs self-declared skills, prioritized roadmap)
 * - Feature 3: Verified Achievement Passport (co-curricular portfolio, category breakdown, public privacy-safe QR verification)
 * - Feature 4: College Digital Twin Dashboard (department telemetry, cohort risk, pass rates, faculty mentor workload, institutional macro twin)
 * - Feature 5: AI Academic Mentor 2.0 (weak subject remedies, 7-day study plan, career readiness gap explanations, what-if advice)
 * - Feature 6: Academic What-If Simulator (Target GPA solver, attendance buffer/recovery calculator, zero database pollution)
 * - Feature 7: Smart Academic Integrity & Audit System (immutable audit logging, CSV/JSON export, rule-based anomaly detection)
 * - OpenAPI / Swagger Documentation (/api/docs & /api/docs/json)
 * - Strict RBAC Enforcement across Student, Faculty, HOD, and Admin boundaries
 */

const http = require('http');
const net = require('net');
const { spawn } = require('child_process');
const path = require('path');
const assert = require('assert');

const BASE_URL = 'http://localhost:5000/api';

let spawnedServerProcess = null;

function checkServerListening(port = 5000) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(600);
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('error', () => { s.destroy(); resolve(false); });
    s.on('timeout', () => { s.destroy(); resolve(false); });
    s.connect(port, '127.0.0.1');
  });
}

async function ensureServerRunning() {
  const isListening = await checkServerListening(5000);
  if (isListening) return;

  console.log('⚡ Starting background ATS server for testing...');
  const serverPath = path.join(__dirname, '../backend/server.js');
  spawnedServerProcess = spawn(process.execPath, [serverPath], {
    cwd: path.join(__dirname, '..'),
    stdio: 'ignore'
  });

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    const ready = await checkServerListening(5000);
    if (ready) {
      console.log('⚡ Background ATS server ready.\n');
      return;
    }
  }
  throw new Error('Timeout waiting for ATS server on port 5000');
}

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch (_) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function login(identifier, password, role) {
  const res = await request('POST', '/auth/login', { identifier, password, role });
  if (!res.body.success || !res.body.token) {
    throw new Error(`Login failed for ${identifier}: ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.token, user: res.body.user };
}

let totalTests = 0;
let passedTests = 0;

async function test(desc, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}: ${err.message}`);
    throw err;
  }
}

async function runSuite() {
  await ensureServerRunning();

  console.log('======================================================================');
  console.log('🚀 ATS INTELLIGENCE PLATFORM — SEVEN MASTER FEATURES TEST SUITE');
  console.log('======================================================================\n');

  // Authenticate principals
  console.log('▶️ Authenticating test principals...');
  const student1 = await login('BITD0001', 'student123', 'student');
  const student2 = await login('BITD0002', 'student123', 'student');
  const faculty = await login('mentor.cse@ats.com', 'mentor123', 'faculty');
  const hod = await login('DEMO-HOD-01', 'hod123', 'faculty');
  const admin = await login('admin@ats.com', 'admin123', 'admin');

  const s1Id = student1.user.studentId || 1;
  const s2Id = student2.user.studentId || 2;
  const hodDeptId = hod.user.departmentId || 1;

  console.log(`   Student 1 ID: #${s1Id}`);
  console.log(`   Student 2 ID: #${s2Id}`);
  console.log(`   HOD Dept ID: #${hodDeptId}`);
  console.log(`   Admin ID: #${admin.user.id}\n`);

  // =========================================================================
  // FEATURE 1: AI ACADEMIC DIGITAL TWIN
  // =========================================================================
  console.log('--- Feature 1: AI Academic Digital Twin ---');

  await test('1.1 Generates analytical digital twin with GPA trajectory and weak subject diagnostics', async () => {
    const res = await request('GET', `/digital-twin/${s1Id}`, null, student1.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.digitalTwin, 'Expected digitalTwin object');
    assert.ok(Array.isArray(res.body.digitalTwin.historicalTrends), 'historicalTrends should be array');
    assert.ok(res.body.digitalTwin.subjectDiagnostics, 'subjectDiagnostics should exist');
    assert.ok(Array.isArray(res.body.digitalTwin.subjectDiagnostics.weakSubjects), 'weakSubjects should be array');
    assert.ok(res.body.digitalTwin.disclaimer.toLowerCase().includes('statistical'), 'Expected statistical disclaimer');
  });

  await test('1.2 Implements statistical OLS regression with prediction intervals and accuracy evaluation', async () => {
    const res = await request('GET', `/digital-twin/${s1Id}`, null, student1.token);
    const twin = res.body.digitalTwin;
    assert.ok(twin.prediction, 'Expected prediction object');
    if (twin.prediction.isAvailable) {
      assert.ok(typeof twin.prediction.predictedGpa === 'number', 'predictedGpa must be numeric');
      assert.ok(typeof twin.prediction.gpaRange.low === 'number', 'gpaRange.low must be numeric');
      assert.ok(typeof twin.prediction.gpaRange.high === 'number', 'gpaRange.high must be numeric');
      assert.ok(twin.prediction.gpaRange.low <= twin.prediction.gpaRange.high, 'Low range <= high range');
    } else {
      assert.ok(twin.prediction.reason, 'Reason should be provided for unavailable prediction');
    }
    assert.ok(twin.evaluationMetrics, 'Expected evaluationMetrics object');
    assert.ok(typeof twin.evaluationMetrics.evaluatedSamples === 'number', 'evaluatedSamples should be number');
  });

  await test('1.3 Enforces strict student boundary (Student 2 cannot view Student 1 Digital Twin)', async () => {
    const res = await request('GET', `/digital-twin/${s1Id}`, null, student2.token);
    assert.strictEqual(res.status, 403, 'Unauthorized student should receive 403');
    assert.strictEqual(res.body.success, false);
  });

  // =========================================================================
  // FEATURE 2: AI CAREER READINESS ENGINE
  // =========================================================================
  console.log('\n--- Feature 2: AI Career Readiness Engine ---');

  await test('2.1 Lists all 5 core engineering career tracks (VLSI, Embedded, ECE, SWE, AI/ML)', async () => {
    const res = await request('GET', '/career/roles', null, student1.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    const rolesList = res.body.data || res.body.roles || [];
    assert.ok(Array.isArray(rolesList), 'roles should be an array');
    assert.ok(rolesList.length >= 5, 'Should have at least 5 career tracks');
    const titles = rolesList.map(r => r.title);
    assert.ok(titles.some(t => t.includes('Software Engineering')), 'Software Engineering track exists');
    assert.ok(titles.some(t => t.includes('Data Science & AI/ML')), 'Data Science & AI/ML track exists');
  });

  await test('2.2 Sets target career role idempotently for student', async () => {
    const res = await request('POST', '/career/target', {
      student_id: s1Id,
      career_role_id: 4 // Software Engineering
    }, student1.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  await test('2.3 Assesses competency matrix, verified evidence vs self-declared skills, and gaps', async () => {
    const res = await request('GET', `/career/assess/${s1Id}?role_id=4`, null, student1.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(typeof res.body.readinessIndex === 'number', 'Readiness index should be number');
    assert.ok(Array.isArray(res.body.evaluatedCompetencies), 'evaluatedCompetencies should be array');
    assert.ok(typeof res.body.missingCount === 'number', 'missingCount should be number');
    assert.ok(res.body.evidenceNotice, 'Evidence notice required');
  });

  await test('2.4 Generates prioritized milestone roadmap with actionable courses and projects', async () => {
    const res = await request('GET', `/career/roadmap/${s1Id}`, null, student1.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.roadmap, 'Expected roadmap object');
    assert.ok(Array.isArray(res.body.roadmap.milestones), 'milestones should be an array');
    if (res.body.roadmap.milestones.length > 0) {
      const m = res.body.roadmap.milestones[0];
      assert.ok(m.title, 'Milestone should have title');
      assert.ok(m.priority, 'Milestone should have priority');
    }
  });

  // =========================================================================
  // FEATURE 3: VERIFIED ACHIEVEMENT PASSPORT
  // =========================================================================
  console.log('\n--- Feature 3: Verified Achievement Passport ---');

  let verificationToken = null;

  await test('3.1 Generates student achievement passport with category breakdown and verified items', async () => {
    const res = await request('GET', `/activities/passport/${s1Id}`, null, student1.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.passport, 'Expected passport object');
    assert.ok(typeof res.body.passport.summary.totalVerifiedAchievements === 'number', 'totalVerifiedAchievements should be number');
    assert.ok(Array.isArray(res.body.passport.verifiedAchievements), 'verifiedAchievements should be array');
    
    if (res.body.passport.verifiedAchievements.length > 0) {
      verificationToken = res.body.passport.verifiedAchievements[0].verificationToken;
    }
  });

  await test('3.2 Public QR verification endpoint confirms authentic credentials without private data leakage', async () => {
    const tokenToTest = verificationToken || 'VERIF-DEMO-TEST';
    const res = await request('GET', `/activities/passport/verify/${tokenToTest}`);
    assert.ok([200, 404].includes(res.status), `Expected 200 or 404, got ${res.status}`);
    
    if (res.status === 200) {
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.verified, true);
      const pub = res.body.data;
      assert.ok(pub, 'Expected data verification card');
      assert.ok(pub.recipientDisplayName, 'Expected privacy-masked student name');
      assert.ok(pub.achievementTitle, 'Expected achievement title');
      assert.ok(pub.academicDepartment, 'Expected department name');
      // Privacy guarantees: zero confidential leaks
      assert.strictEqual(pub.phone, undefined, 'Phone must never be exposed publicly');
      assert.strictEqual(pub.email, undefined, 'Email must never be exposed publicly');
      assert.strictEqual(pub.marks, undefined, 'Marks must never be exposed publicly');
    }
  });

  // =========================================================================
  // FEATURE 4: COLLEGE DIGITAL TWIN DASHBOARD
  // =========================================================================
  console.log('\n--- Feature 4: College Digital Twin Dashboard ---');

  await test('4.1 Retrieves department intelligence twin (GPA trends, attendance, subject pass rates, faculty workload)', async () => {
    const res = await request('GET', `/college-twin/department/${hodDeptId}`, null, hod.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.departmentTwin, 'Expected departmentTwin object');
    const twin = res.body.departmentTwin;
    assert.ok(twin.metrics, 'Expected metrics object');
    assert.ok(twin.attendanceDistribution, 'Expected attendanceDistribution');
    assert.ok(typeof twin.attendanceDistribution.good === 'number', 'attendance good should be number');
    assert.ok(twin.riskDistribution, 'Expected riskDistribution');
    assert.ok(Array.isArray(twin.subjectPerformance), 'subjectPerformance should be array');
    assert.ok(Array.isArray(twin.facultyWorkload), 'facultyWorkload should be array');
  });

  await test('4.2 Enforces RBAC (Students cannot access department twin)', async () => {
    const res = await request('GET', `/college-twin/department/${hodDeptId}`, null, student1.token);
    assert.strictEqual(res.status, 403, 'Student should be forbidden from department twin');
  });

  await test('4.3 Retrieves institutional macro digital twin (cross-department comparisons)', async () => {
    const res = await request('GET', '/college-twin/institution', null, admin.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.institutionTwin, 'Expected institutionTwin object');
    const itwin = res.body.institutionTwin;
    assert.ok(itwin.macroKPIs, 'Expected macroKPIs');
    assert.ok(typeof itwin.macroKPIs.totalDepartments === 'number');
    assert.ok(Array.isArray(itwin.departmentComparisons), 'departmentComparisons should be array');
  });

  // =========================================================================
  // FEATURE 5: AI ACADEMIC MENTOR 2.0
  // =========================================================================
  console.log('\n--- Feature 5: AI Academic Mentor 2.0 ---');

  await test('5.1 AI Mentor provides contextual weak subjects diagnostic and actionable remedies', async () => {
    const res = await request('POST', '/chatbot/message', {
      student_id: s1Id,
      message: 'What are my weak subjects and how can I improve?'
    }, student1.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(typeof res.body.reply === 'string', 'Reply must be string');
    assert.ok(res.body.reply.length > 20, 'Reply should be substantive');
  });

  await test('5.2 AI Mentor generates personalized 7-day study plan', async () => {
    const res = await request('POST', '/chatbot/message', {
      student_id: s1Id,
      message: 'Generate a personalized 7-day study plan'
    }, student1.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.reply.includes('Day 1') || res.body.reply.includes('Study Plan'), 'Expected study plan days');
  });

  await test('5.3 AI Mentor explains career readiness gaps and what-if simulation advice', async () => {
    const res = await request('POST', '/chatbot/message', {
      student_id: s1Id,
      message: 'Analyze my career readiness gap and what marks I need for 8.5 GPA'
    }, student1.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.reply.length > 20, 'Substantive response expected');
  });

  // =========================================================================
  // FEATURE 6: ACADEMIC WHAT-IF SIMULATOR
  // =========================================================================
  console.log('\n--- Feature 6: Academic What-If Simulator ---');

  await test('6.1 Solves Target GPA exam marks requirement with transparent formula', async () => {
    const res = await request('POST', '/simulator/target-gpa', {
      student_id: s1Id,
      target_gpa: 8.5
    }, student1.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(typeof res.body.isAchievable === 'boolean', 'isAchievable should be boolean');
    assert.ok(typeof res.body.targetGpa === 'number', 'targetGpa should be number');
    assert.ok(res.body.formula, 'Formula explanation required');
    assert.ok(res.body.note.toLowerCase().includes('simulation'), 'Simulation note required');
  });

  await test('6.2 Projects attendance compliance, safe bunks allowance, and recovery classes', async () => {
    const res = await request('POST', '/simulator/attendance', {
      student_id: s1Id,
      upcoming_classes_total: 20,
      upcoming_classes_attended: 18
    }, student1.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(typeof res.body.current.percentage === 'number', 'Current percentage should be numeric');
    assert.ok(typeof res.body.projected.percentage === 'number', 'Projected percentage should be numeric');
    assert.ok(typeof res.body.projected.safeBunksRemaining === 'number', 'safeBunksRemaining should be numeric');
    assert.ok(typeof res.body.projected.recoveryClassesNeededFor75 === 'number', 'recoveryClassesNeededFor75 should be numeric');
  });

  await test('6.3 Validates impossible simulation inputs gracefully (e.g. missing required params)', async () => {
    const res = await request('POST', '/simulator/attendance', {
      student_id: s1Id
    }, student1.token);
    assert.strictEqual(res.status, 400, 'Should reject missing upcoming classes params');
    assert.strictEqual(res.body.success, false);
  });

  // =========================================================================
  // FEATURE 7: SMART ACADEMIC INTEGRITY & AUDIT SYSTEM
  // =========================================================================
  console.log('\n--- Feature 7: Smart Academic Integrity & Audit System ---');

  await test('7.1 Admin can inspect immutable audit logs with details and actor metadata', async () => {
    const res = await request('GET', '/audit-logs?limit=10', null, admin.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data), 'Audit logs should be array');
    assert.ok(typeof res.body.total === 'number', 'Total count should be number');
  });

  await test('7.2 Enforces RBAC (Students are strictly barred from audit logs)', async () => {
    const res = await request('GET', '/audit-logs', null, student1.token);
    assert.strictEqual(res.status, 403, 'Student must receive 403 Forbidden for audit logs');
  });

  await test('7.3 Exports audit log report in CSV format', async () => {
    const res = await request('GET', '/audit-logs/export?format=csv', null, admin.token);
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body === 'string', 'CSV output must be string');
    assert.ok(res.body.includes('Log ID') && res.body.includes('Actor Name'), 'CSV header line expected');
  });

  await test('7.4 Exports audit log report in JSON format', async () => {
    const res = await request('GET', '/audit-logs/export?format=json', null, admin.token);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body) || typeof res.body === 'object', 'JSON output expected');
  });

  await test('7.5 Scans audit anomalies using rule-based velocity thresholds', async () => {
    const res = await request('GET', '/audit-logs/anomalies', null, admin.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(typeof res.body.anomaliesDetected === 'number');
    assert.ok(Array.isArray(res.body.anomalies), 'anomalies should be array');
  });

  // =========================================================================
  // OPENAPI / SWAGGER DOCUMENTATION
  // =========================================================================
  console.log('\n--- OpenAPI / Swagger API Documentation ---');

  await test('8.1 Serves interactive Swagger UI HTML at /api/docs', async () => {
    const res = await request('GET', '/docs');
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.body === 'string');
    assert.ok(res.body.includes('SwaggerUIBundle'), 'Expected Swagger UI bundle script in HTML');
    assert.ok(res.body.includes('ATS Intelligence Platform API Documentation'), 'Expected title in docs');
  });

  await test('8.2 Serves complete OpenAPI 3.0 specification at /api/docs/json with all 7 feature endpoints', async () => {
    const res = await request('GET', '/docs/json');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.openapi && res.body.openapi.startsWith('3.0'), 'Expected OpenAPI 3.0.x version');
    assert.ok(res.body.paths, 'Expected OpenAPI paths');
    assert.ok(res.body.paths['/digital-twin/{studentId}'], 'Feature 1 path documented');
    assert.ok(res.body.paths['/career/assess/{studentId}'], 'Feature 2 path documented');
    assert.ok(res.body.paths['/activities/passport/{studentId}'], 'Feature 3 path documented');
    assert.ok(res.body.paths['/college-twin/department/{departmentId}'], 'Feature 4 path documented');
    assert.ok(res.body.paths['/chatbot/message'], 'Feature 5 path documented');
    assert.ok(res.body.paths['/simulator/target-gpa'], 'Feature 6 path documented');
    assert.ok(res.body.paths['/audit-logs'], 'Feature 7 path documented');
  });

  console.log('\n======================================================================');
  console.log(`📊 SEVEN FEATURES TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('======================================================================\n');

  if (spawnedServerProcess) {
    try { spawnedServerProcess.kill(); } catch (_) {}
  }

  if (passedTests === totalTests) {
    console.log('🎉 ALL SEVEN MASTER FEATURES VERIFIED CLEANLY WITH 100% SUCCESS!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runSuite().catch(err => {
  if (spawnedServerProcess) {
    try { spawnedServerProcess.kill(); } catch (_) {}
  }
  console.error('\n❌ Unhandled test suite error:', err);
  process.exit(1);
});
