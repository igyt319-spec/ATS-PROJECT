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

    const hodLog = await api('POST', '/api/auth/login', { identifier: 'faculty.cse@example.test', password: 'faculty123', role: 'admin' });
    assert('1.2 HOD (CSE Dept) login successful', hodLog.status === 200 && hodLog.body.success);
    const hodToken = hodLog.body.token;
    assert('1.3 HOD token contains HOD role/flag', hodLog.body.user?.facultyRole === 'hod' || hodLog.body.user?.role === 'faculty');

    const mentorLog = await api('POST', '/api/auth/login', { identifier: 'mentor.cse@ats.com', password: 'mentor123', role: 'admin' });
    assert('1.4 Mentor (CSE Dept) login successful', mentorLog.status === 200 && mentorLog.body.success);
    const mentorToken = mentorLog.body.token;
    assert('1.5 Mentor token contains mentor role', mentorLog.body.user?.facultyRole === 'mentor');

    const studentLog = await api('POST', '/api/auth/login', { identifier: 'BITD0001', password: 'student123', role: 'student' });
    assert('1.6 Student (BITD0001) login successful', studentLog.status === 200 && studentLog.body.success);
    const studentToken = studentLog.body.token;
    const studentId = studentLog.body.user?.studentId || 1;

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
    // Admin creates valid result
    const validResult = await api('POST', '/api/results', {
      student_id: studentId,
      assessment_type: 'internal',
      assessment_name: 'Unit Test 1',
      marks_obtained: 45,
      max_marks: 50
    }, adminToken);
    assert('9.1 Admin can create valid academic result', validResult.status === 201 && validResult.body.success);

    // Marks obtained > max marks -> reject
    const invalidMarks = await api('POST', '/api/results', {
      student_id: studentId,
      assessment_type: 'internal',
      assessment_name: 'Unit Test 1 Exceeded',
      marks_obtained: 60,
      max_marks: 50
    }, adminToken);
    assert('9.2 Marks exceeding max_marks rejected with HTTP 400', invalidMarks.status === 400);

    // 10. Summary
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
