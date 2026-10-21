const db = require('../../database/db');
const crypto = require('crypto');

// GET /api/fees/student/:studentId
async function getStudentFees(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);

    const [fees] = await db.query(
      `SELECT sf.*, 
              st.name AS student_name, st.register_number,
              d.name AS department_name
       FROM student_fees sf
       JOIN students st ON st.id = sf.student_id
       LEFT JOIN departments d ON d.id = st.department_id
       WHERE sf.student_id = ?
       ORDER BY sf.academic_year DESC, sf.created_at DESC`,
      [studentId]
    );

    const [payments] = await db.query(
      `SELECT fp.*, sf.fee_category, sf.academic_year, sf.semester
       FROM fee_payments fp
       JOIN student_fees sf ON sf.id = fp.fee_id
       WHERE fp.student_id = ?
       ORDER BY fp.payment_date DESC`,
      [studentId]
    );

    const totalDue = fees.reduce((sum, f) => sum + Number(f.total_amount || 0), 0);
    const totalPaid = fees.reduce((sum, f) => sum + Number(f.paid_amount || 0), 0);
    const totalBalance = fees.reduce((sum, f) => sum + Number(f.balance_amount || 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        fees,
        payments,
        summary: {
          totalDue,
          totalPaid,
          totalBalance
        }
      }
    });
  } catch (err) {
    console.error('[getStudentFees Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/fees/mentor-overview AND /api/fees/mentor/mentees
async function getMentorMenteeFees(req, res) {
  try {
    const facultyId = req.user.facultyId;
    if (!facultyId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Faculty profile not resolved.' });
    }

    let filterQuery = "WHERE sm.faculty_id = ? AND sm.status = 'active'";
    let filterParams = [facultyId];

    if (req.user.role === 'admin' && !facultyId) {
      filterQuery = '';
      filterParams = [];
    }

    const [rows] = await db.query(
      `SELECT sf.*, 
              st.name AS student_name, st.register_number, st.year,
              d.name AS department_name
       FROM student_fees sf
       JOIN student_mentors sm ON sm.student_id = sf.student_id
       JOIN students st ON st.id = sf.student_id
       LEFT JOIN departments d ON d.id = st.department_id
       ${filterQuery}
       ORDER BY st.register_number ASC, sf.academic_year DESC`,
      filterParams
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    console.error('[getMentorMenteeFees Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/fees/department
async function getDepartmentFees(req, res) {
  try {
    const departmentId = req.user.role === 'admin' && req.query.department_id
      ? parseInt(req.query.department_id, 10)
      : req.user.departmentId;

    if (!departmentId) {
      return res.status(400).json({ success: false, message: 'Department scope could not be determined.' });
    }

    const [rows] = await db.query(
      `SELECT sf.*, 
              st.name AS student_name, st.register_number, st.year,
              d.name AS department_name
       FROM student_fees sf
       JOIN students st ON st.id = sf.student_id
       JOIN departments d ON d.id = st.department_id
       WHERE st.department_id = ?
       ORDER BY st.register_number ASC, sf.academic_year DESC`,
      [departmentId]
    );

    const totalDue = rows.reduce((acc, r) => acc + Number(r.total_amount || 0), 0);
    const totalPaid = rows.reduce((acc, r) => acc + Number(r.paid_amount || 0), 0);
    const totalBalance = rows.reduce((acc, r) => acc + Number(r.balance_amount || 0), 0);

    return res.status(200).json({
      success: true,
      departmentId,
      count: rows.length,
      data: rows,
      summary: {
        totalDue,
        totalPaid,
        totalBalance
      }
    });
  } catch (err) {
    console.error('[getDepartmentFees Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/fees/institution (Admin only)
async function getInstitutionFees(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT sf.*, 
              st.name AS student_name, st.register_number, st.year,
              d.name AS department_name
       FROM student_fees sf
       JOIN students st ON st.id = sf.student_id
       JOIN departments d ON d.id = st.department_id
       ORDER BY sf.created_at DESC`
    );

    const [recentPayments] = await db.query(
      `SELECT fp.*, st.name AS student_name, st.register_number, sf.fee_category
       FROM fee_payments fp
       JOIN students st ON st.id = fp.student_id
       JOIN student_fees sf ON sf.id = fp.fee_id
       ORDER BY fp.payment_date DESC
       LIMIT 50`
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
      recentPayments
    });
  } catch (err) {
    console.error('[getInstitutionFees Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/fees/checkout (Initialize simulated payment checkout session)
async function createCheckoutSession(req, res) {
  try {
    const { fee_id } = req.body || {};

    if (!fee_id) {
      return res.status(400).json({
        success: false,
        message: 'Valid fee_id is required to create a checkout session.'
      });
    }

    const feeId = parseInt(fee_id, 10);
    const [feeRows] = await db.query(
      `SELECT sf.*, st.name AS student_name, st.register_number, st.user_id, d.name AS department_name
       FROM student_fees sf
       JOIN students st ON st.id = sf.student_id
       LEFT JOIN departments d ON d.id = st.department_id
       WHERE sf.id = ?`,
      [feeId]
    );

    if (feeRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Fee record not found.' });
    }

    const fee = feeRows[0];

    // Ownership check: Student can only checkout their own fee
    if (req.user.role === 'student' && fee.student_id !== req.user.studentId && fee.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only checkout your own fee obligations.'
      });
    }

    const orderRef = `ORD_${Date.now()}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const idempotencyKey = `IDEMP_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    return res.status(200).json({
      success: true,
      checkout: {
        order_ref: orderRef,
        idempotency_key: idempotencyKey,
        fee_id: fee.id,
        fee_category: fee.fee_category,
        academic_year: fee.academic_year,
        semester: fee.semester,
        total_amount: Number(fee.total_amount || 0),
        paid_amount: Number(fee.paid_amount || 0),
        balance_amount: Number(fee.balance_amount || 0),
        student_name: fee.student_name,
        register_number: fee.register_number,
        department_name: fee.department_name,
        supported_outcomes: ['Success', 'Failed', 'Cancelled', 'Pending'],
        allowed_methods: ['UPI Simulation', 'Card Simulation', 'Net-Banking Simulation'],
        notice: 'DEMO PAYMENT — NO REAL MONEY IS CHARGED'
      }
    });
  } catch (err) {
    console.error('[createCheckoutSession Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/fees/pay (Simulated Payment Gateway Transaction)
async function processDemoPayment(req, res) {
  const connection = await db.getConnection();
  try {
    const fee_id = req.body?.fee_id || req.body?.feeId;
    const amount = req.body?.amount;
    const payment_method = req.body?.payment_method || req.body?.paymentMethod;
    const idempotency_key = req.body?.idempotency_key || req.body?.idempotencyKey;
    const simulation_outcome = req.body?.simulation_outcome || req.body?.outcome;
    const simulate_failure = req.body?.simulate_failure;

    if (!fee_id || amount === undefined || amount === null) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Fee ID and payment amount are required.'
      });
    }

    const payAmount = Number(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be a positive numeric value.'
      });
    }

    // Determine target simulation outcome
    const outcome = simulation_outcome || (simulate_failure === true ? 'Failed' : 'Success');

    // Begin DB transaction with atomic locking
    await connection.beginTransaction();

    // Lock the fee row FOR UPDATE to prevent race conditions & duplicate payment deduction
    const [feeRows] = await connection.query(
      'SELECT * FROM student_fees WHERE id = ? FOR UPDATE',
      [fee_id]
    );

    if (feeRows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: 'Fee record not found.' });
    }

    const fee = feeRows[0];

    // Ownership check: Student can only pay their own fee
    if (req.user.role === 'student' && Number(fee.student_id) !== Number(req.user.studentId)) {
      await connection.rollback();
      connection.release();
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only make payments towards your own fee records.'
      });
    }

    const currentBalance = Number(fee.balance_amount || 0);

    if (currentBalance <= 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'This fee obligation has already been paid in full. Outstanding balance is 0.00.'
      });
    }

    if (payAmount > currentBalance) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: `Payment amount (${payAmount.toFixed(2)}) cannot exceed outstanding balance (${currentBalance.toFixed(2)}).`
      });
    }

    // Check idempotency if key provided (escape SQL wildcards to prevent broad matching)
    if (idempotency_key) {
      const cleanKey = String(idempotency_key).replace(/[%_\\]/g, '\\$&');
      const [existingTxn] = await connection.query(
        'SELECT * FROM fee_payments WHERE notes LIKE ?',
        [`%Idempotency:${cleanKey}%`]
      );
      if (existingTxn.length > 0) {
        await connection.rollback();
        connection.release();
        return res.status(200).json({
          success: true,
          status: existingTxn[0].status,
          message: 'Payment was already processed previously (Idempotent response).',
          transaction: existingTxn[0]
        });
      }
    }

    // Generate unique transaction reference
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    const timestampStr = Date.now().toString().slice(-6);
    const transactionRef = `ATS-TXN-${timestampStr}-${randomHex}`;

    // Handle Cancelled simulation outcome
    if (outcome === 'Cancelled') {
      await connection.query(
        `INSERT INTO fee_payments 
         (fee_id, student_id, transaction_ref, payment_method, amount, status, is_demo, payment_date, notes)
         VALUES (?, ?, ?, ?, ?, 'Cancelled', 1, NOW(), ?)`,
        [
          fee.id,
          fee.student_id,
          transactionRef,
          payment_method || 'Checkout Simulation',
          payAmount,
          `Simulated Payment Cancelled by User.${idempotency_key ? ' Idempotency:' + idempotency_key : ''}`
        ]
      );

      await connection.commit();
      connection.release();

      return res.status(200).json({
        success: true,
        status: 'Cancelled',
        message: 'DEMO PAYMENT CANCELLED: The user safely abandoned the simulated checkout.',
        transactionRef,
        amount: payAmount
      });
    }

    // Handle Failed simulation outcome
    if (outcome === 'Failed') {
      await connection.query(
        `INSERT INTO fee_payments 
         (fee_id, student_id, transaction_ref, payment_method, amount, status, is_demo, payment_date, notes)
         VALUES (?, ?, ?, ?, ?, 'Failed', 1, NOW(), ?)`,
        [
          fee.id,
          fee.student_id,
          transactionRef,
          payment_method || 'Card Simulation',
          payAmount,
          `Simulated Payment Gateway Failure.${idempotency_key ? ' Idempotency:' + idempotency_key : ''}`
        ]
      );

      await connection.commit();
      connection.release();

      return res.status(400).json({
        success: false,
        status: 'Failed',
        message: 'DEMO PAYMENT SIMULATION FAILED: Issuer bank simulator declined the transaction.',
        transactionRef
      });
    }

    // Handle Pending simulation outcome
    if (outcome === 'Pending') {
      await connection.query(
        `INSERT INTO fee_payments 
         (fee_id, student_id, transaction_ref, payment_method, amount, status, is_demo, payment_date, notes)
         VALUES (?, ?, ?, ?, ?, 'Pending', 1, NOW(), ?)`,
        [
          fee.id,
          fee.student_id,
          transactionRef,
          payment_method || 'Net-Banking Simulation',
          payAmount,
          `Simulated Payment Pending Confirmation.${idempotency_key ? ' Idempotency:' + idempotency_key : ''}`
        ]
      );

      await connection.commit();
      connection.release();

      return res.status(200).json({
        success: true,
        status: 'Pending',
        message: 'DEMO PAYMENT PENDING: Awaiting confirmation from simulated payment clearinghouse.',
        transactionRef,
        amount: payAmount
      });
    }

    // Successful Demo Payment
    const newPaidAmount = Number(fee.paid_amount || 0) + payAmount;
    const newBalanceAmount = Number(fee.total_amount || 0) - newPaidAmount;
    const newStatus = newBalanceAmount <= 0.01 ? 'Paid' : 'Partially Paid';

    // 1. Update fee balance in database
    await connection.query(
      `UPDATE student_fees 
       SET paid_amount = ?, balance_amount = ?, status = ?, updated_at = NOW() 
       WHERE id = ?`,
      [newPaidAmount, Math.max(0, newBalanceAmount), newStatus, fee.id]
    );

    // 2. Insert payment transaction record
    const noteText = `Simulated Payment via ${payment_method || 'Demo Gateway'}.${idempotency_key ? ' Idempotency:' + idempotency_key : ''}`;
    const [payResult] = await connection.query(
      `INSERT INTO fee_payments 
       (fee_id, student_id, transaction_ref, payment_method, amount, status, is_demo, payment_date, notes)
       VALUES (?, ?, ?, ?, ?, 'Success', 1, NOW(), ?)`,
      [
        fee.id,
        fee.student_id,
        transactionRef,
        payment_method || 'UPI Simulation',
        payAmount,
        noteText
      ]
    );

    await connection.commit();
    connection.release();

    return res.status(200).json({
      success: true,
      status: 'Success',
      paymentStatus: 'Success',
      message: 'Demo payment completed successfully. No real money was transferred.',
      paymentId: payResult.insertId,
      transactionRef,
      paidAmount: payAmount,
      remainingBalance: Math.max(0, newBalanceAmount),
      feeStatus: newStatus
    });

  } catch (err) {
    try { await connection.rollback(); } catch (_) {}
    try { connection.release(); } catch (_) {}
    console.error('[processDemoPayment Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/fees/receipt/:transactionRef (Official printable receipt with DEMO notice)
async function getPaymentReceipt(req, res) {
  try {
    const { transactionRef } = req.params;

    const [rows] = await db.query(
      `SELECT fp.*, 
              st.name AS student_name, st.register_number, st.year, st.semester AS current_semester, st.email AS student_email,
              d.name AS department_name,
              sf.fee_category, sf.academic_year, sf.total_amount, sf.paid_amount AS total_paid_to_date, sf.balance_amount AS remaining_balance
       FROM fee_payments fp
       JOIN students st ON st.id = fp.student_id
       JOIN student_fees sf ON sf.id = fp.fee_id
       LEFT JOIN departments d ON d.id = st.department_id
       WHERE fp.transaction_ref = ?`,
      [transactionRef]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Receipt not found for this transaction reference.' });
    }

    const receipt = rows[0];

    // Ensure student ownership if student user
    if (req.user.role === 'student' && receipt.student_id !== req.user.studentId) {
      return res.status(403).json({ success: false, message: 'Access denied: You can only view your own receipts.' });
    }

    const enrichedReceipt = {
      ...receipt,
      transactionRef: receipt.transaction_ref,
      feeCategory: receipt.fee_category,
      academicYear: receipt.academic_year,
      totalAmount: receipt.total_amount,
      paidAmount: receipt.amount,
      remainingBalance: receipt.remaining_balance
    };

    return res.status(200).json({
      success: true,
      institution: 'Academic Progress & Achievement Tracking System (ATS)',
      disclaimer: 'DEMO PAYMENT SIMULATION — NO REAL MONEY WAS TRANSFERRED',
      receipt: enrichedReceipt,
      data: enrichedReceipt
    });
  } catch (err) {
    console.error('[getPaymentReceipt Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/fees/invoice/:feeId (Fee invoice)
async function getFeeInvoice(req, res) {
  try {
    const feeId = parseInt(req.params.feeId, 10);

    const [rows] = await db.query(
      `SELECT sf.*, 
              st.name AS student_name, st.register_number, st.year, st.email AS student_email,
              d.name AS department_name
       FROM student_fees sf
       JOIN students st ON st.id = sf.student_id
       LEFT JOIN departments d ON d.id = st.department_id
       WHERE sf.id = ?`,
      [feeId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Fee invoice record not found.' });
    }

    const invoice = rows[0];

    if (req.user.role === 'student' && invoice.student_id !== req.user.studentId) {
      return res.status(403).json({ success: false, message: 'Access denied: You can only view your own invoices.' });
    }

    const [payments] = await db.query(
      'SELECT * FROM fee_payments WHERE fee_id = ? ORDER BY payment_date DESC',
      [feeId]
    );

    return res.status(200).json({
      success: true,
      institution: 'Academic Progress & Achievement Tracking System (ATS)',
      invoiceNumber: `ATS-INV-${invoice.academic_year.replace(/\s+/g, '')}-${invoice.id}`,
      invoice,
      payments
    });
  } catch (err) {
    console.error('[getFeeInvoice Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/fees/transactions (Admin Reconciliation of Demo Payments)
async function getDemoPaymentTransactions(req, res) {
  try {
    const { department_id, status, student_id, search, date_from, date_to, limit = 50, page = 1 } = req.query;

    const conditions = ['1=1'];
    const params = [];

    if (department_id) {
      conditions.push('st.department_id = ?');
      params.push(parseInt(department_id, 10));
    }

    if (status && status !== 'all') {
      conditions.push('fp.status = ?');
      params.push(status);
    }

    if (student_id) {
      conditions.push('fp.student_id = ?');
      params.push(parseInt(student_id, 10));
    }

    if (search) {
      conditions.push('(st.name LIKE ? OR st.register_number LIKE ? OR fp.transaction_ref LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (date_from) {
      conditions.push('DATE(fp.payment_date) >= ?');
      params.push(date_from);
    }

    if (date_to) {
      conditions.push('DATE(fp.payment_date) <= ?');
      params.push(date_to);
    }

    const whereClause = conditions.join(' AND ');
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    // Total counts & aggregate stats
    const [[stats]] = await db.query(`
      SELECT 
        COUNT(*) AS total_count,
        SUM(CASE WHEN fp.status = 'Success' THEN fp.amount ELSE 0 END) AS total_successful_amount,
        SUM(CASE WHEN fp.status = 'Success' THEN 1 ELSE 0 END) AS success_count,
        SUM(CASE WHEN fp.status = 'Failed' THEN 1 ELSE 0 END) AS failed_count,
        SUM(CASE WHEN fp.status = 'Pending' THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN fp.status = 'Cancelled' THEN 1 ELSE 0 END) AS cancelled_count
      FROM fee_payments fp
      JOIN student_fees sf ON sf.id = fp.fee_id
      JOIN students st ON st.id = fp.student_id
      WHERE ${whereClause}
    `, params);

    // Paginated rows
    const [rows] = await db.query(`
      SELECT fp.*,
             st.name AS student_name, st.register_number, st.year AS student_year,
             d.name AS department_name, d.code AS department_code,
             sf.fee_category, sf.academic_year, sf.semester,
             sf.total_amount AS fee_total_amount,
             sf.paid_amount AS fee_paid_amount,
             sf.balance_amount AS fee_balance_amount,
             sf.status AS fee_status
      FROM fee_payments fp
      JOIN student_fees sf ON sf.id = fp.fee_id
      JOIN students st ON st.id = fp.student_id
      LEFT JOIN departments d ON d.id = st.department_id
      WHERE ${whereClause}
      ORDER BY fp.payment_date DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit, 10), offset]);

    return res.status(200).json({
      success: true,
      stats: {
        totalTransactions: Number(stats?.total_count || 0),
        totalSuccessfulAmount: Number(stats?.total_successful_amount || 0),
        successCount: Number(stats?.success_count || 0),
        failedCount: Number(stats?.failed_count || 0),
        pendingCount: Number(stats?.pending_count || 0),
        cancelledCount: Number(stats?.cancelled_count || 0)
      },
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      data: rows.map(r => ({
        id: r.id,
        transactionRef: r.transaction_ref,
        studentId: r.student_id,
        studentName: r.student_name,
        registerNumber: r.register_number,
        studentYear: r.student_year,
        departmentName: r.department_name,
        departmentCode: r.department_code,
        feeId: r.fee_id,
        feeCategory: r.fee_category,
        academicYear: r.academic_year,
        semester: r.semester,
        paymentMethod: r.payment_method,
        amount: Number(r.amount),
        status: r.status,
        isDemo: Boolean(r.is_demo),
        paymentDate: r.payment_date,
        notes: r.notes,
        reconciliation: {
          feeTotal: Number(r.fee_total_amount),
          feePaid: Number(r.fee_paid_amount),
          feeBalance: Number(r.fee_balance_amount),
          feeStatus: r.fee_status,
          reconciled: r.status === 'Success' ? (Number(r.fee_paid_amount) > 0) : true
        }
      }))
    });
  } catch (err) {
    console.error('[getDemoPaymentTransactions Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  createCheckoutSession,
  getStudentFees,
  getMentorMenteeFees,
  getDepartmentFees,
  getInstitutionFees,
  processDemoPayment,
  getPaymentReceipt,
  getFeeInvoice,
  getDemoPaymentTransactions
};

