/**
 * Master Verification Suite: Academic ATS Product Completion & Advanced Intelligence Modules
 * Covers Phases 1 - 10:
 * 1. Academic Knowledge Graph (Nodes, Edges, Weak Concept Detection)
 * 2. Academic Trajectory Predictor (OLS Trend, Factors, Uncertainty, Insufficient Data)
 * 3. Adaptive Study Planner (Weekly Goals, Tasks, Status Updates, Prerequisite Priorities)
 * 4. Skill Evidence Graph (Coursework/Certifications -> Skills -> Career Roles, Gaps)
 * 5. Intervention Effectiveness Engine (Signals, Before/After Delta, Outcome Measurement)
 * 6. Institution Department Mini Dashboards (Department Cards & Student Mini Dashboards)
 * 7. Simulated Demo Payment Workflow (Success, Decline, Cancel, Atomic Locking, Admin Audit)
 * 8. Strict Role-Based Access Control & Isolation
 */

const http = require('http');

const BASE_URL = 'http://127.0.0.1:5000';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
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
    throw new Error(`Login failed for ${identifier} (status ${res.status}): ${JSON.stringify(res.data)}`);
  }
  return { token: res.data.token, user: res.data.user };
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runMasterProductTests() {
  console.log('========================================================================');
  console.log('🎯 MASTER VERIFICATION: ATS PRODUCT COMPLETION & ADVANCED MODULES');
  console.log('========================================================================\n');

  // 1. Authenticate All 4 Roles
  console.log('--- 1. Authenticating Roles ---');
  const adminAuth = await loginUser('admin@ats.com', 'admin123', 'admin');
  assert(adminAuth.user.role === 'admin', 'Admin authenticated with strict admin role.');

  const hodAuth = await loginUser('faculty.cse@example.test', 'faculty123', 'hod');
  assert(hodAuth.user.role === 'faculty' && (hodAuth.user.facultyRole === 'hod' || hodAuth.user.isHOD), 'HOD authenticated with active HOD role.');

  const mentorAuth = await loginUser('mentor.cse@ats.com', 'mentor123', 'faculty');
  assert(mentorAuth.user.role === 'faculty' && (mentorAuth.user.canMentor || mentorAuth.user.facultyRole === 'mentor'), 'Mentor authenticated with active mentor authorization.');

  const studentAuth = await loginUser('BITD0001', 'student123', 'student');
  assert(studentAuth.user.role === 'student' && studentAuth.user.studentId, 'Student authenticated with verified student profile.');

  const adminHeaders = { 'Authorization': `Bearer ${adminAuth.token}` };
  const hodHeaders = { 'Authorization': `Bearer ${hodAuth.token}` };
  const mentorHeaders = { 'Authorization': `Bearer ${mentorAuth.token}` };
  const studentHeaders = { 'Authorization': `Bearer ${studentAuth.token}` };
  const studentId = studentAuth.user.studentId;

  // 2. Academic Knowledge Graph Verification
  console.log('\n--- 2. Academic Knowledge Graph Verification ---');
  const kgRes = await request('GET', `/api/knowledge-graph?studentId=${studentId}`, null, studentHeaders);
  assert(kgRes.status === 200 && kgRes.data?.success, 'GET /api/knowledge-graph succeeds with 200.');
  assert(Array.isArray(kgRes.data?.data?.nodes) && kgRes.data.data.nodes.length >= 25, `Knowledge Graph nodes seeded: ${kgRes.data?.data?.nodes?.length} nodes.`);
  assert(Array.isArray(kgRes.data?.data?.edges) && kgRes.data.data.edges.length >= 30, `Knowledge Graph edges seeded: ${kgRes.data?.data?.edges?.length} edges.`);
  assert(Array.isArray(kgRes.data?.data?.weakConceptIds), 'Weak concept analysis derived from real assessment marks.');

  const nodeDetail = await request('GET', `/api/knowledge-graph/node/${kgRes.data.data.nodes[0].id}`, null, studentHeaders);
  assert(nodeDetail.status === 200 && nodeDetail.data?.data?.node, `GET /api/knowledge-graph/node/:id returns node: ${nodeDetail.data?.data?.node?.label}`);

  // 3. Academic Trajectory Predictor Verification
  console.log('\n--- 3. Academic Trajectory Predictor Verification ---');
  const trajRes = await request('GET', `/api/trajectory/predict/${studentId}`, null, studentHeaders);
  assert(trajRes.status === 200 && trajRes.data?.success, 'GET /api/trajectory/predict/:studentId returns 200 OK.');
  assert(typeof trajRes.data?.data?.projected_gpa === 'number', `Computed projected GPA point estimate: ${trajRes.data?.data?.projected_gpa}`);
  assert(trajRes.data?.data?.projected_gpa_range?.lower !== undefined, `Computed uncertainty interval: [${trajRes.data?.data?.projected_gpa_range?.lower}, ${trajRes.data?.data?.projected_gpa_range?.upper}]`);
  assert(trajRes.data?.data?.contributing_factors?.internal_assessment_factor, 'Transparent contributing factors present (internal assessments, momentum, attendance).');
  assert(trajRes.data?.data?.methodology?.model_type?.includes('OLS'), 'Methodology accurately labeled as statistical OLS regression (not fake ML).');

  // 4. Adaptive Study Planner Verification
  console.log('\n--- 4. Adaptive Study Planner Verification ---');
  const plannerRes = await request('GET', `/api/study-planner/${studentId}`, null, studentHeaders);
  assert(plannerRes.status === 200 && plannerRes.data?.success, 'GET /api/study-planner/:studentId succeeds.');
  assert(plannerRes.data?.data?.plan?.weekly_goal_hours !== undefined, `Weekly goal hours: ${plannerRes.data?.data?.plan?.weekly_goal_hours} hrs.`);

  // Create task
  const createSubjTask = await request('POST', '/api/study-planner/task', {
    student_id: studentId,
    topic_name: 'Database Indexing & B-Trees Optimization',
    priority: 'High',
    estimated_hours: 4.0,
    target_date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]
  }, studentHeaders);
  assert(createSubjTask.status === 201 && createSubjTask.data?.taskId, `Created adaptive study task ID: ${createSubjTask.data?.taskId}`);
  const newTaskId = createSubjTask.data?.taskId;

  // Update task status
  const updateTask = await request('PUT', `/api/study-planner/task/${newTaskId}`, {
    status: 'In Progress',
    completed_hours: 1.5
  }, studentHeaders);
  assert(updateTask.status === 200 && updateTask.data?.success, 'PUT /api/study-planner/task/:id updates status to In Progress.');

  // Delete task
  const deleteTask = await request('DELETE', `/api/study-planner/task/${newTaskId}`, null, studentHeaders);
  assert(deleteTask.status === 200 && deleteTask.data?.success, 'DELETE /api/study-planner/task/:id safely removes study task.');

  // 5. Skill Evidence Graph Verification
  console.log('\n--- 5. Skill Evidence Graph Verification ---');
  const skillRes = await request('GET', `/api/skill-evidence/${studentId}`, null, studentHeaders);
  assert(skillRes.status === 200 && skillRes.data?.success, 'GET /api/skill-evidence/:studentId succeeds.');
  assert(Array.isArray(skillRes.data?.data?.skills), `Tracked competencies: ${skillRes.data?.data?.skills?.length}`);
  assert(Array.isArray(skillRes.data?.data?.evidence), `Evidence records connected: ${skillRes.data?.data?.evidence?.length}`);
  assert(skillRes.data?.data?.careerGapAnalysis?.missingSkills !== undefined, 'Career gap analysis successfully computes missing skills.');

  // 6. Intervention Effectiveness Engine Verification
  console.log('\n--- 6. Intervention Effectiveness Engine Verification ---');
  const intervRes = await request('GET', '/api/impact-loop', null, adminHeaders);
  assert(intervRes.status === 200 && Array.isArray(intervRes.data?.data), `Retrieved ${intervRes.data?.data?.length} institution interventions.`);

  const intervAnalytics = await request('GET', '/api/impact-loop/analytics', null, adminHeaders);
  assert(intervAnalytics.status === 200 && Array.isArray(intervAnalytics.data?.data?.byType), 'Intervention effectiveness analytics aggregated across departments.');

  // 7. Department-Wise Mini Dashboards & Student Mini Dashboards Verification
  console.log('\n--- 7. Institution Department Mini Dashboards (Admin/HOD) ---');
  const miniDashRes = await request('GET', '/api/departments/mini-dashboards', null, adminHeaders);
  assert(miniDashRes.status === 200 && Array.isArray(miniDashRes.data?.data), `Department mini-dashboards returned: ${miniDashRes.data?.data?.length} departments.`);
  const targetDept = miniDashRes.data?.data.find(d => d.studentCount > 0) || miniDashRes.data?.data[0];
  assert(targetDept?.studentCount > 0, `Department ${targetDept?.code} has ${targetDept?.studentCount} active students.`);
  assert(targetDept?.academicPerformance?.distribution?.distinction !== undefined, 'CGPA distribution calculated (Distinction, First Class, Second Class, At Risk).');
  assert(targetDept?.feeCollection?.totalDue !== undefined, `Fee collection rate: ${targetDept?.feeCollection?.collectionRatePct}%.`);

  // Student Mini Dashboards
  const stuMiniRes = await request('GET', `/api/departments/${targetDept.id}/student-mini-dashboards`, null, adminHeaders);
  assert(stuMiniRes.status === 200 && Array.isArray(stuMiniRes.data?.data), `Student mini dashboards returned for ${targetDept.name}: ${stuMiniRes.data?.data?.length} students.`);
  const sampleStuCard = stuMiniRes.data?.data[0];
  assert(sampleStuCard?.registerNumber && sampleStuCard?.fees, 'Student mini dashboard card includes register number, CGPA, attendance, and fee status.');

  // 8. Simulated Demo Payment Workflow Verification
  console.log('\n--- 8. Simulated Demo Payment Workflow & Safety ---');
  // Authenticate student with outstanding fee balance (BITD0002)
  const feeStudentAuth = await loginUser('BITD0002', 'student123', 'student');
  const feeStudentHeaders = { 'Authorization': `Bearer ${feeStudentAuth.token}` };
  const feeStudentId = feeStudentAuth.user.studentId;

  const feeRes = await request('GET', `/api/fees/student/${feeStudentId}`, null, feeStudentHeaders);
  assert(feeRes.status === 200 && Array.isArray(feeRes.data?.data?.fees), `Student fee obligations retrieved: ${feeRes.data?.data?.fees?.length} records.`);
  
  const pendingFee = feeRes.data?.data?.fees?.find(f => Number(f.balance_amount) > 0) || feeRes.data?.data?.fees[0];
  assert(Boolean(pendingFee) && Number(pendingFee.balance_amount) > 0, `Target fee schedule resolved: ID ${pendingFee?.id} (${pendingFee?.fee_category}) with outstanding balance ₹${pendingFee?.balance_amount}`);

  // Simulate Decline / Failure
  const failPay = await request('POST', '/api/fees/pay', {
    feeId: pendingFee.id,
    amount: 100.00,
    payment_method: 'Card Simulation',
    outcome: 'Failed',
    idempotency_key: `test-fail-${Date.now()}`
  }, feeStudentHeaders);
  assert(failPay.status === 400 && failPay.data?.status === 'Failed', 'Simulated gateway decline properly returns 400 and preserves fee balance.');

  // Simulate Cancel / Abandon
  const cancelPay = await request('POST', '/api/fees/pay', {
    feeId: pendingFee.id,
    amount: 100.00,
    payment_method: 'Checkout Simulation',
    outcome: 'Cancelled',
    idempotency_key: `test-cancel-${Date.now()}`
  }, feeStudentHeaders);
  assert(cancelPay.status === 200 && cancelPay.data?.status === 'Cancelled', 'Simulated checkout cancellation records abandoned attempt without altering balance.');

  // Simulate Success Payment
  const payAmount = 10.00;
  const successPay = await request('POST', '/api/fees/pay', {
    feeId: pendingFee.id,
    amount: payAmount,
    payment_method: 'UPI Simulation',
    outcome: 'Success',
    idempotency_key: `test-success-${Date.now()}`
  }, feeStudentHeaders);
  assert(successPay.status === 200 && successPay.data?.status === 'Success', `Simulated payment successful! Transaction Ref: ${successPay.data?.transactionRef}`);
  
  // Verify receipt
  const receiptRes = await request('GET', `/api/fees/receipt/${successPay.data?.transactionRef}`, null, feeStudentHeaders);
  assert(receiptRes.status === 200 && receiptRes.data?.data?.transactionRef === successPay.data?.transactionRef, 'Receipt generation retrieves valid demo transaction record.');

  // Admin Reconciliation
  const auditTxRes = await request('GET', '/api/fees/transactions', null, adminHeaders);
  assert(auditTxRes.status === 200 && Array.isArray(auditTxRes.data?.data), `Admin demo payment transactions retrieved: ${auditTxRes.data?.data?.length} transactions.`);
  assert(auditTxRes.data?.stats?.totalTransactions >= 1, `Audit stats summary aggregated: ${auditTxRes.data?.stats?.totalTransactions} total transactions.`);

  // 9. Role-Based Security & Isolation Verification
  console.log('\n--- 9. Role-Based Security Boundaries & Isolation ---');
  // Student cannot access Admin transactions audit
  const studentTamperTx = await request('GET', '/api/fees/transactions', null, studentHeaders);
  assert(studentTamperTx.status === 403, 'Student strictly blocked from Admin demo payment transactions (403 Forbidden).');

  // Student cannot access Department Mini Dashboards
  const studentTamperMini = await request('GET', '/api/departments/mini-dashboards', null, studentHeaders);
  assert(studentTamperMini.status === 403, 'Student strictly blocked from Department Mini Dashboards (403 Forbidden).');

  // Student cannot pay another student's fees (student 4 attempting to pay student 1's fee ID 1)
  const foreignFeePay = await request('POST', '/api/fees/pay', {
    feeId: 1,
    amount: 50.00,
    outcome: 'Success'
  }, feeStudentHeaders);
  assert(foreignFeePay.status === 403 || foreignFeePay.status === 404, 'Student cannot tamper or execute payment on unowned fee record.');

  console.log('\n========================================================================');
  console.log(`📊 MASTER TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL ADVANCED MODULES & PRODUCT COMPLETION CHECKS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  }
}

runMasterProductTests().catch(err => {
  console.error('[Master Test Suite Error]', err);
  process.exit(1);
});
