const http = require('http');
const net = require('net');
const { spawn } = require('child_process');
const path = require('path');

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
    const payload = body ? JSON.stringify(body) : null;
    const headers = {};
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 5000,
        path,
        method,
        headers
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function verify() {
  await ensureServerRunning();
  console.log('--- Verifying Reported API Endpoints ---');

  // 1. Authenticate HOD
  const hodLogin = await request('POST', '/api/auth/login', {
    identifier: 'faculty.cse@example.test',
    password: 'faculty123',
    role: 'hod'
  });
  if (hodLogin.status !== 200 || !hodLogin.body.token) {
    console.error('Failed to log in as HOD:', hodLogin);
    if (spawnedServerProcess) spawnedServerProcess.kill();
    process.exit(1);
  }
  const hodToken = hodLogin.body.token;

  // 2. Authenticate Mentor
  const mentorLogin = await request('POST', '/api/auth/login', {
    identifier: 'mentor.cse@ats.com',
    password: 'mentor123',
    role: 'faculty'
  });
  const mentorToken = mentorLogin.body.token;

  // 3. Authenticate Admin
  const adminLogin = await request('POST', '/api/auth/login', {
    identifier: 'admin@ats.com',
    password: 'admin123',
    role: 'admin'
  });
  const adminToken = adminLogin.body.token;

  // Test 1: GET /api/results/department-records (Reported Bug 1)
  const res1 = await request('GET', '/api/results/department-records', null, hodToken);
  console.log('1. GET /api/results/department-records -> Status:', res1.status, 'Success:', res1.body?.success, 'Count:', res1.body?.count);
  if (res1.status !== 200 || !res1.body?.success) {
    console.error('FAILED /api/results/department-records', res1.body);
    process.exit(1);
  }

  // Test 2: GET /api/college-twin/department-summary (Reported Bug 2)
  const res2 = await request('GET', '/api/college-twin/department-summary', null, hodToken);
  console.log('2. GET /api/college-twin/department-summary -> Status:', res2.status, 'Success:', res2.body?.success, 'AvgCGPA:', res2.body?.data?.averageCgpa, 'Dept:', res2.body?.data?.departmentName);
  if (res2.status !== 200 || !res2.body?.success || !res2.body?.data?.departmentName) {
    console.error('FAILED /api/college-twin/department-summary', res2.body);
    process.exit(1);
  }

  // Test 3: GET /api/results/mentor-mentees
  const res3 = await request('GET', '/api/results/mentor-mentees', null, mentorToken);
  console.log('3. GET /api/results/mentor-mentees -> Status:', res3.status, 'Success:', res3.body?.success, 'Count:', res3.body?.count);
  if (res3.status !== 200 || !res3.body?.success) {
    console.error('FAILED /api/results/mentor-mentees', res3.body);
    process.exit(1);
  }

  // Test 4: GET /api/college-twin/institutional-summary
  const res4 = await request('GET', '/api/college-twin/institutional-summary', null, adminToken);
  console.log('4. GET /api/college-twin/institutional-summary -> Status:', res4.status, 'Success:', res4.body?.success, 'TotalDepts:', res4.body?.data?.totalDepartments);
  if (res4.status !== 200 || !res4.body?.success || typeof res4.body?.data?.totalDepartments !== 'number') {
    console.error('FAILED /api/college-twin/institutional-summary', res4.body);
    process.exit(1);
  }

  console.log('\nAll 4 endpoints verified successfully!');
  if (spawnedServerProcess) spawnedServerProcess.kill();
  process.exit(0);
}

verify().catch(err => {
  console.error('Verification error:', err);
  if (spawnedServerProcess) spawnedServerProcess.kill();
  process.exit(1);
});
