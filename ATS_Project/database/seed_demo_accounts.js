/**
 * ATS Academic Tracking System — Safe & Idempotent Demo Accounts Seeder
 * 
 * Creates realistic, fictional demo accounts with Indian/Tamil naming conventions:
 * 1. Student Scholar: Kavitha Sundaram (DEMO-STU-01 / student123)
 * 2. Faculty Mentor:  Dr. Senthil Nathan (DEMO-FAC-01 / faculty123)
 * 3. Head of Dept:    Prof. Anand Ranganathan (DEMO-HOD-01 / hod123)
 * 4. Institutional Admin: Rajeshwari Administrator (DEMO-ADM-01 / admin123)
 * 
 * Strict Safety Rules:
 * - Production guard blocks execution in production without ALLOW_DEMO_SEED=true.
 * - Idempotent: running again does NOT duplicate records and does NOT reset existing passwords.
 * - Zero destructive SQL: Preserves existing database tables and records without destructive commands.
 * - Preserves all 100 live synthetic students, marks, attendance, and fee records.
 */

const bcrypt = require('bcryptjs');
const db = require('./db');

async function seedDemoAccounts(externalConn = null) {
  const queryExecutor = externalConn || db;

  console.log('===============================================================');
  console.log('=== ATS PROJECT — SAFE IDEMPOTENT DEMO ACCOUNTS SEEDER');
  console.log('===============================================================\n');

  // Strict Production & Ambiguous Environment Safety Guard
  const currentEnv = (process.env.NODE_ENV || '').toLowerCase().trim();
  const isSafeDemoEnv = currentEnv === 'development' || currentEnv === 'demo' || currentEnv === 'test';
  if ((process.env.NODE_ENV === 'production' || !isSafeDemoEnv) && process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error(
      `Refusing to seed demo accounts in environment '${currentEnv || 'undefined'}'. Demo seeding is disabled in production or ambiguous environments unless ALLOW_DEMO_SEED=true is explicitly set.`
    );
  }

  // Pre-hash demo passwords with salt rounds = 10
  const passwordHashes = {
    student: await bcrypt.hash('student123', 10),
    faculty: await bcrypt.hash('faculty123', 10),
    hod: await bcrypt.hash('hod123', 10),
    admin: await bcrypt.hash('admin123', 10)
  };

  // 1. Resolve Target Department (Default to CSE or first available)
  let departmentId = 1;
  const [deptRows] = await queryExecutor.query(
    "SELECT id, name FROM departments WHERE code = 'CSE' OR name LIKE '%Computer%' LIMIT 1"
  ).catch(() => [[]]);

  if (deptRows && deptRows.length > 0) {
    departmentId = deptRows[0].id;
    console.log(`[Demo Seed] Target Department: ${deptRows[0].name} (ID: ${departmentId})`);
  } else {
    const [anyDept] = await queryExecutor.query("SELECT id, name FROM departments LIMIT 1").catch(() => [[]]);
    if (anyDept && anyDept.length > 0) {
      departmentId = anyDept[0].id;
      console.log(`[Demo Seed] Target fallback Department: ${anyDept[0].name} (ID: ${departmentId})`);
    } else {
      console.log('[Demo Seed] Creating default CSE department for demo accounts...');
      const [newDept] = await queryExecutor.query(
        "INSERT INTO departments (name, code, description) VALUES ('Computer Science and Engineering', 'CSE', 'Core Computing Dept')"
      );
      departmentId = newDept.insertId;
    }
  }

  // -----------------------------------------------------------------
  // 2. Institutional Administrator (Rajeshwari Administrator)
  // -----------------------------------------------------------------
  console.log('\n[Demo Seed] Checking Institutional Admin...');
  const adminEmail = 'admin.demo@ats.edu';
  let [existingAdmin] = await queryExecutor.query('SELECT id, role, password FROM users WHERE email = ?', [adminEmail]);
  let adminUserId;

  if (existingAdmin.length > 0) {
    adminUserId = existingAdmin[0].id;
    if (existingAdmin[0].role !== 'admin') {
      throw new Error(`Conflict: Existing user ${adminEmail} has conflicting role ${existingAdmin[0].role}.`);
    }
    // Idempotent: Do NOT reset existing password
    await queryExecutor.query(
      `UPDATE users SET name = 'Rajeshwari Administrator', register_number = 'DEMO-ADM-01' WHERE id = ?`,
      [adminUserId]
    );
    console.log(`✅ Verified existing Demo Admin (User ID: ${adminUserId}, password unchanged)`);
  } else {
    const [res] = await queryExecutor.query(
      `INSERT INTO users (name, email, password, role, register_number)
       VALUES ('Rajeshwari Administrator', ?, ?, 'admin', 'DEMO-ADM-01')`,
      [adminEmail, passwordHashes.admin]
    );
    adminUserId = res.insertId;
    console.log(`✅ Created Demo Admin (User ID: ${adminUserId})`);
  }

  // -----------------------------------------------------------------
  // 3. Head of Department (Prof. Anand Ranganathan)
  // -----------------------------------------------------------------
  console.log('\n[Demo Seed] Checking Head of Department (HOD)...');
  const hodEmail = 'anand.demo@ats.edu';
  let [existingHodUser] = await queryExecutor.query('SELECT id, role, password FROM users WHERE email = ?', [hodEmail]);
  let hodUserId;

  if (existingHodUser.length > 0) {
    hodUserId = existingHodUser[0].id;
    if (existingHodUser[0].role !== 'faculty') {
      throw new Error(`Conflict: Existing user ${hodEmail} has conflicting role ${existingHodUser[0].role}.`);
    }
    // Idempotent: Do NOT reset existing password
    await queryExecutor.query(
      `UPDATE users SET name = 'Prof. Anand Ranganathan', register_number = 'DEMO-HOD-01' WHERE id = ?`,
      [hodUserId]
    );
    console.log(`✅ Verified existing Demo HOD User (User ID: ${hodUserId}, password unchanged)`);
  } else {
    const [res] = await queryExecutor.query(
      `INSERT INTO users (name, email, password, role, register_number)
       VALUES ('Prof. Anand Ranganathan', ?, ?, 'faculty', 'DEMO-HOD-01')`,
      [hodEmail, passwordHashes.hod]
    );
    hodUserId = res.insertId;
    console.log(`✅ Created Demo HOD User (User ID: ${hodUserId})`);
  }

  // Faculty Record for HOD
  let [existingHodFaculty] = await queryExecutor.query('SELECT id FROM faculty WHERE email = ? OR user_id = ?', [hodEmail, hodUserId]);
  let hodFacultyId;

  if (existingHodFaculty.length > 0) {
    hodFacultyId = existingHodFaculty[0].id;
    await queryExecutor.query(
      `UPDATE faculty SET name = 'Prof. Anand Ranganathan', department_id = ?, designation = 'Professor & Head of Department', faculty_code = 'DEMO-HOD-01', is_hod = 1, user_id = ? WHERE id = ?`,
      [departmentId, hodUserId, hodFacultyId]
    );
    console.log(`✅ Verified Demo HOD Faculty Record (Faculty ID: ${hodFacultyId})`);
  } else {
    const [res] = await queryExecutor.query(
      `INSERT INTO faculty (user_id, faculty_code, name, email, department_id, designation, is_hod)
       VALUES (?, 'DEMO-HOD-01', 'Prof. Anand Ranganathan', ?, ?, 'Professor & Head of Department', 1)`,
      [hodUserId, hodEmail, departmentId]
    );
    hodFacultyId = res.insertId;
    console.log(`✅ Created Demo HOD Faculty Record (Faculty ID: ${hodFacultyId})`);
  }

  // Ensure Active HOD Assignment in department_hod_assignments
  try {
    await queryExecutor.query(`
      CREATE TABLE IF NOT EXISTS department_hod_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        department_id INT NOT NULL,
        faculty_id INT NOT NULL,
        assigned_by INT NULL,
        start_date DATE NOT NULL,
        end_date DATE NULL,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        active_dept_id INT GENERATED ALWAYS AS (IF(status = 'active', department_id, NULL)) STORED,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_dept (department_id),
        KEY idx_fac (faculty_id),
        UNIQUE KEY uq_one_active_hod (active_dept_id)
      )
    `).catch(() => {});

    const [activeAssignment] = await queryExecutor.query(
      "SELECT id, faculty_id FROM department_hod_assignments WHERE department_id = ? AND status = 'active'",
      [departmentId]
    ).catch(() => [[]]);

    if (activeAssignment.length > 0 && activeAssignment[0].faculty_id === hodFacultyId) {
      console.log(`✅ Prof. Anand Ranganathan is already confirmed as Active HOD for Department ID: ${departmentId}`);
    } else if (activeAssignment.length > 0 && activeAssignment[0].faculty_id !== hodFacultyId) {
      // Department already has an active HOD who is NOT Anand - do not deactivate an unrelated HOD!
      const activeHodFacId = activeAssignment[0].faculty_id;
      const [curHod] = await queryExecutor.query('SELECT name FROM faculty WHERE id = ?', [activeHodFacId]).catch(() => [[]]);
      const curHodName = curHod && curHod[0] ? curHod[0].name : `Faculty #${activeHodFacId}`;
      console.log(`[Demo Seed] Department ID ${departmentId} already has active HOD: ${curHodName}. Seeking vacant department to preserve unrelated HOD...`);

      // Find an available department without an active HOD
      const [availableDepts] = await queryExecutor.query(`
        SELECT d.id, d.name 
        FROM departments d
        LEFT JOIN department_hod_assignments dha ON dha.department_id = d.id AND dha.status = 'active'
        WHERE dha.id IS NULL
        LIMIT 1
      `).catch(() => [[]]);

      if (availableDepts && availableDepts.length > 0) {
        departmentId = availableDepts[0].id;
        console.log(`[Demo Seed] Reallocated demo HOD to unassigned department: ${availableDepts[0].name} (ID: ${departmentId})`);
        await queryExecutor.query('UPDATE faculty SET department_id = ? WHERE id = ?', [departmentId, hodFacultyId]);
        await queryExecutor.query(
          `INSERT INTO department_hod_assignments (department_id, faculty_id, assigned_by, start_date, status)
           VALUES (?, ?, ?, CURDATE(), 'active')`,
          [departmentId, hodFacultyId, adminUserId]
        );
        console.log(`✅ Activated Prof. Anand Ranganathan as HOD for Department ID: ${departmentId}`);
      } else {
        throw new Error(`Conflict: Department ID ${departmentId} already has active HOD (${curHodName}) and no vacant department exists. Refusing to deactivate unrelated HOD.`);
      }
    } else {
      await queryExecutor.query(
        `INSERT INTO department_hod_assignments (department_id, faculty_id, assigned_by, start_date, status)
         VALUES (?, ?, ?, CURDATE(), 'active')`,
        [departmentId, hodFacultyId, adminUserId]
      );
      console.log(`✅ Activated Prof. Anand Ranganathan as HOD for Department ID: ${departmentId}`);
    }
  } catch (hodErr) {
    console.warn(`[Demo Seed] Note on department_hod_assignments: ${hodErr.message}`);
  }

  // -----------------------------------------------------------------
  // 4. Faculty Mentor (Dr. Senthil Nathan)
  // -----------------------------------------------------------------
  console.log('\n[Demo Seed] Checking Faculty Mentor...');
  const facultyEmail = 'senthil.demo@ats.edu';
  let [existingFacUser] = await queryExecutor.query('SELECT id, role, password FROM users WHERE email = ?', [facultyEmail]);
  let facUserId;

  if (existingFacUser.length > 0) {
    facUserId = existingFacUser[0].id;
    if (existingFacUser[0].role !== 'faculty') {
      throw new Error(`Conflict: Existing user ${facultyEmail} has conflicting role ${existingFacUser[0].role}.`);
    }
    // Idempotent: Do NOT reset existing password
    await queryExecutor.query(
      `UPDATE users SET name = 'Dr. Senthil Nathan', register_number = 'DEMO-FAC-01' WHERE id = ?`,
      [facUserId]
    );
    console.log(`✅ Verified existing Demo Faculty User (User ID: ${facUserId}, password unchanged)`);
  } else {
    const [res] = await queryExecutor.query(
      `INSERT INTO users (name, email, password, role, register_number)
       VALUES ('Dr. Senthil Nathan', ?, ?, 'faculty', 'DEMO-FAC-01')`,
      [facultyEmail, passwordHashes.faculty]
    );
    facUserId = res.insertId;
    console.log(`✅ Created Demo Faculty User (User ID: ${facUserId})`);
  }

  // Faculty Record for Mentor
  let [existingFac] = await queryExecutor.query('SELECT id FROM faculty WHERE email = ? OR user_id = ?', [facultyEmail, facUserId]);
  let mentorFacultyId;

  if (existingFac.length > 0) {
    mentorFacultyId = existingFac[0].id;
    await queryExecutor.query(
      `UPDATE faculty SET name = 'Dr. Senthil Nathan', department_id = ?, designation = 'Associate Professor & Mentor', faculty_code = 'DEMO-FAC-01', is_hod = 0, user_id = ? WHERE id = ?`,
      [departmentId, facUserId, mentorFacultyId]
    );
    console.log(`✅ Verified Demo Mentor Faculty Record (Faculty ID: ${mentorFacultyId})`);
  } else {
    const [res] = await queryExecutor.query(
      `INSERT INTO faculty (user_id, faculty_code, name, email, department_id, designation, is_hod)
       VALUES (?, 'DEMO-FAC-01', 'Dr. Senthil Nathan', ?, ?, 'Associate Professor & Mentor', 0)`,
      [facUserId, facultyEmail, departmentId]
    );
    mentorFacultyId = res.insertId;
    console.log(`✅ Created Demo Mentor Faculty Record (Faculty ID: ${mentorFacultyId})`);
  }

  // -----------------------------------------------------------------
  // 5. Student Scholar (Kavitha Sundaram)
  // -----------------------------------------------------------------
  console.log('\n[Demo Seed] Checking Student Scholar...');
  const studentEmail = 'kavitha.demo@ats.edu';
  let [existingStuUser] = await queryExecutor.query('SELECT id, role, password FROM users WHERE email = ?', [studentEmail]);
  let stuUserId;

  if (existingStuUser.length > 0) {
    stuUserId = existingStuUser[0].id;
    if (existingStuUser[0].role !== 'student') {
      throw new Error(`Conflict: Existing user ${studentEmail} has conflicting role ${existingStuUser[0].role}.`);
    }
    // Idempotent: Do NOT reset existing password
    await queryExecutor.query(
      `UPDATE users SET name = 'Kavitha Sundaram', register_number = 'DEMO-STU-01' WHERE id = ?`,
      [stuUserId]
    );
    console.log(`✅ Verified existing Demo Student User (User ID: ${stuUserId}, password unchanged)`);
  } else {
    const [res] = await queryExecutor.query(
      `INSERT INTO users (name, email, password, role, register_number)
       VALUES ('Kavitha Sundaram', ?, ?, 'student', 'DEMO-STU-01')`,
      [studentEmail, passwordHashes.student]
    );
    stuUserId = res.insertId;
    console.log(`✅ Created Demo Student User (User ID: ${stuUserId})`);
  }

  // Student Record
  let [existingStu] = await queryExecutor.query('SELECT id FROM students WHERE email = ? OR user_id = ?', [studentEmail, stuUserId]);
  let studentRecordId;

  if (existingStu.length > 0) {
    studentRecordId = existingStu[0].id;
    await queryExecutor.query(
      `UPDATE students SET name = 'Kavitha Sundaram', register_number = 'DEMO-STU-01', department_id = ?, year = 'III Year', semester = 'Semester 5', gpa = 8.90, cgpa = 8.85, attendance_percentage = 92.50, risk_level = 'LOW', status = 'active', user_id = ? WHERE id = ?`,
      [departmentId, stuUserId, studentRecordId]
    );
    console.log(`✅ Verified Demo Student Record (Student ID: ${studentRecordId})`);
  } else {
    const [res] = await queryExecutor.query(
      `INSERT INTO students (user_id, register_number, name, email, department_id, year, semester, gpa, cgpa, attendance_percentage, risk_level, status)
       VALUES (?, 'DEMO-STU-01', 'Kavitha Sundaram', ?, ?, 'III Year', 'Semester 5', 8.90, 8.85, 92.50, 'LOW', 'active')`,
      [stuUserId, studentEmail, departmentId]
    );
    studentRecordId = res.insertId;
    console.log(`✅ Created Demo Student Record (Student ID: ${studentRecordId})`);
  }

  // -----------------------------------------------------------------
  // 6. Mentor-Mentee Advisory Assignment (Dr. Senthil Nathan -> Kavitha Sundaram)
  // -----------------------------------------------------------------
  console.log('\n[Demo Seed] Checking Mentor-Mentee Advisory Link...');
  const [existingAssignment] = await queryExecutor.query(
    'SELECT id, status FROM student_mentors WHERE student_id = ? AND faculty_id = ?',
    [studentRecordId, mentorFacultyId]
  ).catch(() => [[]]);

  if (existingAssignment.length > 0) {
    if (existingAssignment[0].status !== 'active') {
      await queryExecutor.query(
        "UPDATE student_mentors SET status = 'active', updated_at = NOW() WHERE id = ?",
        [existingAssignment[0].id]
      );
    }
    console.log(`✅ Verified active mentorship link (ID: ${existingAssignment[0].id})`);
  } else {
    await queryExecutor.query(
      `INSERT INTO student_mentors (student_id, faculty_id, assigned_by, status, assigned_at)
       VALUES (?, ?, ?, 'active', NOW())`,
      [studentRecordId, mentorFacultyId, hodUserId || adminUserId]
    );
    console.log(`✅ Linked Kavitha Sundaram (Student #${studentRecordId}) under advisory of Dr. Senthil Nathan (Faculty #${mentorFacultyId})`);
  }

  // -----------------------------------------------------------------
  // 7. Seed Sample Fee Obligation for Demo Student (if missing)
  // -----------------------------------------------------------------
  const [existingFee] = await queryExecutor.query(
    'SELECT id FROM student_fees WHERE student_id = ?',
    [studentRecordId]
  ).catch(() => [[]]);

  if (existingFee.length === 0) {
    await queryExecutor.query(
      `INSERT INTO student_fees (student_id, fee_category, academic_year, semester, total_amount, paid_amount, balance_amount, status, due_date)
       VALUES (?, 'Semester Tuition & Amenities Fee', '2026-2027', 'Semester 5', 45000.00, 15000.00, 30000.00, 'Partially Paid', DATE_ADD(CURDATE(), INTERVAL 30 DAY))`,
      [studentRecordId]
    ).catch(() => {});
    console.log('✅ Created sample fee obligation for demo student payment simulation.');
  }

  console.log('\n===============================================================');
  console.log('=== DEMO ACCOUNTS SEEDING VERIFIED SUCCESSFULLY');
  console.log('===============================================================');
  console.log('Verified Demo Accounts (Credentials documented in README.md):');
  console.log('1. Student Scholar: kavitha.demo@ats.edu (DEMO-STU-01)');
  console.log('2. Faculty Mentor:  senthil.demo@ats.edu (DEMO-FAC-01)');
  console.log('3. Head of Dept:    anand.demo@ats.edu   (DEMO-HOD-01)');
  console.log('4. Institutional Admin: admin.demo@ats.edu (DEMO-ADM-01)');
  console.log('===============================================================\n');

  return {
    student: { email: studentEmail, password: 'student123', id: studentRecordId, role: 'student', reg: 'DEMO-STU-01' },
    mentor: { email: facultyEmail, password: 'faculty123', id: mentorFacultyId, role: 'faculty', code: 'DEMO-FAC-01' },
    hod: { email: hodEmail, password: 'hod123', id: hodFacultyId, role: 'faculty', isHOD: true, code: 'DEMO-HOD-01' },
    admin: { email: adminEmail, password: 'admin123', id: adminUserId, role: 'admin', reg: 'DEMO-ADM-01' }
  };
}

if (require.main === module) {
  seedDemoAccounts()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[Seed Error]', err.message);
      process.exit(1);
    });
}

module.exports = seedDemoAccounts;
