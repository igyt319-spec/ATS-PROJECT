const assert = require('assert');
const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const pool = require('../backend/config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'ats_super_secret_jwt_key_2026_demo';
const BASE_PORT = process.env.PORT || 5000;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: BASE_PORT,
      path,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runPhase1Tests() {
  console.log('===============================================================');
  console.log('=== PHASE 1 REGRESSION TEST SUITE: MINI-DASHBOARD AUTH & NAV ===');
  console.log('===============================================================');

  // Query actual student and assigned mentor
  const [pairs] = await pool.query(`
    SELECT s.id as student_id, s.department_id, s.user_id as student_user_id,
           f.id as faculty_id, f.department_id as faculty_dept_id, f.user_id as faculty_user_id
    FROM student_mentors sm
    JOIN students s ON sm.student_id = s.id
    JOIN faculty f ON sm.faculty_id = f.id
    WHERE sm.status = 'active'
    LIMIT 1
  `);

  assert(pairs.length > 0, 'Must have at least one active student-mentor relationship');
  const { student_id, student_user_id, faculty_id, faculty_user_id, department_id } = pairs[0];

  // Tokens
  const studentToken = jwt.sign({ id: student_user_id, role: 'student', studentId: student_id }, JWT_SECRET, { expiresIn: '1h' });
  const otherStudentToken = jwt.sign({ id: 9999, role: 'student', studentId: 9999 }, JWT_SECRET, { expiresIn: '1h' });
  const mentorToken = jwt.sign({ id: faculty_user_id, role: 'faculty', facultyId: faculty_id, facultyRole: 'mentor' }, JWT_SECRET, { expiresIn: '1h' });
  const adminToken = jwt.sign({ id: 1, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });

  // 1. Missing Authorization Header -> 401
  const noAuthRes = await request(`/api/students/${student_id}/mini-dashboard`);
  assert.strictEqual(noAuthRes.status, 401, 'Request without Authorization header must return HTTP 401');
  assert.strictEqual(noAuthRes.data.message, 'Access denied. Valid Bearer token required in Authorization header.');
  console.log('✅ PASS: 1.1 Missing Authorization header rejected with exact Bearer token error (HTTP 401)');

  // 2. Malformed Authorization Header -> 401
  const malformedRes = await request(`/api/students/${student_id}/mini-dashboard`, {
    headers: { 'Authorization': 'Basic dXNlcjpwYXNz' }
  });
  assert.strictEqual(malformedRes.status, 401, 'Request with non-Bearer header must return HTTP 401');
  assert.strictEqual(malformedRes.data.message, 'Access denied. Valid Bearer token required in Authorization header.');
  console.log('✅ PASS: 1.2 Non-Bearer Authorization header rejected with HTTP 401');

  // 3. Duplicate Bearer prefix handled safely (rejected cleanly with 401, not 500)
  const duplicateBearerRes = await request(`/api/students/${student_id}/mini-dashboard`, {
    headers: { 'Authorization': `Bearer Bearer ${studentToken}` }
  });
  assert.strictEqual(duplicateBearerRes.status, 401, 'Duplicate Bearer prefix must return HTTP 401');
  console.log('✅ PASS: 1.3 Duplicate Bearer prefix rejected cleanly with HTTP 401');

  // 4. Student accessing own mini-dashboard -> 200
  const studentSelfRes = await request(`/api/students/${student_id}/mini-dashboard`, {
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  assert.strictEqual(studentSelfRes.status, 200, 'Student viewing own mini-dashboard must succeed');
  assert(studentSelfRes.data.success, 'Response must be success');
  assert.strictEqual(studentSelfRes.data.data.student.id, student_id, 'Returned student ID must match');
  console.log('✅ PASS: 1.4 Student viewing own mini-dashboard succeeds (HTTP 200)');

  // 5. Student accessing another student's mini-dashboard -> 403
  const idorRes = await request(`/api/students/${student_id}/mini-dashboard`, {
    headers: { 'Authorization': `Bearer ${otherStudentToken}` }
  });
  assert.strictEqual(idorRes.status, 403, 'Student viewing another student mini-dashboard must return HTTP 403');
  console.log('✅ PASS: 1.5 IDOR protection: Student attempting another student mini-dashboard blocked (HTTP 403)');

  // 6. Assigned mentor accessing mentee mini-dashboard -> 200
  const mentorRes = await request(`/api/students/${student_id}/mini-dashboard`, {
    headers: { 'Authorization': `Bearer ${mentorToken}` }
  });
  assert.strictEqual(mentorRes.status, 200, 'Assigned mentor viewing mentee mini-dashboard must succeed');
  assert.strictEqual(mentorRes.data.data.student.id, student_id, 'Returned student ID must match');
  console.log('✅ PASS: 1.6 Assigned mentor viewing mentee mini-dashboard succeeds (HTTP 200)');

  // 7. Admin strictly blocked from student mini-dashboard -> 403
  const adminStudentRes = await request(`/api/students/${student_id}/mini-dashboard`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(adminStudentRes.status, 403, 'Admin viewing student mini-dashboard must return HTTP 403');
  console.log('✅ PASS: 1.7 Admin operational boundary: Admin blocked from student mini-dashboard (HTTP 403)');

  // 8. Admin strictly blocked from faculty mini-dashboard -> 403
  const adminFacultyRes = await request(`/api/departments/faculty/${faculty_id}/mini-dashboard`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(adminFacultyRes.status, 403, 'Admin viewing faculty mini-dashboard must return HTTP 403');
  console.log('✅ PASS: 1.8 Admin operational boundary: Admin blocked from faculty mini-dashboard (HTTP 403)');

  // 9. Faculty viewing own mini-dashboard -> 200
  const facultySelfRes = await request(`/api/departments/faculty/${faculty_id}/mini-dashboard`, {
    headers: { 'Authorization': `Bearer ${mentorToken}` }
  });
  assert.strictEqual(facultySelfRes.status, 200, 'Faculty viewing own mini-dashboard must return HTTP 200');
  assert.strictEqual(facultySelfRes.data.data.faculty.id, faculty_id, 'Faculty ID must match');
  console.log('✅ PASS: 1.9 Faculty viewing own mini-dashboard profile succeeds (HTTP 200)');

  console.log('===============================================================');
  console.log('=== PHASE 1 TEST SUITE COMPLETE: ALL 9 ASSERTIONS PASSED! ===');
  console.log('===============================================================');
}

runPhase1Tests()
  .catch(err => {
    console.error('Phase 1 test failure:', err);
    process.exit(1);
  })
  .finally(() => process.exit());
