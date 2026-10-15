/**
 * ATS Academic Tracking System — Safe & Idempotent Demo Accounts Seeder
 * 
 * Creates realistic, fictional demo accounts with Indian/Tamil naming conventions:
 * 1. Student: Kavitha Sundaram (DEMO-STU-01 / student123)
 * 2. Faculty Mentor: Dr. Senthil Nathan (DEMO-FAC-01 / faculty123)
 * 3. Head of Department: Prof. Anand Ranganathan (DEMO-HOD-01 / hod123)
 * 4. Institutional Admin: Rajeshwari Administrator (DEMO-ADM-01 / admin123)
 * 
 * Safety Rules:
 * - Production guard blocks accidental execution without ALLOW_DEMO_SEED=true.
 * - Idempotent upserts; never drops, truncates, or resets existing tables.
 * - Preserves all live non-demo student, marks, fee, and attendance records.
 */

const bcrypt = require('bcryptjs');
const db = require('./db');

async function seedDemoAccounts() {
  console.log('===============================================================');
  console.log('=== ATS PROJECT — SAFE IDEMPOTENT DEMO ACCOUNTS SEEDER');
  console.log('===============================================================\n');

  // Strict Production Safety Guard
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Refusing to seed demo accounts in production without ALLOW_DEMO_SEED=true');
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
  const [deptRows] = await db.query(
    "SELECT id, name FROM departments WHERE code = 'CSE' OR name LIKE '%Computer%' LIMIT 1"
  ).catch(() => [[]]);

  if (deptRows && deptRows.length > 0) {
    departmentId = deptRows[0].id;
    console.log(`[Demo Seed] Using Department: ${deptRows[0].name} (ID: ${departmentId})`);
  } else {
    // Fallback: check any department
    const [anyDept] = await db.query("SELECT id, name FROM departments LIMIT 1").catch(() => [[]]);
    if (anyDept && anyDept.length > 0) {
      departmentId = anyDept[0].id;
      console.log(`[Demo Seed] Using fallback Department: ${anyDept[0].name} (ID: ${departmentId})`);
    } else {
      console.log('[Demo Seed] Creating default CSE department for demo accounts...');
      const [newDept] = await db.query(
        "INSERT INTO departments (name, code, description) VALUES ('Computer Science and Engineering', 'CSE', 'Core Computing Dept')"
      );
      departmentId = newDept.insertId;
    }
  }

  // -----------------------------------------------------------------
  // 2. Institutional Administrator (Rajeshwari Administrator)
  // -----------------------------------------------------------------
  console.log('\n[Demo Seed] Seeding Institutional Admin...');
  const adminEmail = 'admin.demo@ats.edu';
  let [existingAdmin] = await db.query('SELECT id FROM users WHERE email = ?', [adminEmail]);
  let adminUserId;

  if (existingAdmin.length > 0) {
    adminUserId = existingAdmin[0].id;
    await db.query(
      `UPDATE users SET name = 'Rajeshwari Administrator', password = ?, role = 'admin', register_number = 'DEMO-ADM-01' WHERE id = ?`,
      [passwordHashes.admin, adminUserId]
    );
    console.log(`✅ Updated existing Demo Admin (User ID: ${adminUserId})`);
  } else {
    const [res] = await db.query(
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
  console.log('\n[Demo Seed] Seeding Head of Department (HOD)...');
  const hodEmail = 'anand.demo@ats.edu';
  let [existingHodUser] = await db.query('SELECT id FROM users WHERE email = ?', [hodEmail]);
  let hodUserId;

  if (existingHodUser.length > 0) {
    hodUserId = existingHodUser[0].id;
    await db.query(
      `UPDATE users SET name = 'Prof. Anand Ranganathan', password = ?, role = 'faculty', register_number = 'DEMO-HOD-01' WHERE id = ?`,
      [passwordHashes.hod, hodUserId]
    );
    console.log(`✅ Updated existing Demo HOD User (User ID: ${hodUserId})`);
  } else {
    const [res] = await db.query(
      `INSERT INTO users (name, email, password, role, register_number)
       VALUES ('Prof. Anand Ranganathan', ?, ?, 'faculty', 'DEMO-HOD-01')`,
      [hodEmail, passwordHashes.hod]
    );
    hodUserId = res.insertId;
    console.log(`✅ Created Demo HOD User (User ID: ${hodUserId})`);
  }

  // Faculty Record for HOD
  let [existingHodFaculty] = await db.query('SELECT id FROM faculty WHERE email = ? OR user_id = ?', [hodEmail, hodUserId]);
  let hodFacultyId;

  if (existingHodFaculty.length > 0) {
    hodFacultyId = existingHodFaculty[0].id;
    await db.query(
      `UPDATE faculty SET name = 'Prof. Anand Ranganathan', department_id = ?, designation = 'Professor & Head of Department', faculty_code = 'DEMO-HOD-01', is_hod = 1, user_id = ? WHERE id = ?`,
      [departmentId, hodUserId, hodFacultyId]
    );
    console.log(`✅ Updated existing Demo HOD Faculty Record (Faculty ID: ${hodFacultyId})`);
  } else {
    const [res] = await db.query(
      `INSERT INTO faculty (user_id, faculty_code, name, email, department_id, designation, is_hod)
       VALUES (?, 'DEMO-HOD-01', 'Prof. Anand Ranganathan', ?, ?, 'Professor & Head of Department', 1)`,
      [hodUserId, hodEmail, departmentId]
    );
    hodFacultyId = res.insertId;
    console.log(`✅ Created Demo HOD Faculty Record (Faculty ID: ${hodFacultyId})`);
  }

  // Ensure Active HOD Assignment in department_hod_assignments
  try {
    // Clear other active assignments for this department to maintain single-active constraint
    await db.query(
      "UPDATE department_hod_assignments SET status = 'inactive' WHERE department_id = ? AND faculty_id != ?",
      [departmentId, hodFacultyId]
    );
    await db.query(
      `INSERT INTO department_hod_assignments (department_id, faculty_id, assigned_by, start_date, status)
       VALUES (?, ?, ?, CURDATE(), 'active')
       ON DUPLICATE KEY UPDATE status = 'active', faculty_id = ?`,
      [departmentId, hodFacultyId, adminUserId, hodFacultyId]
    );
    console.log(`✅ Assigned Prof. Anand Ranganathan as Active HOD for Department ID: ${departmentId}`);
  } catch (hodErr) {
    console.warn(`[Demo Seed] Note on department_hod_assignments: ${hodErr.message}`);
  }

  // -----------------------------------------------------------------
  // 4. Faculty Mentor (Dr. Senthil Nathan)
  // -----------------------------------------------------------------
  console.log('\n[Demo Seed] Seeding Faculty Mentor...');
  const facultyEmail = 'senthil.demo@ats.edu';
  let [existingFacUser] = await db.query('SELECT id FROM users WHERE email = ?', [facultyEmail]);
  let facUserId;

  if (existingFacUser.length > 0) {
    facUserId = existingFacUser[0].id;
    await db.query(
      `UPDATE users SET name = 'Dr. Senthil Nathan', password = ?, role = 'faculty', register_number = 'DEMO-FAC-01' WHERE id = ?`,
      [passwordHashes.faculty, facUserId]
    );
    console.log(`✅ Updated existing Demo Faculty User (User ID: ${facUserId})`);
  } else {
    const [res] = await db.query(
      `INSERT INTO users (name, email, password, role, register_number)
       VALUES ('Dr. Senthil Nathan', ?, ?, 'faculty', 'DEMO-FAC-01')`,
      [facultyEmail, passwordHashes.faculty]
    );
    facUserId = res.insertId;
    console.log(`✅ Created Demo Faculty User (User ID: ${facUserId})`);
  }

  // Faculty Record for Mentor
  let [existingFac] = await db.query('SELECT id FROM faculty WHERE email = ? OR user_id = ?', [facultyEmail, facUserId]);
  let mentorFacultyId;

  if (existingFac.length > 0) {
    mentorFacultyId = existingFac[0].id;
    await db.query(
      `UPDATE faculty SET name = 'Dr. Senthil Nathan', department_id = ?, designation = 'Associate Professor & Mentor', faculty_code = 'DEMO-FAC-01', is_hod = 0, user_id = ? WHERE id = ?`,
      [departmentId, facUserId, mentorFacultyId]
    );
    console.log(`✅ Updated existing Demo Mentor Faculty Record (Faculty ID: ${mentorFacultyId})`);
  } else {
    const [res] = await db.query(
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
  console.log('\n[Demo Seed] Seeding Student Scholar...');
  const studentEmail = 'kavitha.demo@ats.edu';
  let [existingStuUser] = await db.query('SELECT id FROM users WHERE email = ?', [studentEmail]);
  let stuUserId;

  if (existingStuUser.length > 0) {
    stuUserId = existingStuUser[0].id;
    await db.query(
      `UPDATE users SET name = 'Kavitha Sundaram', password = ?, role = 'student', register_number = 'DEMO-STU-01' WHERE id = ?`,
      [passwordHashes.student, stuUserId]
    );
    console.log(`✅ Updated existing Demo Student User (User ID: ${stuUserId})`);
  } else {
    const [res] = await db.query(
      `INSERT INTO users (name, email, password, role, register_number)
       VALUES ('Kavitha Sundaram', ?, ?, 'student', 'DEMO-STU-01')`,
      [studentEmail, passwordHashes.student]
    );
    stuUserId = res.insertId;
    console.log(`✅ Created Demo Student User (User ID: ${stuUserId})`);
  }

  // Student Record
  let [existingStu] = await db.query('SELECT id FROM students WHERE email = ? OR user_id = ?', [studentEmail, stuUserId]);
  let studentRecordId;

  if (existingStu.length > 0) {
    studentRecordId = existingStu[0].id;
    await db.query(
      `UPDATE students SET name = 'Kavitha Sundaram', register_number = 'DEMO-STU-01', department_id = ?, year = 'III Year', semester = 'Semester 5', gpa = 8.90, cgpa = 8.85, attendance_percentage = 92.50, risk_level = 'LOW', status = 'active', user_id = ? WHERE id = ?`,
      [departmentId, stuUserId, studentRecordId]
    );
    console.log(`✅ Updated existing Demo Student Record (Student ID: ${studentRecordId})`);
  } else {
    const [res] = await db.query(
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
  console.log('\n[Demo Seed] Establishing Mentor-Mentee Advisory Link...');
  const [existingAssignment] = await db.query(
    'SELECT id, status FROM student_mentors WHERE student_id = ? AND faculty_id = ?',
    [studentRecordId, mentorFacultyId]
  ).catch(() => [[]]);

  if (existingAssignment.length > 0) {
    await db.query(
      "UPDATE student_mentors SET status = 'active', updated_at = NOW() WHERE id = ?",
      [existingAssignment[0].id]
    );
    console.log(`✅ Verified active mentorship link (ID: ${existingAssignment[0].id})`);
  } else {
    await db.query(
      `INSERT INTO student_mentors (student_id, faculty_id, assigned_by, status, assigned_at)
       VALUES (?, ?, ?, 'active', NOW())`,
      [studentRecordId, mentorFacultyId, hodUserId || adminUserId]
    );
    console.log(`✅ Linked Kavitha Sundaram (Student #${studentRecordId}) under advisory of Dr. Senthil Nathan (Faculty #${mentorFacultyId})`);
  }

  console.log('\n===============================================================');
  console.log('=== DEMO ACCOUNTS SEEDING COMPLETED SUCCESSFULLY');
  console.log('===============================================================');
  console.log('Credentials Summary:');
  console.log('1. Student:    kavitha.demo@ats.edu / student123  (DEMO-STU-01)');
  console.log('2. Mentor:     senthil.demo@ats.edu / faculty123  (DEMO-FAC-01)');
  console.log('3. HOD:        anand.demo@ats.edu   / hod123      (DEMO-HOD-01)');
  console.log('4. Admin:      admin.demo@ats.edu   / admin123    (DEMO-ADM-01)');
  console.log('===============================================================\n');

  return {
    student: { email: studentEmail, password: 'student123', id: studentRecordId },
    mentor: { email: facultyEmail, password: 'faculty123', id: mentorFacultyId },
    hod: { email: hodEmail, password: 'hod123', id: hodFacultyId },
    admin: { email: adminEmail, password: 'admin123', id: adminUserId }
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
