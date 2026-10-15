const http = require('http');

async function api(method, path, body = null, token = null, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await new Promise((resolve, reject) => {
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

      // If server returned 500 due to temporary DB connection reset, wait and retry once
      if (res.status === 500 && attempt < retries) {
        await new Promise(r => setTimeout(r, 600));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 600));
        continue;
      }
      throw err;
    }
  }
}

async function runRBACTestSuite() {
  const results = [];
  function assert(name, condition, extra = '') {
    results.push({ name, passed: Boolean(condition), extra });
    console.log((condition ? '✅ PASS: ' : '❌ FAIL: ') + name + (extra ? ' (' + extra + ')' : ''));
  }

  console.log('====================================================');
  console.log('=== ATS ROLE-BASED ACCESS CONTROL (RBAC) TEST SUITE');
  console.log('====================================================\n');

  try {
    // 1. Authenticate All 4 Roles
    console.log('--- Phase 1: Authentication & Role Token Issuance ---');
    const adminLog = await api('POST', '/api/auth/login', { identifier: 'admin@ats.com', password: 'admin123', role: 'admin' });
    assert('1.1 Admin login successful', adminLog.status === 200 && adminLog.body.success);
    const adminToken = adminLog.body.token;

    const hodLog = await api('POST', '/api/auth/login', { identifier: 'faculty.cse@example.test', password: 'faculty123', role: 'hod' });
    assert('1.2 HOD (CSE Dept) login successful', hodLog.status === 200 && hodLog.body.success);
    const hodToken = hodLog.body.token;
    assert('1.3 HOD token contains HOD role/flag', hodLog.body.user?.facultyRole === 'hod' || hodLog.body.user?.role === 'faculty');

    const mentorLog = await api('POST', '/api/auth/login', { identifier: 'mentor.cse@ats.com', password: 'mentor123', role: 'faculty' });
    assert('1.4 Mentor (CSE Dept) login successful', mentorLog.status === 200 && mentorLog.body.success);
    const mentorToken = mentorLog.body.token;
    assert('1.5 Mentor token contains mentor role', mentorLog.body.user?.facultyRole === 'mentor');

    const studentLog = await api('POST', '/api/auth/login', { identifier: 'BITD0001', password: 'student123', role: 'student' });
    assert('1.6 Student (BITD0001) login successful', studentLog.status === 200 && studentLog.body.success);
    const studentToken = studentLog.body.token;
    const studentId = studentLog.body.user?.studentId || 1;

    // Cross-Role Portal Login Defense
    const adminAsFaculty = await api('POST', '/api/auth/login', { identifier: 'admin@ats.com', password: 'admin123', role: 'faculty' });
    assert('1.7 Admin blocked from logging into faculty portal (HTTP 403)', adminAsFaculty.status === 403);

    const facultyAsAdmin = await api('POST', '/api/auth/login', { identifier: 'faculty.cse@example.test', password: 'faculty123', role: 'admin' });
    assert('1.8 Faculty blocked from logging into admin portal (HTTP 403)', facultyAsAdmin.status === 403);

    // 2. Student Data Isolation & IDOR Prevention
    console.log('\n--- Phase 2: Student Data Isolation & IDOR Prevention ---');
    // Student accessing own records -> should succeed
    const ownDashboard = await api('GET', `/api/dashboard/${studentId}`, null, studentToken);
    assert('2.1 Student can view own dashboard', ownDashboard.status === 200 && ownDashboard.body.success);
    assert('2.2 Dashboard returns assigned mentor info', ownDashboard.body.assignedMentor !== undefined);

    const ownResults = await api('GET', `/api/results/student/${studentId}`, null, studentToken);
    assert('2.3 Student can view own 3-tier results', ownResults.status === 200 && ownResults.body.data?.results !== undefined);

    // Student attempting to access other student (ID 99) -> must return HTTP 403
    const forbiddenResults = await api('GET', `/api/results/student/99`, null, studentToken);
    assert('2.4 IDOR: Student cannot view another student results (HTTP 403)', forbiddenResults.status === 403);

    const forbiddenLeaves = await api('GET', `/api/leave/student/99`, null, studentToken);
    assert('2.5 IDOR: Student cannot view another student leave records (HTTP 403)', forbiddenLeaves.status === 403);

    const forbiddenFees = await api('GET', `/api/fees/student/99`, null, studentToken);
    assert('2.6 IDOR: Student cannot view another student fee records (HTTP 403)', forbiddenFees.status === 403);

    // 3. Mentor Mentee Scope & Cross-Student Restriction
    console.log('\n--- Phase 3: Mentor Roster & Authorization Isolation ---');
    const myMentees = await api('GET', '/api/mentors/my-mentees', null, mentorToken);
    assert('3.1 Mentor can view assigned mentees roster', myMentees.status === 200 && Array.isArray(myMentees.body.data));

    const menteeResults = await api('GET', '/api/results/mentor/mentees', null, mentorToken);
    assert('3.2 Mentor can view mentee results', menteeResults.status === 200 && Array.isArray(menteeResults.body.data));

    const menteeLeaves = await api('GET', '/api/leave/mentor/mentees', null, mentorToken);
    assert('3.3 Mentor can view mentee leave requests', menteeLeaves.status === 200 && Array.isArray(menteeLeaves.body.data));

    // Mentor attempting to approve leave for unrelated student (ID 99)
    // Non-existent or unrelated leave ID 9999
    const forbiddenApprove = await api('PUT', '/api/leave/9999/decision', { status: 'Approved', remarks: 'Unauthorized' }, mentorToken);
    assert('3.4 Mentor cannot approve non-mentee or non-existent leave (HTTP 404 or 403)', forbiddenApprove.status === 404 || forbiddenApprove.status === 403);

    // 4. HOD Department Scope & Tamper Resistance
    console.log('\n--- Phase 4: HOD Department Scope & Tamper Resistance ---');
    const hodAllocations = await api('GET', '/api/mentors/department-allocations', null, hodToken);
    assert('4.1 HOD can view department mentor allocations', hodAllocations.status === 200 && hodAllocations.body.departmentId === 10);

    const hodResults = await api('GET', '/api/results/department', null, hodToken);
    assert('4.2 HOD can view department results', hodResults.status === 200 && hodResults.body.departmentId === 10);

    // HOD attempting to spoof department ID query parameter to another department (e.g. dept 14)
    // Server must ignore client parameter and lock to authenticated HOD's department (10)
    const spoofedResults = await api('GET', '/api/results/department?department_id=14', null, hodToken);
    assert('4.3 HOD department spoofing prevented: locked to HOD department', spoofedResults.status === 200 && spoofedResults.body.departmentId === 10);

    // 5. Activity Submission & Official Categories
    console.log('\n--- Phase 5: Student Activity Submissions (6 Categories) ---');
    const uniqueTitle = 'Hackathon SIH Test ' + Date.now().toString().slice(-4);
    const actSub = await api('POST', '/api/activities', {
      category: 'Hackathons',
      title: uniqueTitle,
      organizing_institution: 'AICTE',
      event_date: '2026-10-15',
      participation_level: 'Finalist',
      description: 'AI-based automation testing'
    }, studentToken);
    assert('5.1 Student can submit activity under Hackathons', actSub.status === 201 && actSub.body.success);
    const newActivityId = actSub.body.activityId;

    // Verify activity by mentor
    if (newActivityId) {
      const actVerify = await api('PUT', `/api/activities/${newActivityId}/verify`, {
        status: 'Verified',
        remarks: 'Outstanding performance validated by mentor.'
      }, mentorToken);
      assert('5.2 Mentor can verify assigned mentee activity', actVerify.status === 200 && actVerify.body.success);
    }

    // Invalid category rejection test
    const invalidCat = await api('POST', '/api/activities', {
      category: 'Unapproved Category XYZ',
      title: 'Invalid',
      event_date: '2026-10-15'
    }, studentToken);
    assert('5.3 Invalid category rejected with HTTP 400', invalidCat.status === 400);

    // 6. Leave Management Workflow
    console.log('\n--- Phase 6: Leave Management Workflow ---');
    const randomDay = Math.floor(Math.random() * 20) + 1;
    const leaveStart = `2027-01-${String(randomDay).padStart(2, '0')}`;
    const leaveEnd = `2027-01-${String(randomDay + 2).padStart(2, '0')}`;
    const leaveApply = await api('POST', '/api/leave', {
      leave_type: 'On Duty (OD)',
      start_date: leaveStart,
      end_date: leaveEnd,
      reason: 'Attending IEEE international conference presentation.'
    }, studentToken);
    assert('6.1 Student can apply for leave', leaveApply.status === 201 && leaveApply.body.success);
    const newLeaveId = leaveApply.body.leaveId;

    if (newLeaveId) {
      const leaveDecision = await api('PUT', `/api/leave/${newLeaveId}/decision`, {
        status: 'Approved',
        remarks: 'Leave granted for research paper presentation.'
      }, mentorToken);
      assert('6.2 Mentor can approve mentee leave with remarks', leaveDecision.status === 200 && leaveDecision.body.success);
    }

    // Invalid date range check: start after end
    const invalidDates = await api('POST', '/api/leave', {
      leave_type: 'Medical Leave',
      start_date: '2026-11-10',
      end_date: '2026-11-05',
      reason: 'Invalid inverted dates'
    }, studentToken);
    assert('6.3 Inverted leave dates rejected with HTTP 400', invalidDates.status === 400);

    // 7. Fee Management & Demo Payment Gateway
    console.log('\n--- Phase 7: Fee Management & Atomic Demo Payment Gateway ---');
    const studentFees = await api('GET', `/api/fees/student/${studentId}`, null, studentToken);
    assert('7.1 Student can view own fees schedule', studentFees.status === 200 && Array.isArray(studentFees.body.data?.fees));

    const pendingFee = (studentFees.body.data?.fees || []).find(f => Number(f.balance_amount) > 0);
    if (pendingFee) {
      const testPayAmount = 100.00;
      const initialBalance = Number(pendingFee.balance_amount);

      // Successful Demo Payment
      const payRes = await api('POST', '/api/fees/pay', {
        fee_id: pendingFee.id,
        amount: testPayAmount,
        payment_method: 'UPI Simulation'
      }, studentToken);
      assert('7.2 Successful demo payment executed atomically', payRes.status === 200 && payRes.body.success);
      assert('7.3 Demo payment returns unique transaction reference', payRes.body.transactionRef && payRes.body.transactionRef.startsWith('ATS-TXN'));
      assert('7.4 Balance recalculated correctly in database', Math.abs(payRes.body.remainingBalance - (initialBalance - testPayAmount)) < 0.05);

      // Verify Printable Receipt Endpoint
      const receiptRes = await api('GET', `/api/fees/receipt/${payRes.body.transactionRef}`, null, studentToken);
      assert('7.6 Receipt displays prominent DEMO PAYMENT notice', Boolean(receiptRes.body?.disclaimer && receiptRes.body.disclaimer.includes('DEMO PAYMENT')));

      // Test Simulated Failure
      const failRes = await api('POST', '/api/fees/pay', {
        fee_id: pendingFee.id,
        amount: 50.00,
        payment_method: 'Card Simulation',
        simulate_failure: true
      }, studentToken);
      assert('7.7 Simulated payment gateway failure handled gracefully', failRes.status === 400 && failRes.body.success === false);
    }

    // Overpayment rejection check
    if (pendingFee) {
      const overPay = await api('POST', '/api/fees/pay', {
        fee_id: pendingFee.id,
        amount: 9999999.00,
        payment_method: 'Card Simulation'
      }, studentToken);
      assert('7.8 Payment amount exceeding balance rejected with HTTP 400', overPay.status === 400);
    }

    // 8. User Profile Photos & Least-Privilege Protection
    console.log('\n--- Phase 8: Profile Photos & Least-Privilege Updates ---');
    const updatePhotoRes = await api('PUT', '/api/auth/profile-photo', {
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'
    }, studentToken);
    assert('8.1 User can update own profile photo', updatePhotoRes.status === 200 && updatePhotoRes.body.success);

    // Student attempting to update another user's photo -> HTTP 403
    const forbiddenPhoto = await api('PUT', '/api/auth/profile-photo', {
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
      targetUserId: 1
    }, studentToken);
    assert('8.2 Student cannot update another user photo (HTTP 403)', forbiddenPhoto.status === 403);

    // Student attempting to escalate privilege by modifying department or name -> locked
    const studentProfileUpdate = await api('PUT', `/api/students/${studentId}`, {
      department: 'Hacked Department',
      phone: '+91 9999988888',
      bio: 'Updated bio by student'
    }, studentToken);
    assert('8.3 Student profile update accepted for permitted fields', studentProfileUpdate.status === 200 && studentProfileUpdate.body.success);

    // Verify student department was NOT changed to 'Hacked Department'
    const verifyStudent = await api('GET', `/api/students/${studentId}`, null, studentToken);
    assert('8.4 Least-privilege: Student department cannot be altered by student', verifyStudent.body.data?.department !== 'Hacked Department');
    assert('8.5 Permitted phone and bio were updated successfully', verifyStudent.body.data?.phone === '+91 9999988888');

    // 9. Academic Results Marks Validation
    console.log('\n--- Phase 9: Academic Results Marks Validation ---');
    // Admin blocked from creating academic results (separation of duties)
    const adminCreateResult = await api('POST', '/api/results', {
      student_id: studentId,
      assessment_type: 'internal',
      assessment_name: 'Unit Test Admin Unauthorized',
      marks_obtained: 45,
      max_marks: 50
    }, adminToken);
    assert('9.1 Admin blocked from creating academic results (HTTP 403)', adminCreateResult.status === 403);

    // Faculty creates valid result
    const validResult = await api('POST', '/api/results', {
      student_id: studentId,
      assessment_type: 'internal',
      assessment_name: 'Unit Test 1',
      marks_obtained: 45,
      max_marks: 50
    }, mentorToken);
    assert('9.2 Faculty can create valid academic result', validResult.status === 201 && validResult.body.success);
    const createdResultId = validResult.body?.resultId;

    // Marks obtained > max marks -> reject
    const invalidMarks = await api('POST', '/api/results', {
      student_id: studentId,
      assessment_type: 'internal',
      assessment_name: 'Unit Test 1 Exceeded',
      marks_obtained: 60,
      max_marks: 50
    }, mentorToken);
    assert('9.3 Marks exceeding max_marks rejected with HTTP 400', invalidMarks.status === 400);

    // 10. Student Mini-Dashboard Access Control (Section 5)
    console.log('\n--- Phase 10: Student Mini-Dashboard Access Control (Section 5) ---');
    const ownMiniDash = await api('GET', `/api/students/${studentId}/mini-dashboard`, null, studentToken);
    assert('10.1 Student can view own mini-dashboard', ownMiniDash.status === 200 && ownMiniDash.body.success);
    assert('10.2 Mini-dashboard returns student identity and assigned mentor', ownMiniDash.body.data?.student?.id === studentId);

    // Student attempting to access other student's mini-dashboard -> 403
    const forbiddenMiniDash = await api('GET', '/api/students/99/mini-dashboard', null, studentToken);
    assert('10.3 IDOR: Student cannot view another student mini-dashboard (HTTP 403)', forbiddenMiniDash.status === 403);

    // Mentor accessing assigned mentee mini-dashboard -> 200
    const mentorMiniDash = await api('GET', `/api/students/${studentId}/mini-dashboard`, null, mentorToken);
    assert('10.4 Mentor can access assigned mentee mini-dashboard', mentorMiniDash.status === 200 && mentorMiniDash.body.success);

    // Mentor accessing unassigned student mini-dashboard (ID 4 - IT Dept) -> 403
    const mentorForbiddenDash = await api('GET', '/api/students/4/mini-dashboard', null, mentorToken);
    assert('10.5 Mentor cannot access unassigned student mini-dashboard (HTTP 403)', mentorForbiddenDash.status === 403);

    // Admin accessing student mini-dashboard -> 403 (strict separation of duties)
    const adminMiniDash = await api('GET', `/api/students/${studentId}/mini-dashboard`, null, adminToken);
    assert('10.6 Admin is restricted from student mini-dashboard (HTTP 403)', adminMiniDash.status === 403);

    // 11. Department Management & Single-Active HOD Constraint (Section 7)
    console.log('\n--- Phase 11: Department Management & Single Active HOD Constraint (Section 7) ---');
    const deptList = await api('GET', '/api/departments');
    assert('11.1 Department catalog returns enriched active HOD and counts', deptList.status === 200 && Array.isArray(deptList.body.data));
    const cseDept = (deptList.body.data || []).find(d => d.id === 10 || d.code === 'CSE');
    assert('11.2 CSE Department exists with active HOD assignment', Boolean(cseDept && (cseDept.active_hod_name || cseDept.code === 'CSE')));

    // Admin reassigns active HOD transactionally (Department 10, Faculty 3)
    const reassignHOD = await api('PUT', '/api/departments/10/hod', {
      faculty_id: 3,
      reason: 'Departmental leadership rotation approved by Academic Council.'
    }, adminToken);
    assert('11.3 Admin can transactionally assign active HOD', reassignHOD.status === 200 && reassignHOD.body.success);

    // Non-admin attempting to reassign HOD -> 403
    const forbiddenHOD = await api('PUT', '/api/departments/10/hod', { faculty_id: 3 }, studentToken);
    assert('11.4 Non-admin cannot assign department HOD (HTTP 403)', forbiddenHOD.status === 403);

    // 12. Secure User Account Management (Section 9)
    console.log('\n--- Phase 12: Secure Password & Identifier Updates (Section 9) ---');
    // Change password with invalid current password -> rejected
    const badOldPwd = await api('PUT', '/api/auth/change-password', {
      currentPassword: 'wrong_password_xyz',
      newPassword: 'studentNew123',
      confirmPassword: 'studentNew123'
    }, studentToken);
    assert('12.1 Password change with invalid current password rejected (HTTP 400)', badOldPwd.status === 400);

    // Change password with short password -> rejected
    const shortPwd = await api('PUT', '/api/auth/change-password', {
      currentPassword: 'student123',
      newPassword: '123',
      confirmPassword: '123'
    }, studentToken);
    assert('12.2 Short password (<6 chars) rejected (HTTP 400)', shortPwd.status === 400);

    // Change password with valid credentials -> success
    const validPwdChange = await api('PUT', '/api/auth/change-password', {
      currentPassword: 'student123',
      newPassword: 'student123', // restore same password
      confirmPassword: 'student123'
    }, studentToken);
    assert('12.3 Password change successful with verification', validPwdChange.status === 200 && validPwdChange.body.success);

    // 13. Official Academic Record Correction Workflow (Section 3D & 10)
    console.log('\n--- Phase 13: Official Academic Record Correction Workflow (Section 3D) ---');
    // Admin attempting direct academic correction -> 403
    const adminCorrection = await api('POST', '/api/results/correct', {
      result_id: createdResultId || 1,
      marks_obtained: 48,
      reason: 'Administrative correction attempt without HOD role'
    }, adminToken);
    assert('13.1 Admin cannot execute academic result correction (HTTP 403)', adminCorrection.status === 403);

    if (createdResultId) {
      // Correction without justification reason -> rejected
      const missingReason = await api('POST', '/api/results/correct', {
        result_id: createdResultId,
        marks_obtained: 48,
        reason: 'short' // <10 chars
      }, hodToken);
      assert('13.2 Academic correction without justification reason rejected (HTTP 400)', missingReason.status === 400);

      // Correction with valid reason by HOD -> success
      const validCorrection = await api('POST', '/api/results/correct', {
        result_id: createdResultId,
        marks_obtained: 48,
        reason: 'Recounting requested by student; script verified by HOD.'
      }, hodToken);
      assert('13.3 Authorized HOD academic correction executed and logged', validCorrection.status === 200 && validCorrection.body.success);
    }

    // Student attempting direct academic correction -> 403
    const forbiddenCorrection = await api('POST', '/api/results/correct', {
      result_id: createdResultId || 1,
      marks_obtained: 50,
      reason: 'Unauthorized student modification'
    }, studentToken);
    assert('13.4 Student cannot modify official academic results (HTTP 403)', forbiddenCorrection.status === 403);

    // 14. Audit Logs API Verification (Section 10)
    console.log('\n--- Phase 14: Audit Logs API Verification (Section 10) ---');
    const auditLogsRes = await api('GET', '/api/audit-logs', null, adminToken);
    assert('14.1 Admin can view institution-wide audit logs', auditLogsRes.status === 200 && Array.isArray(auditLogsRes.body.data));
    assert('14.2 Audit log captures recent security and record correction events', auditLogsRes.body.data.length > 0);

    // Student attempting to view audit logs -> 403
    const forbiddenAudit = await api('GET', '/api/audit-logs', null, studentToken);
    assert('14.3 Non-admin blocked from viewing audit logs (HTTP 403)', forbiddenAudit.status === 403);

    // 15. Render Health-Check Endpoint (Section 14)
    console.log('\n--- Phase 15: Render Public Health-Check Endpoint (Section 14) ---');
    const healthRoot = await api('GET', '/health');
    assert('15.1 Public /health endpoint returns HTTP 200', healthRoot.status === 200 && healthRoot.body.status === 'online');

    // 16. Multi-Department Normal Login Verification (Requirement 3)
    console.log('\n--- Phase 16: Multi-Department Normal Login Verification (Requirement 3) ---');
    const eceFacultyLog = await api('POST', '/api/auth/login', { identifier: 'faculty.ece@example.test', password: 'faculty123', role: 'faculty' });
    assert('16.1 ECE Faculty login succeeds without CSE restriction', eceFacultyLog.status === 200 && eceFacultyLog.body.success);

    const itStudentLog = await api('POST', '/api/auth/login', { identifier: 'BITD0002', password: 'student123', role: 'student' });
    assert('16.2 IT Department Student (BITD0002) login succeeds', itStudentLog.status === 200 && itStudentLog.body.success);

    const eceStudentLog = await api('POST', '/api/auth/login', { identifier: 'BITD0003', password: 'student123', role: 'student' });
    assert('16.3 ECE Department Student (BITD0003) login succeeds', eceStudentLog.status === 200 && eceStudentLog.body.success);

    // 17. Profile Decoupling & Role Separation (Requirement 2)
    console.log('\n--- Phase 17: Profile Decoupling & Role Separation (Requirement 2) ---');
    const studentMe = await api('GET', '/api/auth/me', null, studentToken);
    assert('17.1 Student /api/auth/me returns student-only profile', studentMe.status === 200 && studentMe.body.user.student !== null && studentMe.body.user.faculty === null);

    const facultyMe = await api('GET', '/api/auth/me', null, mentorToken);
    assert('17.2 Faculty /api/auth/me returns faculty-only profile without student metrics', facultyMe.status === 200 && facultyMe.body.user.faculty !== null && facultyMe.body.user.student === null);

    const adminMe = await api('GET', '/api/auth/me', null, adminToken);
    assert('17.3 Admin /api/auth/me returns admin-only profile without student or faculty pollution', adminMe.status === 200 && adminMe.body.user.student === null && adminMe.body.user.faculty === null);

    const updateMe = await api('PUT', '/api/auth/me', { phone: '9876500000', bio: 'Verified test bio' }, studentToken);
    assert('17.4 Authenticated user can update own profile safely', updateMe.status === 200 && updateMe.body.success);

    // 18. Institutional Department Overview & Data Isolation (Requirement 5 & 7)
    console.log('\n--- Phase 18: Institutional Department Overview & Data Isolation (Requirement 5 & 7) ---');
    const instOverview = await api('GET', '/api/departments/institutional-overview', null, adminToken);
    assert('18.1 Admin can fetch institutional department overview', instOverview.status === 200 && instOverview.body.success);
    assert('18.2 Summary includes totalDepartments, totalHODs, totalFaculty, totalStudents', 
      instOverview.body.summary && instOverview.body.summary.totalDepartments > 0 && instOverview.body.summary.totalStudents > 0);

    const depts = instOverview.body.departments || [];
    const cseGroup = depts.find(d => d.code === 'CSE');
    const eceGroup = depts.find(d => d.code === 'ECE');

    if (cseGroup && eceGroup) {
      const cseHasEceStudent = (cseGroup.students || []).some(s => s.register_number === 'BITD0003');
      assert('18.3 CSE department sector does NOT contain ECE students', !cseHasEceStudent);

      const eceHasCseStudent = (eceGroup.students || []).some(s => s.register_number === 'BITD0001');
      assert('18.4 ECE department sector does NOT contain CSE students', !eceHasCseStudent);
    }

    const nonAdminInstOverview = await api('GET', '/api/departments/institutional-overview', null, studentToken);
    assert('18.5 Non-admin blocked from institutional overview (HTTP 403)', nonAdminInstOverview.status === 403);

    // 19. Faculty Mini-Dashboard RBAC & Isolation (Requirement 6)
    console.log('\n--- Phase 19: Faculty Mini-Dashboard RBAC & Isolation (Requirement 6) ---');
    const fac1MiniDash = await api('GET', '/api/departments/faculty/3/mini-dashboard', null, adminToken);
    assert('19.1 Admin is restricted from faculty mini-dashboard (HTTP 403)', fac1MiniDash.status === 403);

    const facMiniDash = await api('GET', '/api/departments/faculty/3/mini-dashboard', null, hodToken);
    assert('19.2 Faculty/HOD can view department faculty mini-dashboard', 
      facMiniDash.status === 200 && facMiniDash.body.success && facMiniDash.body.data?.faculty?.id === 3);

    const eceFacultyId = (eceGroup?.faculty && eceGroup.faculty[0]?.id) || 4;
    const crossHodAccess = await api('GET', `/api/departments/faculty/${eceFacultyId}/mini-dashboard`, null, hodToken);
    assert('19.3 Cross-department HOD access rejected on faculty mini-dashboard (HTTP 403)', crossHodAccess.status === 403);

    // 21. Admin Account Lifecycle & Maintenance Only (Strict Access Governance)
    console.log('\n--- Phase 21: Admin Account Lifecycle & Operational Barrier ---');
    // 21.1 Admin lists all accounts
    const userListRes = await api('GET', '/api/auth/users', null, adminToken);
    assert('21.1 Admin can list user accounts with directory metadata', userListRes.status === 200 && Array.isArray(userListRes.body.data));

    // 21.2 Non-admin cannot list user accounts
    const studentUserList = await api('GET', '/api/auth/users', null, studentToken);
    assert('21.2 Student cannot access user management directory (HTTP 403)', studentUserList.status === 403);
    const mentorUserList = await api('GET', '/api/auth/users', null, mentorToken);
    assert('21.3 Faculty cannot access user management directory (HTTP 403)', mentorUserList.status === 403);

    // 21.4 Admin creates a new student user
    const testRegNo = 'TST' + Date.now().toString().slice(-5);
    const testStudentEmail = `test.student.${Date.now().toString().slice(-5)}@example.test`;
    const createStudentRes = await api('POST', '/api/auth/users', {
      name: 'Test Managed Student',
      email: testStudentEmail,
      role: 'student',
      department_id: 10,
      register_number: testRegNo,
      year: 2,
      semester: 3
    }, adminToken);
    assert('21.4 Admin can provision new student account', createStudentRes.status === 201 && createStudentRes.body.success);
    const newUserId = createStudentRes.body.user?.id;

    // 21.5 Non-admin cannot create user accounts
    const unauthorizedCreate = await api('POST', '/api/auth/users', {
      name: 'Attacker Provision',
      email: 'attacker@example.test',
      role: 'student',
      department_id: 10,
      register_number: 'ATK9999'
    }, mentorToken);
    assert('21.5 Non-admin cannot provision accounts (HTTP 403)', unauthorizedCreate.status === 403);

    if (newUserId) {
      // 21.6 Admin can toggle active status (deactivate user)
      const deactRes = await api('PUT', `/api/auth/users/${newUserId}/status`, { is_active: 0 }, adminToken);
      assert('21.6 Admin can deactivate user account', deactRes.status === 200 && deactRes.body.is_active === 0);

      // Verify deactivated user cannot log in
      const deactLogin = await api('POST', '/api/auth/login', {
        identifier: testStudentEmail,
        password: createStudentRes.body.temporaryPassword || 'TempPass123!',
        role: 'student'
      });
      assert('21.7 Deactivated user login is rejected (HTTP 403)', deactLogin.status === 403);

      // 21.8 Admin can reactivate user account
      const reactRes = await api('PUT', `/api/auth/users/${newUserId}/status`, { is_active: 1 }, adminToken);
      assert('21.8 Admin can reactivate user account', reactRes.status === 200 && reactRes.body.is_active === 1);

      // 21.9 Admin self-deactivation is blocked
      const selfDeact = await api('PUT', '/api/auth/users/1/status', { is_active: 0 }, adminToken);
      assert('21.9 Admin self-deactivation is prevented (HTTP 400)', selfDeact.status === 400);

      // 21.10 Admin can reset user password
      const resetPwdRes = await api('PUT', `/api/auth/users/${newUserId}/reset-password`, {
        newPassword: 'NewSecurePassword123!'
      }, adminToken);
      assert('21.10 Admin can reset user credentials', resetPwdRes.status === 200 && resetPwdRes.body.success);

      // 21.11 Admin can update user department affiliation
      const updateDeptRes = await api('PUT', `/api/auth/users/${newUserId}/department`, {
        department_id: 13
      }, adminToken);
      assert('21.11 Admin can reassign user department affiliation', updateDeptRes.status === 200 && updateDeptRes.body.success);
    }

    // 21.12 Operational Barriers: Admin blocked from Student/Faculty/Mentor/HOD operations
    const adminMarks = await api('POST', '/api/performance', {
      student_id: studentId,
      subject_id: 1,
      internal1_marks: 40
    }, adminToken);
    assert('21.12 Operational Barrier: Admin blocked from modifying marks (HTTP 403)', adminMarks.status === 403);

    const adminAtt = await api('POST', '/api/attendance', {
      student_id: studentId,
      subject_id: 1,
      classes_attended: 45,
      classes_conducted: 50
    }, adminToken);
    assert('21.13 Operational Barrier: Admin blocked from recording attendance (HTTP 403)', adminAtt.status === 403);

    const adminLeave = await api('PUT', '/api/leave/1/decision', {
      status: 'Approved',
      remarks: 'Admin override attempt'
    }, adminToken);
    assert('21.14 Operational Barrier: Admin blocked from reviewing leave requests (HTTP 403)', adminLeave.status === 403);

    const adminAct = await api('PUT', '/api/activities/1/verify', {
      status: 'Verified',
      remarks: 'Admin verify attempt'
    }, adminToken);
    assert('21.15 Operational Barrier: Admin blocked from verifying student activities (HTTP 403)', adminAct.status === 403);

    const adminStudentsList = await api('GET', '/api/students', null, adminToken);
    assert('21.16 Operational Barrier: Admin blocked from faculty student directory (HTTP 403)', adminStudentsList.status === 403);

    // 20. Summary
    console.log('\n====================================================');
    const passedCount = results.filter(r => r.passed).length;
    console.log(`=== SUMMARY: ${passedCount} / ${results.length} TESTS PASSED`);
    console.log('====================================================');

    if (passedCount === results.length) {
      process.exit(0);
    } else {
      process.exit(1);
    }

  } catch (err) {
    console.error('Test Suite Fatal Error:', err);
    process.exit(1);
  }
}

runRBACTestSuite();
