const http = require('http');

function api(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const testPort = parseInt(process.env.PORT, 10) || 5000;
    const req = http.request({
      hostname: 'localhost',
      port: testPort,
      path,
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runSuite() {
  const results = [];
  function assert(name, condition, extra = '') {
    results.push({ name, passed: Boolean(condition), extra });
    console.log((condition ? 'PASS: ' : 'FAIL: ') + name + (extra ? ' (' + extra + ')' : ''));
  }

  console.log('=== ATS VERIFICATION TEST SUITE ===\n');

  // 1. Health check
  const health = await api('GET', '/api/health');
  assert('Health Check status 200', health.status === 200);
  assert('Health Check status online', health.body.status === 'online');
  assert('Health Check reports accurate DB status', health.body.database !== undefined, 'isMySQL: ' + health.body.database?.isMySQL + ', mode: ' + health.body.database?.mode);

  // 2. Student BITD0001 Login
  const sLog = await api('POST', '/api/auth/login', { identifier: 'BITD0001', password: 'student123', role: 'student' });
  assert('Student BITD0001 Login', sLog.status === 200 && sLog.body.success, 'user: ' + sLog.body.user?.name);
  const sToken = sLog.body.token;
  const studentId = sLog.body.user?.studentId || 1;

  // 3. Admin Login
  const aLog = await api('POST', '/api/auth/login', { identifier: 'admin@ats.com', password: 'admin123', role: 'admin' });
  assert('Admin Login', aLog.status === 200 && aLog.body.success, 'user: ' + aLog.body.user?.name);
  const aToken = aLog.body.token;

  // 4. Faculty Login
  const fLog = await api('POST', '/api/auth/login', { identifier: 'faculty.cse@example.test', password: 'faculty123', role: 'faculty' });
  assert('Faculty Login', fLog.status === 200 && fLog.body.success, 'user: ' + fLog.body.user?.name);
  const fToken = fLog.body.token;

  // 5. Invalid Login (Wrong password)
  const badLog = await api('POST', '/api/auth/login', { identifier: 'BITD0001', password: 'wrongpassword', role: 'student' });
  assert('Invalid Login rejected with 401', badLog.status === 401 && !badLog.body.success, 'msg: ' + badLog.body.message);

  // 6. Student Dashboard (/api/dashboard/:id)
  const dash = await api('GET', '/api/dashboard/' + studentId, null, sToken);
  assert('Student Dashboard loaded', dash.status === 200 && dash.body.success);
  assert('Student Dashboard KPI verified', dash.body.kpi && dash.body.kpi.gpa > 0, 'GPA: ' + dash.body.kpi?.gpa);

  // 7. Admin Dashboard Summary (/api/dashboard/admin/summary)
  const adminDash = await api('GET', '/api/dashboard/admin/summary', null, aToken);
  assert('Admin Dashboard summary loaded', adminDash.status === 200 && adminDash.body.success);
  assert('Admin Dashboard stats populated', adminDash.body.stats?.totalStudents > 0, 'Students: ' + adminDash.body.stats?.totalStudents);

  // 8. Performance Records (/api/performance/:studentId)
  const perf = await api('GET', '/api/performance/' + studentId, null, sToken);
  assert('Performance marks loaded', perf.status === 200 && perf.body.count > 0, 'count: ' + perf.body.count);

  // 9. Attendance Records (/api/attendance/:studentId)
  const att = await api('GET', '/api/attendance/' + studentId, null, sToken);
  assert('Attendance loaded', att.status === 200 && att.body.success, 'overall: ' + att.body.overallPercentage + '%');

  // 10. Achievements (/api/achievements/:studentId)
  const ach = await api('GET', '/api/achievements/' + studentId, null, sToken);
  assert('Achievements loaded', ach.status === 200 && ach.body.count > 0, 'count: ' + ach.body.count);

  // 11. Recommendations (/api/recommendations/:studentId)
  const rec = await api('GET', '/api/recommendations/' + studentId, null, sToken);
  assert('Recommendations loaded', rec.status === 200 && rec.body.count > 0, 'count: ' + rec.body.count);

  // 12. Notifications (/api/notifications/:studentId)
  const notif = await api('GET', '/api/notifications/' + studentId, null, sToken);
  assert('Notifications loaded', notif.status === 200 && notif.body.count > 0, 'count: ' + notif.body.count);

  // 13. Students Directory (/api/students)
  const stList = await api('GET', '/api/students', null, fToken);
  assert('Students Directory loaded for Faculty', stList.status === 200 && stList.body.count > 0, 'count: ' + stList.body.count);
  const stListAdmin = await api('GET', '/api/students', null, aToken);
  assert('Students Directory blocked for Admin with 403', stListAdmin.status === 403);

  // 14. Departments and Subjects catalog
  const depts = await api('GET', '/api/departments');
  const subs = await api('GET', '/api/subjects');
  assert('Departments Catalog loaded', depts.status === 200 && depts.body.count > 0, 'count: ' + depts.body.count);
  assert('Subjects Catalog loaded', subs.status === 200 && subs.body.count > 0, 'count: ' + subs.body.count);

  // 15. AI Statistical Analysis (/api/ai/analysis/:studentId)
  const aiAnalysis = await api('GET', '/api/ai/analysis/' + studentId, null, sToken);
  assert('AI Analysis endpoint response', aiAnalysis.status === 200 && aiAnalysis.body.success, 'source: ' + aiAnalysis.body.source);

  // 16. AI Heuristic Agent Scan (/api/ai/run-agent)
  const aiAgent = await api('POST', '/api/ai/run-agent', { student_id: studentId }, sToken);
  assert('AI Heuristic Agent run', aiAgent.status === 200 && aiAgent.body.success, 'alerts: ' + (aiAgent.body.data?.alerts_generated ?? 'ok'));

  // 17. Chatbot Message (/api/chatbot/message)
  const chat = await api('POST', '/api/chatbot/message', { studentId, message: 'What are my weak subjects?' }, sToken);
  assert('Chatbot responds contextually', chat.status === 200 && chat.body.success && chat.body.reply?.length > 10);

  // 18. Write Operation & Read-Back Verification
  console.log('\n--- Testing Write & Read-back ---');
  const testTitle = 'Test Achievement ' + Date.now();
  const addAch = await api('POST', '/api/achievements', {
    student_id: studentId,
    title: testTitle,
    category: 'Paper Presentation',
    achievement_date: '2026-10-09',
    description: 'Automated test achievement',
    certificate_url: 'https://example.com/test'
  }, sToken);
  assert('Write: Add Achievement', (addAch.status === 200 || addAch.status === 201) && addAch.body.success);

  const achAfter = await api('GET', '/api/achievements/' + studentId, null, sToken);
  const found = achAfter.body.data?.some(a => a.title === testTitle);
  assert('Read-Back: New Achievement persisted in store', found === true, 'Found newly created record');

  // Update recommendation write & read-back
  const updateRec = await api('PUT', '/api/recommendations/1', { status: 'Completed' }, sToken);
  assert('Write: Update Recommendation status', updateRec.status === 200 && updateRec.body.success);

  const recAfter = await api('GET', '/api/recommendations/' + studentId, null, sToken);
  const rec1 = recAfter.body.data?.find(r => r.id === 1);
  assert('Read-Back: Updated Recommendation status persisted', rec1?.status === 'Completed', 'status: ' + rec1?.status);

  // Mark notification read write & read-back
  const markNotif = await api('PUT', '/api/notifications/1/read', {}, sToken);
  assert('Write: Mark Notification as Read', markNotif.status === 200 && markNotif.body.success);

  // 19. Protected route test without token
  const unauth = await api('GET', '/api/dashboard/1');
  assert('Protected route blocks unauthenticated requests with 401', unauth.status === 401);

  // 20. Static Pages Accessibility
  const pages = ['login.html', 'dashboard.html', 'admin-dashboard.html', 'performance.html', 'attendance.html', 'achievements.html', 'recommendations.html', 'chatbot.html', 'students.html'];
  for (const page of pages) {
    const pageRes = await api('GET', '/' + page);
    assert('Static page ' + page + ' returns 200', pageRes.status === 200);
  }

  const passCount = results.filter(r => r.passed).length;
  console.log('\n======================================================');
  console.log(`TEST SUITE RESULT: ${passCount}/${results.length} TESTS PASSED`);
  console.log('======================================================');
  if (passCount !== results.length) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Test suite execution failed:', err);
  process.exit(1);
});
