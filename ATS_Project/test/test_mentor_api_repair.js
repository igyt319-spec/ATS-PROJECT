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
  return { token: res.data.token, user: res.data.user };
}

async function runMentorApiTests() {
  console.log('======================================================================');
  console.log('🚀 TESTING MENTOR API ENDPOINTS: REPAIR, RBAC & DATA ISOLATION');
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

    console.log('▶️ Authenticating test principals...');
    const mentorA = await login('mentor.cse@ats.com', 'mentor123', 'faculty');
    const student = await login('BITD0001', 'student123', 'student');
    const admin = await login('admin@ats.com', 'admin123', 'admin');
    console.log('   Authenticated: Mentor A (mentor.cse@ats.com), Student (BITD0001), Admin (admin@ats.com)\n');

    // ------------------------------------------------------------------------
    // Group 1: Repaired Mentor Endpoints (HTTP 200 Success & Format Verification)
    // ------------------------------------------------------------------------
    console.log('--- Group 1: Repaired Mentor Endpoints Access & Response Format ---');

    // 1.1 /api/leave/mentor-requests
    const leaveRes = await request(`${BASE_URL}/leave/mentor-requests`, {
      headers: { Authorization: `Bearer ${mentorA.token}` }
    });
    assert.strictEqual(leaveRes.status, 200, '/api/leave/mentor-requests should return HTTP 200');
    assert.strictEqual(leaveRes.data.success, true, 'leave-requests success should be true');
    assert(Array.isArray(leaveRes.data.data), 'leave-requests data must be an array');
    console.log(`✅ PASS: 1.1 GET /api/leave/mentor-requests returned HTTP 200 with ${leaveRes.data.count} mentee records`);

    // 1.2 /api/fees/mentor-overview
    const feeRes = await request(`${BASE_URL}/fees/mentor-overview`, {
      headers: { Authorization: `Bearer ${mentorA.token}` }
    });
    assert.strictEqual(feeRes.status, 200, '/api/fees/mentor-overview should return HTTP 200');
    assert.strictEqual(feeRes.data.success, true, 'fees-overview success should be true');
    assert(Array.isArray(feeRes.data.data), 'fees-overview data must be an array');
    console.log(`✅ PASS: 1.2 GET /api/fees/mentor-overview returned HTTP 200 with ${feeRes.data.count} mentee fee records`);

    // 1.3 /api/activities/mentor-pending
    const actRes = await request(`${BASE_URL}/activities/mentor-pending`, {
      headers: { Authorization: `Bearer ${mentorA.token}` }
    });
    assert.strictEqual(actRes.status, 200, '/api/activities/mentor-pending should return HTTP 200');
    assert.strictEqual(actRes.data.success, true, 'activities-pending success should be true');
    assert(Array.isArray(actRes.data.data), 'activities-pending data must be an array');
    console.log(`✅ PASS: 1.3 GET /api/activities/mentor-pending returned HTTP 200 with ${actRes.data.count} pending activity records`);

    // 1.4 Backward Compatibility Check: /mentor/mentees paths still work
    const leaveCompat = await request(`${BASE_URL}/leave/mentor/mentees`, { headers: { Authorization: `Bearer ${mentorA.token}` } });
    const feeCompat = await request(`${BASE_URL}/fees/mentor/mentees`, { headers: { Authorization: `Bearer ${mentorA.token}` } });
    const actCompat = await request(`${BASE_URL}/activities/mentor/mentees`, { headers: { Authorization: `Bearer ${mentorA.token}` } });
    assert.strictEqual(leaveCompat.status, 200, 'Legacy /leave/mentor/mentees must return 200');
    assert.strictEqual(feeCompat.status, 200, 'Legacy /fees/mentor/mentees must return 200');
    assert.strictEqual(actCompat.status, 200, 'Legacy /activities/mentor/mentees must return 200');
    console.log('✅ PASS: 1.4 Backward compatibility preserved for /mentor/mentees aliases across leave, fees, and activities\n');

    // ------------------------------------------------------------------------
    // Group 2: Empty Result Handling (Must be valid HTTP 200, never 404)
    // ------------------------------------------------------------------------
    console.log('--- Group 2: Empty Results Are Valid Responses (Never 404) ---');
    // Filter with impossible status to verify empty response
    const emptyLeave = await request(`${BASE_URL}/leave/mentor-requests?status=NON_EXISTENT_STATUS`, {
      headers: { Authorization: `Bearer ${mentorA.token}` }
    });
    assert.strictEqual(emptyLeave.status, 200, 'Empty leave results must return HTTP 200');
    assert.strictEqual(emptyLeave.data.success, true);
    assert.strictEqual(emptyLeave.data.count, 0);
    assert.deepStrictEqual(emptyLeave.data.data, []);
    console.log('✅ PASS: 2.1 Empty leave request queries return HTTP 200 with count: 0 and empty array');

    const emptyAct = await request(`${BASE_URL}/activities/mentor-pending?status=NON_EXISTENT_STATUS`, {
      headers: { Authorization: `Bearer ${mentorA.token}` }
    });
    assert.strictEqual(emptyAct.status, 200, 'Empty activity results must return HTTP 200');
    assert.strictEqual(emptyAct.data.success, true);
    assert.strictEqual(emptyAct.data.count, 0);
    assert.deepStrictEqual(emptyAct.data.data, []);
    console.log('✅ PASS: 2.2 Empty activity queries return HTTP 200 with count: 0 and empty array\n');

    // ------------------------------------------------------------------------
    // Group 3: Unauthorized Access & RBAC Enforcement (401 & 403)
    // ------------------------------------------------------------------------
    console.log('--- Group 3: Authentication & Role-Based Authorization Enforcement ---');

    // 3.1 Unauthenticated requests return 401
    const unauthLeave = await request(`${BASE_URL}/leave/mentor-requests`);
    const unauthFee = await request(`${BASE_URL}/fees/mentor-overview`);
    const unauthAct = await request(`${BASE_URL}/activities/mentor-pending`);
    assert.strictEqual(unauthLeave.status, 401, 'Unauthenticated leave request must return 401');
    assert.strictEqual(unauthFee.status, 401, 'Unauthenticated fee overview must return 401');
    assert.strictEqual(unauthAct.status, 401, 'Unauthenticated activity request must return 401');
    console.log('✅ PASS: 3.1 Unauthenticated requests are blocked with HTTP 401');

    // 3.2 Student attempting mentor endpoints returns 403
    const studentLeave = await request(`${BASE_URL}/leave/mentor-requests`, { headers: { Authorization: `Bearer ${student.token}` } });
    const studentFee = await request(`${BASE_URL}/fees/mentor-overview`, { headers: { Authorization: `Bearer ${student.token}` } });
    const studentAct = await request(`${BASE_URL}/activities/mentor-pending`, { headers: { Authorization: `Bearer ${student.token}` } });
    assert.strictEqual(studentLeave.status, 403, 'Student accessing mentor leave requests must return 403');
    assert.strictEqual(studentFee.status, 403, 'Student accessing mentor fee overview must return 403');
    assert.strictEqual(studentAct.status, 403, 'Student accessing mentor pending activities must return 403');
    console.log('✅ PASS: 3.2 Student role attempting mentor endpoints is rejected with HTTP 403');

    // 3.3 Admin attempting mentor endpoints returns 403 (strict operational isolation)
    const adminLeave = await request(`${BASE_URL}/leave/mentor-requests`, { headers: { Authorization: `Bearer ${admin.token}` } });
    const adminFee = await request(`${BASE_URL}/fees/mentor-overview`, { headers: { Authorization: `Bearer ${admin.token}` } });
    const adminAct = await request(`${BASE_URL}/activities/mentor-pending`, { headers: { Authorization: `Bearer ${admin.token}` } });
    assert.strictEqual(adminLeave.status, 403, 'Admin accessing mentor leave requests must return 403');
    assert.strictEqual(adminFee.status, 403, 'Admin accessing mentor fee overview must return 403');
    assert.strictEqual(adminAct.status, 403, 'Admin accessing mentor pending activities must return 403');
    console.log('✅ PASS: 3.3 Administrator is strictly barred from operational mentor endpoints (HTTP 403)\n');

    // ------------------------------------------------------------------------
    // Group 4: Cross-Mentor Data Isolation & Field Mappings
    // ------------------------------------------------------------------------
    console.log('--- Group 4: Cross-Mentor Data Isolation & Schema Mapping ---');

    // Verify activity schema aliases: organization_or_issuer & participation_type
    if (actRes.data.data.length > 0) {
      const firstAct = actRes.data.data[0];
      assert('organization_or_issuer' in firstAct, 'Field organization_or_issuer must be mapped in activity response');
      assert('participation_type' in firstAct, 'Field participation_type must be mapped in activity response');
      console.log('✅ PASS: 4.1 Activity schema aliases (organization_or_issuer, participation_type) verified');
    } else {
      console.log('✅ PASS: 4.1 Activity response structure validated (0 current activities)');
    }

    // Verify mentor mentee scope
    const menteeRes = await request(`${BASE_URL}/mentors/my-mentees`, { headers: { Authorization: `Bearer ${mentorA.token}` } });
    assert.strictEqual(menteeRes.status, 200);
    const assignedStudentIds = new Set((menteeRes.data.data || []).map(m => m.student_id));
    assert(assignedStudentIds.size > 0, 'Mentor A should have assigned mentees');

    // Verify leave requests only belong to assigned mentees
    leaveRes.data.data.forEach(lr => {
      assert(assignedStudentIds.has(lr.student_id), `Leave request #${lr.id} belongs to mentee #${lr.student_id} not assigned to this mentor!`);
    });
    console.log('✅ PASS: 4.2 Leave requests strictly isolated to authenticated mentor\'s active mentees');

    // Verify fee records only belong to assigned mentees
    feeRes.data.data.forEach(fr => {
      assert(assignedStudentIds.has(fr.student_id), `Fee record #${fr.id} belongs to mentee #${fr.student_id} not assigned to this mentor!`);
    });
    console.log('✅ PASS: 4.3 Fee records strictly isolated to authenticated mentor\'s active mentees');

    console.log('\n======================================================================');
    console.log('🎉 ALL MENTOR API ENDPOINT TESTS PASSED WITH 100% SUCCESS!');
    console.log('======================================================================\n');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err);
    process.exit(1);
  } finally {
    if (spawnedServer) {
      try { spawnedServer.kill(); } catch (_) {}
    }
  }
}

runMentorApiTests();
