const db = require('../database/db');
const { createCheckoutSession, processDemoPayment } = require('../backend/controllers/feeController');

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

async function runPhase6Tests() {
  console.log('===============================================================');
  console.log('=== PHASE 6 REGRESSION TEST SUITE: SIMULATED PAYMENT ENGINE');
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

  // Set up mock DB state for deterministic testing
  let mockFee = {
    id: 101,
    student_id: 1,
    fee_category: 'Tuition Fee',
    academic_year: '2026-2027',
    semester: 'Semester 5',
    total_amount: 50000.00,
    paid_amount: 20000.00,
    balance_amount: 30000.00,
    status: 'Partially Paid',
    student_name: 'Kavitha Sundaram',
    register_number: 'DEMO-STU-01',
    user_id: 1
  };

  const recordedPayments = [];

  // Mock db.getConnection for transaction tests
  const originalGetConnection = db.getConnection;
  const originalQuery = db.query;

  db.query = async function(sql, params) {
    if (sql.includes('FROM student_fees sf')) {
      if (params[0] === 101) return [[mockFee]];
      return [[]];
    }
    return [[]];
  };

  db.getConnection = async function() {
    return {
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
      query: async (sql, params) => {
        if (sql.includes('SELECT * FROM student_fees WHERE id = ? FOR UPDATE')) {
          if (params[0] === 101) return [[{ ...mockFee }]];
          return [[]];
        }
        if (sql.includes('SELECT * FROM fee_payments WHERE notes LIKE ?')) {
          const keyMatch = params[0].match(/%Idempotency:([^%]+)%/);
          if (keyMatch) {
            const found = recordedPayments.find(p => p.notes && p.notes.includes(keyMatch[1]));
            return [found ? [found] : []];
          }
          return [[]];
        }
        if (sql.includes('UPDATE student_fees')) {
          mockFee.paid_amount = params[0];
          mockFee.balance_amount = params[1];
          mockFee.status = params[2];
          return [{ affectedRows: 1 }];
        }
        if (sql.includes('INSERT INTO fee_payments')) {
          const newPayment = {
            id: recordedPayments.length + 1,
            fee_id: params[0],
            student_id: params[1],
            transaction_ref: params[2],
            payment_method: params[3],
            amount: params[4],
            status: sql.includes("'Success'") ? 'Success' : sql.includes("'Failed'") ? 'Failed' : 'Pending',
            notes: params[5]
          };
          recordedPayments.push(newPayment);
          return [{ insertId: newPayment.id }];
        }
        return [[]];
      }
    };
  };

  // -------------------------------------------------------------
  // Test 1: Checkout Session Endpoint (/api/fees/checkout)
  // -------------------------------------------------------------
  console.log('--- Test Group 1: Checkout Session Initialization ---');

  // 1.1 Missing fee_id
  let reqNoFee = { user: { id: 1, role: 'student', studentId: 1 }, body: {} };
  let resNoFee = createMockRes();
  await createCheckoutSession(reqNoFee, resNoFee);
  assert('1.1 Checkout without fee_id returns HTTP 400', resNoFee.statusCode === 400);

  // 1.2 Non-existent fee_id
  let reqBadFee = { user: { id: 1, role: 'student', studentId: 1 }, body: { fee_id: 999 } };
  let resBadFee = createMockRes();
  await createCheckoutSession(reqBadFee, resBadFee);
  assert('1.2 Non-existent fee_id returns HTTP 404', resBadFee.statusCode === 404);

  // 1.3 Successful checkout session
  let reqGoodCheckout = { user: { id: 1, role: 'student', studentId: 1 }, body: { fee_id: 101 } };
  let resGoodCheckout = createMockRes();
  await createCheckoutSession(reqGoodCheckout, resGoodCheckout);
  assert('1.3 Valid fee_id returns checkout session (HTTP 200)', resGoodCheckout.statusCode === 200 && resGoodCheckout.body.success);
  assert('1.4 Checkout session provides order_ref and idempotency_key', Boolean(resGoodCheckout.body.checkout.order_ref && resGoodCheckout.body.checkout.idempotency_key));
  assert('1.5 Checkout session badges DEMO simulation notice', resGoodCheckout.body.checkout.notice.includes('DEMO PAYMENT'));

  // -------------------------------------------------------------
  // Test 2: Input & Balance Integrity Validation
  // -------------------------------------------------------------
  console.log('\n--- Test Group 2: Payment Amount & Balance Integrity ---');

  // 2.1 Non-positive amount
  let reqZero = { user: { id: 1, role: 'student', studentId: 1 }, body: { fee_id: 101, amount: 0 } };
  let resZero = createMockRes();
  await processDemoPayment(reqZero, resZero);
  assert('2.1 Zero amount payment is rejected with HTTP 400', resZero.statusCode === 400);

  // 2.2 Negative amount
  let reqNeg = { user: { id: 1, role: 'student', studentId: 1 }, body: { fee_id: 101, amount: -500 } };
  let resNeg = createMockRes();
  await processDemoPayment(reqNeg, resNeg);
  assert('2.2 Negative amount payment is rejected with HTTP 400', resNeg.statusCode === 400);

  // 2.3 Overpayment attempt (amount > balance)
  let reqOver = { user: { id: 1, role: 'student', studentId: 1 }, body: { fee_id: 101, amount: 999999 } };
  let resOver = createMockRes();
  await processDemoPayment(reqOver, resOver);
  assert('2.3 Overpayment attempt exceeds balance and is rejected with HTTP 400', resOver.statusCode === 400);

  // -------------------------------------------------------------
  // Test 3: Simulation Outcomes (Success, Failed, Cancelled, Pending)
  // -------------------------------------------------------------
  console.log('\n--- Test Group 3: Multi-Outcome Simulation Modes ---');

  // 3.1 Cancelled Outcome
  let reqCancel = {
    user: { id: 1, role: 'student', studentId: 1 },
    body: { fee_id: 101, amount: 5000, simulation_outcome: 'Cancelled' }
  };
  let resCancel = createMockRes();
  await processDemoPayment(reqCancel, resCancel);
  assert('3.1 Cancelled outcome returns status Cancelled without deducting balance', resCancel.body.status === 'Cancelled' && mockFee.balance_amount === 30000.00);

  // 3.2 Failed Outcome (Simulated card/bank decline)
  let reqFail = {
    user: { id: 1, role: 'student', studentId: 1 },
    body: { fee_id: 101, amount: 5000, simulation_outcome: 'Failed' }
  };
  let resFail = createMockRes();
  await processDemoPayment(reqFail, resFail);
  assert('3.2 Failed outcome returns status Failed with HTTP 400', resFail.statusCode === 400 && resFail.body.status === 'Failed');
  assert('3.3 Balance is NOT deducted after simulated failure', mockFee.balance_amount === 30000.00);

  // 3.3 Pending Outcome
  let reqPending = {
    user: { id: 1, role: 'student', studentId: 1 },
    body: { fee_id: 101, amount: 5000, simulation_outcome: 'Pending' }
  };
  let resPending = createMockRes();
  await processDemoPayment(reqPending, resPending);
  assert('3.4 Pending outcome returns status Pending', resPending.body.status === 'Pending');

  // 3.4 Success Outcome (Partial payment: 10000 out of 30000)
  const testIdempKey = 'TEST_IDEMP_12345';
  let reqSuccess = {
    user: { id: 1, role: 'student', studentId: 1 },
    body: {
      fee_id: 101,
      amount: 10000,
      payment_method: 'UPI Simulation',
      simulation_outcome: 'Success',
      idempotency_key: testIdempKey
    }
  };
  let resSuccess = createMockRes();
  await processDemoPayment(reqSuccess, resSuccess);
  assert('3.5 Success outcome returns HTTP 200', resSuccess.statusCode === 200);
  assert('3.6 Fee balance is accurately deducted (30000 - 10000 = 20000)', mockFee.balance_amount === 20000.00);
  assert('3.7 Transaction reference is generated', Boolean(resSuccess.body.transactionRef));

  // -------------------------------------------------------------
  // Test 4: Idempotency Protection
  // -------------------------------------------------------------
  console.log('\n--- Test Group 4: Idempotency Protection ---');

  // Re-submit identical request with same idempotency key
  let resDuplicate = createMockRes();
  await processDemoPayment(reqSuccess, resDuplicate);
  assert('4.1 Replaying request with existing idempotency key succeeds', resDuplicate.statusCode === 200);
  assert('4.2 Replayed request returns cached response without double-charging', resDuplicate.body.message.includes('Idempotent'));
  assert('4.3 Fee balance was NOT deducted a second time (still 20000)', mockFee.balance_amount === 20000.00);

  // Restore DB methods
  db.getConnection = originalGetConnection;
  db.query = originalQuery;

  console.log('\n===============================================================');
  console.log(`Phase 6 Test Execution Complete: ${passedCount} PASSED, ${failedCount} FAILED.`);
  console.log('===============================================================');

  if (failedCount > 0) process.exit(1);
}

runPhase6Tests().catch(err => {
  console.error('Fatal Phase 6 Test Error:', err);
  process.exit(1);
});
