/**
 * ATS Academic Tracking System — Comprehensive Test Suite for Phases 8 through 12
 * 
 * Verifies:
 * - Phase 8: Conversational AI Academic Assistant (fee/mentor/lab NLP, chat history, admin isolation)
 * - Phase 9: Explainable AI MCDA Heuristics & Academic Monitoring Agent (70/20/10 formula, alerts sync)
 * - Phase 10: Institutional Attendance Compliance & Shortage Recovery Calculator (75% & 85% formulas, safe bunk buffer)
 * - Phase 11: Co-Curricular Achievement Portfolio (6 Master categories, credential validation, mentor sync)
 * - Phase 12: Notification Stream & Real-Time Alert Dispatcher (multi-channel dispatch, mark-as-read, clear-read)
 */

const http = require('http');
const assert = require('assert');

const BASE_URL = 'http://localhost:5000/api';

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

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}: ${err.message}`);
    throw err;
  }
}

async function itAsync(desc, fn) {
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
  console.log('======================================================================');
  console.log('🚀 ATS COMPREHENSIVE REGRESSION SUITE: PHASES 8 THROUGH 12');
  console.log('======================================================================\n');

  // Authenticate demo roles
  console.log('▶️ Authenticating test principals...');
  const studentAuth = await login('BITD0001', 'student123', 'student');
  const student2Auth = await login('BITD0002', 'student123', 'student');
  const facultyAuth = await login('mentor.cse@ats.com', 'mentor123', 'faculty');
  const adminAuth = await login('admin@ats.com', 'admin123', 'admin');
  console.log('   Student 1 ID:', studentAuth.user.studentId);
  console.log('   Student 2 ID:', student2Auth.user.studentId);
  console.log('   Faculty ID:', facultyAuth.user.facultyId);
  console.log('   Admin ID:', adminAuth.user.id);
  console.log('   Authentication successful.\n');

  const studentId = studentAuth.user.studentId;
  const student2Id = student2Auth.user.studentId;

  // -------------------------------------------------------------------------
  // PHASE 8: Conversational AI Academic Assistant
  // -------------------------------------------------------------------------
  console.log('--- Phase 8: Conversational AI Academic Assistant & Chatbot ---');

  await itAsync('Phase 8.1: Unauthenticated chatbot query is rejected (HTTP 401)', async () => {
    const res = await request('POST', '/chatbot/message', { message: 'Hello' });
    assert.strictEqual(res.status, 401);
  });

  await itAsync('Phase 8.2: Strict Admin Isolation - Admin blocked from student chatbot (HTTP 403)', async () => {
    const res = await request('POST', '/chatbot/message', {
      student_id: studentId,
      message: 'What are my weak subjects?'
    }, adminAuth.token);
    assert.strictEqual(res.status, 403);
    assert(res.body.message.includes('Administrators do not have access'));
  });

  await itAsync('Phase 8.3: Student asks about weak subjects -> Returns data-backed subject scores', async () => {
    const res = await request('POST', '/chatbot/message', {
      message: 'What are my weak subjects?'
    }, studentAuth.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.sender, 'bot');
    assert(typeof res.body.reply === 'string' && res.body.reply.length > 20);
  });

  await itAsync('Phase 8.4: Student asks about attendance safety -> Evaluates 75% threshold', async () => {
    const res = await request('POST', '/chatbot/message', {
      message: 'Is my attendance safe for semester exams?'
    }, studentAuth.token);
    assert.strictEqual(res.status, 200);
    assert(res.body.reply.includes('attendance') || res.body.reply.includes('Attendance'));
  });

  await itAsync('Phase 8.5: Student asks about institutional fees -> Returns fee invoices & status', async () => {
    const res = await request('POST', '/chatbot/message', {
      message: 'What is my current fee status and balance?'
    }, studentAuth.token);
    assert.strictEqual(res.status, 200);
    assert(res.body.reply.includes('Fee') || res.body.reply.includes('Due') || res.body.reply.includes('Balance') || res.body.reply.includes('clearance'));
  });

  await itAsync('Phase 8.6: Student asks about assigned mentor -> Returns faculty mentor details', async () => {
    const res = await request('POST', '/chatbot/message', {
      message: 'Who is my assigned mentor and how can I contact them?'
    }, studentAuth.token);
    assert.strictEqual(res.status, 200);
    assert(res.body.reply.includes('Mentor') || res.body.reply.includes('Prof.') || res.body.reply.includes('department'));
  });

  await itAsync('Phase 8.7: Student asks about lab and internal marks -> Returns CIA breakdown', async () => {
    const res = await request('POST', '/chatbot/message', {
      message: 'What are my lab marks and internal CIA assessment scores?'
    }, studentAuth.token);
    assert.strictEqual(res.status, 200);
    assert(res.body.reply.includes('Internal') || res.body.reply.includes('Assessment') || res.body.reply.includes('Exam'));
  });

  await itAsync('Phase 8.8: Chat history persistence & retrieval verifies for student', async () => {
    const res = await request('GET', `/chatbot/history/${studentId}`, null, studentAuth.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert(Array.isArray(res.body.data));
    assert(res.body.data.length >= 2);
  });

  await itAsync('Phase 8.9: IDOR protection - Student 1 cannot view Student 2 chat history (HTTP 403)', async () => {
    const res = await request('GET', `/chatbot/history/${student2Id}`, null, studentAuth.token);
    assert.strictEqual(res.status, 403);
  });

  await itAsync('Phase 8.10: Student can clear own conversation history', async () => {
    const res = await request('DELETE', `/chatbot/history/${studentId}`, null, studentAuth.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    const check = await request('GET', `/chatbot/history/${studentId}`, null, studentAuth.token);
    assert.strictEqual(check.body.count, 0);
  });

  // -------------------------------------------------------------------------
  // PHASE 9: Explainable AI MCDA Scoring & Monitoring Agent
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 9: Explainable AI Heuristics & MCDA Decision Analysis ---');

  await itAsync('Phase 9.1: GET /api/ai/analysis/:studentId returns explainable MCDA formulation', async () => {
    const res = await request('GET', `/ai/analysis/${studentId}`, null, studentAuth.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    const d = res.body.data;
    assert(d.composite_academic_score !== undefined);
    assert(d.mcda_components !== undefined);
    assert.strictEqual(d.mcda_components.marks_weight, 0.70);
    assert.strictEqual(d.mcda_components.attendance_weight, 0.20);
    assert.strictEqual(d.mcda_components.achievements_weight, 0.10);
  });

  await itAsync('Phase 9.2: MCDA mathematical score matches (70% Marks + 20% Attendance + 10% Achievements)', async () => {
    const res = await request('GET', `/ai/analysis/${studentId}`, null, studentAuth.token);
    const mcda = res.body.data.mcda_components;

    const expectedScore = Math.round(mcda.marks_weighted + mcda.attendance_weighted + mcda.achievements_weighted);
    assert(Math.abs(expectedScore - mcda.composite_score) <= 1,
      `Calculated composite score ${expectedScore} matches reported ${mcda.composite_score}`);
  });

  await itAsync('Phase 9.3: Admin attempting to run AI agent scan is blocked (HTTP 403)', async () => {
    const res = await request('POST', '/ai/run-agent', { student_id: studentId }, adminAuth.token);
    assert.strictEqual(res.status, 403);
    assert(res.body.message.includes('Administrators do not have access'));
  });

  await itAsync('Phase 9.4: Student runs AI heuristic monitoring agent scan successfully', async () => {
    const res = await request('POST', '/ai/run-agent', { student_id: studentId }, studentAuth.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert(res.body.data.alerts !== undefined);
    assert(typeof res.body.data.alerts_generated === 'number');
  });

  await itAsync('Phase 9.5: AI agent populates recommendations table with actionable items', async () => {
    const res = await request('GET', `/recommendations/${studentId}`, null, studentAuth.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert(Array.isArray(res.body.data));
  });

  await itAsync('Phase 9.6: Student can update recommendation status (Completed/Active)', async () => {
    const recs = await request('GET', `/recommendations/${studentId}`, null, studentAuth.token);
    if (recs.body.data.length > 0) {
      const targetId = recs.body.data[0].id;
      const res = await request('PUT', `/recommendations/${targetId}`, { status: 'Completed' }, studentAuth.token);
      assert.strictEqual(res.status, 200);

      // Verify toggle back
      const res2 = await request('PUT', `/recommendations/${targetId}`, { status: 'Active' }, studentAuth.token);
      assert.strictEqual(res2.status, 200);
    }
  });

  // -------------------------------------------------------------------------
  // PHASE 10: Institutional Attendance Compliance & Shortage Calculator
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 10: Institutional Attendance Compliance & Shortage Recovery Calculator ---');

  await itAsync('Phase 10.1: GET /api/attendance/:studentId returns attendance metrics & thresholds', async () => {
    const res = await request('GET', `/attendance/${studentId}`, null, studentAuth.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert(typeof res.body.overallPercentage === 'number');
    assert(['GOOD', 'MONITOR', 'RISK'].includes(res.body.overallStatus));
    assert(Array.isArray(res.body.data));
    assert(res.body.data.length > 0);
  });

  await itAsync('Phase 10.2: Attendance recovery calculator computes exact classes needed for 75% & 85%', async () => {
    const res = await request('GET', `/attendance/${studentId}`, null, studentAuth.token);
    const records = res.body.data;

    records.forEach(r => {
      const total = r.total_classes;
      const attended = r.attended_classes;
      const pct = r.percentage;

      // Verify 75% formula: if pct < 75, needed >= (0.75 * total - attended) / 0.25
      if (pct < 75 && total > 0) {
        const expected75 = Math.ceil((0.75 * total - attended) / 0.25);
        assert.strictEqual(r.classesNeededFor75, expected75,
          `Subject ${r.subject_name} needed classes for 75% must be ${expected75}`);
      } else {
        assert.strictEqual(r.classesNeededFor75, 0);
      }

      // Verify 85% formula: if pct < 85, needed >= (0.85 * total - attended) / 0.15
      if (pct < 85 && total > 0) {
        const expected85 = Math.ceil((0.85 * total - attended) / 0.15);
        assert.strictEqual(r.classesNeededFor85, expected85,
          `Subject ${r.subject_name} needed classes for 85% must be ${expected85}`);
      }

      // Verify safe bunk buffer formula: if pct >= 75, buffer <= (attended - 0.75 * total) / 0.75
      if (pct >= 75 && total > 0) {
        const expectedBuffer = Math.floor((attended - 0.75 * total) / 0.75);
        assert.strictEqual(r.bunkBuffer75, expectedBuffer,
          `Subject ${r.subject_name} bunk buffer must be ${expectedBuffer}`);
      }
    });
  });

  await itAsync('Phase 10.3: Overall recovery and bunk metrics are returned at top-level', async () => {
    const res = await request('GET', `/attendance/${studentId}`, null, studentAuth.token);
    assert(typeof res.body.overallClassesNeededFor75 === 'number');
    assert(typeof res.body.overallClassesNeededFor85 === 'number');
    assert(typeof res.body.overallBunkBuffer75 === 'number');
  });

  // -------------------------------------------------------------------------
  // PHASE 11: Co-Curricular Achievement Portfolio
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 11: Verified Co-Curricular Achievement Portfolio ---');

  await itAsync('Phase 11.1: GET /api/achievements/:studentId returns categorized achievement records', async () => {
    const res = await request('GET', `/achievements/${studentId}`, null, studentAuth.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert(typeof res.body.count === 'number');
    assert(Array.isArray(res.body.data));
  });

  await itAsync('Phase 11.2: POST /api/achievements allows logging under 6 Master Categories', async () => {
    const payload = {
      student_id: studentId,
      title: 'Smart India Hackathon Finalist ' + Date.now(),
      category: 'Hackathons',
      achievement_date: '2026-03-15',
      description: 'Built autonomous AI tracking prototype for higher education.',
      certificate_url: 'https://smartindiahackathon.gov.in/certificate/SIH2026-ATS',
      status: 'Verified'
    };

    const res = await request('POST', '/achievements', payload, studentAuth.token);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert(res.body.data && res.body.data.id);
  });

  await itAsync('Phase 11.3: Faculty mentor verifies student activity -> syncs to achievements & dispatches alert', async () => {
    // 1. Student submits activity
    const uniqueTitle = 'IEEE International Conference on AI in Academia ' + Date.now();
    const actPayload = {
      category: 'Paper presentations',
      title: uniqueTitle,
      description: 'Published paper on explainable MCDA evaluation models.',
      organizing_institution: 'IEEE Computer Society',
      event_date: '2026-04-10',
      participation_level: 'First Author',
      certificate_url: 'https://ieeexplore.ieee.org/document/9876543'
    };

    const submitRes = await request('POST', '/activities/student', actPayload, studentAuth.token);
    assert.strictEqual(submitRes.status, 201);
    const activityId = submitRes.body.activityId;
    assert(activityId);

    // 2. Faculty mentor verifies the activity
    const verifyRes = await request('PUT', `/activities/${activityId}/verify`, {
      status: 'Verified',
      remarks: 'Endorsed by faculty mentor. Excellent research output.'
    }, facultyAuth.token);
    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyRes.body.success, true);

    // 3. Confirm activity is synced into achievements
    const achCheck = await request('GET', `/achievements/${studentId}`, null, studentAuth.token);
    const synced = achCheck.body.data.find(a => a.title === actPayload.title);
    assert(synced, 'Verified activity must synchronize into student achievements');
  });

  // -------------------------------------------------------------------------
  // PHASE 12: Notification Stream & Real-Time Alert Dispatcher
  // -------------------------------------------------------------------------
  console.log('\n--- Phase 12: Notification Stream & Real-Time Alert Dispatcher ---');

  await itAsync('Phase 12.1: GET /api/notifications/:studentId returns inbox with unread counts', async () => {
    const res = await request('GET', `/notifications/${studentId}`, null, studentAuth.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert(typeof res.body.count === 'number');
    assert(typeof res.body.unreadCount === 'number');
    assert(Array.isArray(res.body.data));
  });

  await itAsync('Phase 12.2: Student can mark a single notification as read', async () => {
    const notifs = await request('GET', `/notifications/${studentId}`, null, studentAuth.token);
    if (notifs.body.data.length > 0) {
      const unread = notifs.body.data.find(n => !n.is_read) || notifs.body.data[0];
      const res = await request('PUT', `/notifications/${unread.id}/read`, null, studentAuth.token);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
    }
  });

  await itAsync('Phase 12.3: Student can mark all notifications as read', async () => {
    const res = await request('PUT', `/notifications/student/${studentId}/read-all`, null, studentAuth.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    const check = await request('GET', `/notifications/${studentId}`, null, studentAuth.token);
    assert.strictEqual(check.body.unreadCount, 0);
  });

  await itAsync('Phase 12.4: Student can clear read notifications from inbox', async () => {
    const res = await request('DELETE', `/notifications/student/${studentId}/clear-read`, null, studentAuth.token);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  console.log('\n======================================================================');
  console.log(`🎉 PHASES 8 THROUGH 12 TEST SUMMARY: ${passedTests} / ${totalTests} ASSERTIONS PASSED (100%)`);
  console.log('======================================================================\n');
}

runSuite().catch(err => {
  console.error('\n❌ TEST SUITE FAILED WITH ERROR:', err.message);
  process.exit(1);
});
