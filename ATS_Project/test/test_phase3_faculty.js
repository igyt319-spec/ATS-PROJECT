const { ownsStudent, ownsStudentOrAssigned } = require('../backend/middleware/authMiddleware');

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

async function runPhase3Tests() {
  console.log('===============================================================');
  console.log('=== PHASE 3 REGRESSION TEST SUITE: FACULTY CONSOLE & MENTEE ISOLATION');
  console.log('===============================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(testName, condition, extra = '') {
    if (condition) {
      passedCount++;
      console.log(`✅ PASS: ${testName} ${extra ? '(' + extra + ')' : ''}`);
    } else {
      failedCount++;
      console.error(`❌ FAIL: ${testName} ${extra ? '(' + extra + ')' : ''}`);
    }
  }

  // -------------------------------------------------------------
  // Test 1: Student Isolation for ownsStudent
  // -------------------------------------------------------------
  console.log('--- Test Group 1: Student Isolation & Ownership ---');

  // 1.1 Student accessing own record
  let reqSelf = { user: { id: 1, role: 'student', studentId: 101 }, params: { id: 101 } };
  let resSelf = createMockRes();
  let nextCalled = false;
  ownsStudent(reqSelf, resSelf, () => { nextCalled = true; });
  assert('1.1 Student accessing own record is permitted', nextCalled && resSelf.statusCode === 200);

  // 1.2 Student attempting to access another student's record
  let reqOther = { user: { id: 1, role: 'student', studentId: 101 }, params: { id: 999 } };
  let resOther = createMockRes();
  nextCalled = false;
  ownsStudent(reqOther, resOther, () => { nextCalled = true; });
  assert('1.2 Student accessing another student record is blocked (HTTP 403)', resOther.statusCode === 403 && !nextCalled);

  // -------------------------------------------------------------
  // Test 2: ownsStudentOrAssigned Authorization
  // -------------------------------------------------------------
  console.log('\n--- Test Group 2: Mini-Dashboard Access Authorization ---');

  // 2.1 Admin blocked from student mini-dashboard (HTTP 403 Forbidden)
  let reqAdmin = { user: { id: 99, role: 'admin' }, params: { id: 505 } };
  let resAdmin = createMockRes();
  nextCalled = false;
  await ownsStudentOrAssigned(reqAdmin, resAdmin, () => { nextCalled = true; });
  assert('2.1 Admin is strictly blocked from student mini-dashboard (HTTP 403)', !nextCalled && resAdmin.statusCode === 403);

  // 2.2 Student viewing own mini-dashboard
  let reqStudentMini = { user: { id: 5, role: 'student', studentId: 202 }, params: { id: 202 } };
  let resStudentMini = createMockRes();
  nextCalled = false;
  await ownsStudentOrAssigned(reqStudentMini, resStudentMini, () => { nextCalled = true; });
  assert('2.2 Student accessing own mini-dashboard is permitted', nextCalled && resStudentMini.statusCode === 200);

  // 2.3 Student viewing unassigned student mini-dashboard
  let reqStudentOtherMini = { user: { id: 5, role: 'student', studentId: 202 }, params: { id: 303 } };
  let resStudentOtherMini = createMockRes();
  nextCalled = false;
  await ownsStudentOrAssigned(reqStudentOtherMini, resStudentOtherMini, () => { nextCalled = true; });
  assert('2.3 Student accessing other student mini-dashboard is blocked (HTTP 403)', resStudentOtherMini.statusCode === 403 && !nextCalled);

  // 2.4 Missing student ID in request
  let reqNoId = { user: { id: 5, role: 'student', studentId: 202 }, params: {} };
  let resNoId = createMockRes();
  nextCalled = false;
  await ownsStudentOrAssigned(reqNoId, resNoId, () => { nextCalled = true; });
  assert('2.4 Request with missing student ID returns HTTP 400', resNoId.statusCode === 400 && !nextCalled);

  // -------------------------------------------------------------
  // Test 3: Safe Fee JSON Handling
  // -------------------------------------------------------------
  console.log('\n--- Test Group 3: Safe Parsing of Mini-Dashboard Fee & Activities ---');

  function safeParsePayments(feeRow) {
    let p = [];
    try {
      p = typeof feeRow.payments === 'string' ? JSON.parse(feeRow.payments) : (feeRow.payments || []);
    } catch (_) {
      p = [];
    }
    return { ...feeRow, payments: p };
  }

  const validJsonFee = { id: 1, payments: '[{"transaction_ref":"TXN-101","amount":5000}]' };
  const parsedValid = safeParsePayments(validJsonFee);
  assert('3.1 Valid JSON payment string parsed correctly', Array.isArray(parsedValid.payments) && parsedValid.payments.length === 1);

  const corruptedJsonFee = { id: 2, payments: 'INVALID_JSON_CORRUPTED{[' };
  const parsedCorrupt = safeParsePayments(corruptedJsonFee);
  assert('3.2 Corrupted JSON string falls back safely to empty array without crashing', Array.isArray(parsedCorrupt.payments) && parsedCorrupt.payments.length === 0);

  const nullJsonFee = { id: 3, payments: null };
  const parsedNull = safeParsePayments(nullJsonFee);
  assert('3.3 Null payments fall back safely to empty array', Array.isArray(parsedNull.payments) && parsedNull.payments.length === 0);

  console.log('\n===============================================================');
  console.log(`Phase 3 Test Execution Complete: ${passedCount} PASSED, ${failedCount} FAILED.`);
  console.log('===============================================================');

  if (failedCount > 0) process.exit(1);
}

runPhase3Tests().catch(err => {
  console.error('Fatal Phase 3 Test Error:', err);
  process.exit(1);
});
