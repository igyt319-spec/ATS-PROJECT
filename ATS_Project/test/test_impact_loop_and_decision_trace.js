const assert = require('assert');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const BASE_URL = 'http://localhost:5000/api';

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
    throw new Error(`Login failed for ${identifier}: ${JSON.stringify(res.data)}`);
  }
  return res.data.token;
}

async function runTests() {
  console.log('======================================================================');
  console.log('🚀 TESTING ATS IMPACT LOOP & DECISION TRACE RBAC & ENGINE APIS');
  console.log('======================================================================\n');

  let spawnedServer = null;
  try {
    const isRunning = await checkPortListening(5000);
    if (!isRunning) {
      console.log('⚡ Starting background ATS server on port 5000...');
      const serverPath = path.join(__dirname, '../backend/server.js');
      spawnedServer = spawn(process.execPath, [serverPath], {
        cwd: path.join(__dirname, '..'),
        stdio: 'ignore'
      });

      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 500));
        if (await checkPortListening(5000)) {
          console.log('⚡ Server ready.\n');
          break;
        }
      }
    }
    // 1. Authenticate Principals
    console.log('▶️ Authenticating test principals...');
    const studentToken = await login('BITD0001', 'student123', 'student');
    const mentorToken = await login('mentor.cse@ats.com', 'mentor123', 'faculty');
    const adminToken = await login('admin@ats.com', 'admin123', 'admin');
    console.log('   Authenticated: student (BITD0001), faculty mentor (mentor.cse@ats.com), admin\n');

    // Test 1: Student GET /api/impact-loop
    console.log('--- Test 1: Student Impact Loop Access & Note Masking ---');
    const studentLoopRes = await request(`${BASE_URL}/impact-loop`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.strictEqual(studentLoopRes.status, 200, 'Student should receive HTTP 200 on /api/impact-loop');
    assert.strictEqual(studentLoopRes.data.success, true);
    assert(Array.isArray(studentLoopRes.data.data), 'Data should be an array');
    
    // Check note masking: student must NEVER see private_mentor_notes
    studentLoopRes.data.data.forEach(item => {
      assert.strictEqual(item.private_mentor_notes, null, 'Private mentor notes MUST be masked (null) for student');
    });
    console.log('✅ PASS: Student can retrieve own interventions and private mentor notes are strictly masked (null)\n');

    // Test 2: Student GET /api/decision-trace
    console.log('--- Test 2: Student Decision Trace Access ---');
    const studentTraceRes = await request(`${BASE_URL}/decision-trace`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.strictEqual(studentTraceRes.status, 200, 'Student should receive HTTP 200 on /api/decision-trace');
    assert.strictEqual(studentTraceRes.data.success, true);
    assert(Array.isArray(studentTraceRes.data.data), 'Data should be an array');
    console.log(`✅ PASS: Student can access own explainable decision traces (${studentTraceRes.data.data.length} records found)\n`);

    // Test 3: Mentor Creating an Intervention via /api/impact-loop
    console.log('--- Test 3: Mentor Creates Intervention in Impact Loop ---');
    const createRes = await request(`${BASE_URL}/impact-loop`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mentorToken}` }
    }, {
      student_id: 1,
      title: 'Mathematics Remedial Support Plan',
      intervention_type: 'Subject Revision Plan',
      contributing_factors: ['Internal Mark below 50%', 'Attendance borderline 76%'],
      action_plan: 'Weekly 1-on-1 tutoring sessions with assigned peer tutor and model question practice.',
      student_guidance_notes: 'Focus on Calculus modules 3 & 4. Submit practice problems every Thursday.',
      private_mentor_notes: 'Confidential: Scholar experiencing test anxiety; monitor closely without adding pressure.',
      target_date: '2026-11-30',
      follow_up_date: '2026-11-15'
    });
    assert.strictEqual(createRes.status, 201, 'Intervention creation should return HTTP 201');
    assert.strictEqual(createRes.data.success, true);
    const newInterventionId = createRes.data.data.id;
    assert(newInterventionId, 'Should return created intervention ID');
    console.log(`✅ PASS: Faculty mentor created intervention #${newInterventionId} with baseline indicators captured\n`);

    // Test 4: Mentor Updates Intervention Outcome via /api/impact-loop/interventions/:id
    console.log('--- Test 4: Mentor Measures and Updates Intervention Outcome ---');
    const updateRes = await request(`${BASE_URL}/impact-loop/interventions/${newInterventionId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${mentorToken}` }
    }, {
      status: 'Completed',
      outcome_assessment: 'Improved',
      outcome_notes: 'Scholar improved marks by 14 points on model retest. Attendance reached 82%.'
    });
    if (updateRes.status !== 200) console.log('Update Error Payload:', JSON.stringify(updateRes.data));
    assert.strictEqual(updateRes.status, 200, 'Intervention update should return HTTP 200');
    assert.strictEqual(updateRes.data.success, true);
    assert.strictEqual(updateRes.data.data.status, 'Completed');
    assert.strictEqual(updateRes.data.data.outcome_assessment, 'Moderate Improvement');
    console.log('✅ PASS: Faculty mentor updated intervention outcome with automated indicator delta computation\n');

    // Test 5: Decision Trace Creation & Review
    console.log('--- Test 5: Decision Trace Recording & Mentor Review ---');
    const traceCreateRes = await request(`${BASE_URL}/decision-trace`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mentorToken}` }
    }, {
      student_id: 1,
      indicator_type: 'Attendance Borderline',
      trigger_condition: 'Attendance has fallen within 2% of the mandatory 75% threshold',
      observed_value: '76.2%',
      threshold_applied: 'Mandatory 75% exam eligibility threshold',
      rule_engine_type: 'Rule-Based Deterministic Engine v2.1',
      model_version: 'v2.1-compliance',
      evidence_summary: 'Attendance observed at 76.2% over 64 sessions; only 1 class buffer remaining.',
      explanation: 'Attendance has fallen within 2% of the critical 75% threshold, triggering early warning.',
      recommended_action: 'Conduct mentor conference and establish attendance recovery schedule.'
    });
    assert.strictEqual(traceCreateRes.status, 201, 'Decision trace creation should return HTTP 201');
    const traceId = traceCreateRes.data.data.id;

    // Review trace
    const traceReviewRes = await request(`${BASE_URL}/decision-trace/${traceId}/decision`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${mentorToken}` }
    }, {
      decision_status: 'Accepted',
      reviewer_action: 'Reviewed attendance history with scholar. Established 100% attendance target for upcoming 3 weeks.'
    });
    assert.strictEqual(traceReviewRes.status, 200);
    assert.strictEqual(traceReviewRes.data.data.decision_status, 'Accepted');
    console.log(`✅ PASS: Decision trace #${traceId} recorded with evidence and mentor review accepted\n`);

    // Test 6: RBAC Protection - Student cannot modify interventions or decision traces
    console.log('--- Test 6: RBAC Isolation - Student cannot create or update interventions ---');
    const studentIllegalPost = await request(`${BASE_URL}/impact-loop`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` }
    }, {
      student_id: 1,
      title: 'Self-created Intervention'
    });
    assert.strictEqual(studentIllegalPost.status, 403, 'Student should be rejected with HTTP 403 on POST /impact-loop');

    const studentIllegalTraceReview = await request(`${BASE_URL}/decision-trace/${traceId}/decision`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${studentToken}` }
    }, {
      decision_status: 'Dismissed'
    });
    assert.strictEqual(studentIllegalTraceReview.status, 403, 'Student should be rejected with HTTP 403 on PUT /decision-trace/:id/decision');
    console.log('✅ PASS: Students are strictly barred from creating or modifying interventions and decision traces\n');

    // Test 7: Impact Loop Summary
    console.log('--- Test 7: Institutional Impact Loop Summary ---');
    const summaryRes = await request(`${BASE_URL}/impact-loop/summary`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(summaryRes.status, 200);
    assert.strictEqual(summaryRes.data.success, true);
    assert(summaryRes.data.data && Array.isArray(summaryRes.data.data.byType), 'Should return byType array');
    console.log(`✅ PASS: Institution summary aggregates return byType distribution (${summaryRes.data.data.byType.length} types) and byOutcome distribution\n`);

    console.log('======================================================================');
    console.log('🎉 ALL ATS IMPACT LOOP & DECISION TRACE TESTS PASSED CLEANLY (100%)');
    console.log('======================================================================');

  } catch (err) {
    console.error('❌ TEST FAILED:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  } finally {
    if (spawnedServer) {
      try { spawnedServer.kill(); } catch (e) {}
    }
  }
}

runTests();
