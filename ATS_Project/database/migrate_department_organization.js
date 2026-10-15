/**
 * ATS Academic Tracking System — Department-Wise Organization & Full HOD Alignment
 * 
 * Objectives:
 * 1. Ensure all 25 institutional departments have an active Head of Department (HOD) in `department_hod_assignments`.
 * 2. Add realistic faculty staff records consistently to departments lacking staff without duplicating existing records or codes.
 * 3. Assign any unmentored students evenly to faculty mentors within the same department.
 * 4. Print structured Before and After breakdown tables.
 * 
 * Safety:
 * - Safe, idempotent execution: Re-running does not corrupt or duplicate data.
 * - Zero destructive SQL: Never drops or truncates tables.
 */

const bcrypt = require('bcryptjs');
const db = require('./db');

const DEPT_FACULTY_NAMES = {
  AGR: ['Dr. R. Marimuthu', 'Dr. S. Kavitha'],
  AIDS: ['Dr. P. Meenakshi', 'Dr. T. Naveen'],
  AIML: ['Dr. K. Vignesh', 'Dr. M. Deepa'],
  BME: ['Dr. S. Jayakumar', 'Dr. R. Malathi'],
  BT: ['Dr. N. Saravanan', 'Dr. G. Revathi'],
  CHEM: ['Dr. C. Subramanian', 'Dr. A. Bhuvaneswari'],
  CIV: ['Dr. M. Govindaraj', 'Dr. P. Senthamarai'],
  CSBS: ['Dr. V. Ramasamy', 'Dr. E. Sasikala'],
  CSD: ['Dr. D. Chandrasekar', 'Dr. S. Hemalatha'],
  CSE: ['Dr. K. Senthil Kumar', 'Dr. B. Vijayalakshmi'],
  CT: ['Dr. A. Arunkumar', 'Dr. T. Geetha'],
  EEE: ['Dr. R. Natarajan', 'Dr. S. Poornima'],
  ECE: ['Dr. G. Balasubramanian', 'Dr. N. Kalaiselvi'],
  EIE: ['Dr. T. Krishnan', 'Dr. M. Soundarya'],
  FT: ['Dr. K. Padmavathi', 'Dr. R. Thangavel'],
  FOOD: ['Dr. S. Sundararajan', 'Dr. J. Kokila'],
  HUM: ['Dr. N. Viswanathan', 'Dr. P. Chitra'],
  ISE: ['Dr. V. Murugesan', 'Dr. A. Sathya'],
  IT: ['Dr. C. Loganathan', 'Dr. K. Banumathi'],
  MATH: ['Dr. R. Srinivasan', 'Dr. M. Vasanthi'],
  MECH: ['Dr. P. Thirunavukkarasu', 'Dr. D. Gomathi'],
  MTR: ['Dr. K. Elangovan', 'Dr. S. Manimegalai'],
  PE: ['Dr. A. Dharmalingam', 'Dr. V. Shenbagam'],
  PHY: ['Dr. S. Ramanathan', 'Dr. K. Shanthi'],
  SMS: ['Dr. G. Venkataraman', 'Dr. P. Usharani']
};

async function getDepartmentBreakdown(executor = db) {
  const [rows] = await executor.query(`
    SELECT 
      d.id, 
      d.code, 
      d.name,
      COUNT(DISTINCT s.id) AS total_students,
      COUNT(DISTINCT f.id) AS total_faculty,
      (
        SELECT f_hod.name 
        FROM department_hod_assignments dha 
        JOIN faculty f_hod ON dha.faculty_id = f_hod.id 
        WHERE dha.department_id = d.id AND dha.status = 'active' 
        LIMIT 1
      ) AS active_hod_name,
      COUNT(DISTINCT sm.student_id) AS mentored_students
    FROM departments d
    LEFT JOIN students s ON s.department_id = d.id
    LEFT JOIN faculty f ON f.department_id = d.id
    LEFT JOIN student_mentors sm ON sm.student_id = s.id AND sm.status = 'active'
    GROUP BY d.id, d.code, d.name
    ORDER BY d.id ASC
  `);

  return rows.map(r => ({
    ID: r.id,
    Code: r.code,
    Name: r.name.length > 28 ? r.name.substring(0, 26) + '...' : r.name,
    Students: Number(r.total_students),
    Faculty: Number(r.total_faculty),
    HOD: r.active_hod_name ? (r.active_hod_name.length > 25 ? r.active_hod_name.substring(0, 23) + '...' : r.active_hod_name) : 'NONE',
    Mentored: Number(r.mentored_students),
    Unmentored: Number(r.total_students) - Number(r.mentored_students)
  }));
}

async function organizeDepartments() {
  console.log('======================================================================');
  console.log('🏢 ATS PHASE 3 — DEPARTMENT-WISE ORGANIZATION & HOD ALIGNMENT');
  console.log('======================================================================\n');

  console.log('--- Step 1: Baseline Department Snapshot (Before Migration) ---');
  const beforeSnapshot = await getDepartmentBreakdown();
  console.table(beforeSnapshot);

  const beforeTotalStudents = beforeSnapshot.reduce((a, b) => a + b.Students, 0);
  const beforeTotalFaculty = beforeSnapshot.reduce((a, b) => a + b.Faculty, 0);
  const beforeHODCount = beforeSnapshot.filter(b => b.HOD !== 'NONE').length;
  const beforeUnmentored = beforeSnapshot.reduce((a, b) => a + b.Unmentored, 0);

  console.log(`Summary Before: Departments=${beforeSnapshot.length}, Students=${beforeTotalStudents}, Faculty=${beforeTotalFaculty}, Active HODs=${beforeHODCount}/25, Unmentored Students=${beforeUnmentored}\n`);

  // Shared password hash for new demo staff accounts
  const defaultPasswordHash = await bcrypt.hash('faculty123', 10);

  // Fetch all 25 departments
  const [departments] = await db.query('SELECT id, code, name FROM departments ORDER BY id ASC');

  let hodsCreated = 0;
  let facultyCreated = 0;
  let mentorsAssigned = 0;

  for (const dept of departments) {
    const code = dept.code.toUpperCase();
    const names = DEPT_FACULTY_NAMES[code] || [`Dr. HOD ${code}`, `Dr. Faculty ${code}`];

    // Check existing active HOD
    const [hodRows] = await db.query(`
      SELECT dha.id, dha.faculty_id, f.name 
      FROM department_hod_assignments dha
      JOIN faculty f ON dha.faculty_id = f.id
      WHERE dha.department_id = ? AND dha.status = 'active'
      LIMIT 1
    `, [dept.id]);

    let activeHodFacultyId = hodRows.length > 0 ? hodRows[0].faculty_id : null;

    // Check existing faculty in department
    const [deptFaculty] = await db.query(`
      SELECT id, user_id, faculty_code, name, email, is_hod, can_mentor 
      FROM faculty 
      WHERE department_id = ? 
      ORDER BY id ASC
    `, [dept.id]);

    // If no active HOD exists:
    if (!activeHodFacultyId) {
      if (deptFaculty.length > 0) {
        // Promote the first faculty member to HOD
        const facToPromote = deptFaculty[0];
        await db.query(`
          UPDATE faculty 
          SET is_hod = 1, designation = IF(designation LIKE '%Head%', designation, CONCAT('Professor & Head, ', ?))
          WHERE id = ?
        `, [dept.name, facToPromote.id]);

        if (facToPromote.user_id) {
          await db.query(`
            UPDATE users SET faculty_role = 'HOD' WHERE id = ?
          `, [facToPromote.user_id]);
        }

        await db.query(`
          INSERT INTO department_hod_assignments (department_id, faculty_id, start_date, status)
          VALUES (?, ?, CURDATE(), 'active')
        `, [dept.id, facToPromote.id]);

        activeHodFacultyId = facToPromote.id;
        hodsCreated++;
        console.log(`[HOD Assigned] Promoted existing faculty '${facToPromote.name}' as HOD for ${dept.code} (ID: ${dept.id})`);
      } else {
        // Provision a new HOD faculty member and user
        const hodName = names[0];
        const hodEmail = `hod.${code.toLowerCase()}@ats.edu`;
        const hodCode = `HOD-${code}`;

        // Check or create user
        let [userRows] = await db.query('SELECT id FROM users WHERE email = ?', [hodEmail]);
        let userId;
        if (userRows.length === 0) {
          const [userRes] = await db.query(`
            INSERT INTO users (name, email, password, role, faculty_role, department_id, is_active)
            VALUES (?, ?, ?, 'faculty', 'HOD', ?, 1)
          `, [hodName, hodEmail, defaultPasswordHash, dept.id]);
          userId = userRes.insertId;
        } else {
          userId = userRows[0].id;
        }

        // Check or create faculty
        let [facRows] = await db.query('SELECT id FROM faculty WHERE email = ? OR faculty_code = ?', [hodEmail, hodCode]);
        let facId;
        if (facRows.length === 0) {
          const [facRes] = await db.query(`
            INSERT INTO faculty (user_id, faculty_code, name, email, department_id, designation, is_hod, can_mentor)
            VALUES (?, ?, ?, ?, ?, 'Professor & Head of Department', 1, 1)
          `, [userId, hodCode, hodName, hodEmail, dept.id]);
          facId = facRes.insertId;
          facultyCreated++;
        } else {
          facId = facRows[0].id;
          await db.query('UPDATE faculty SET is_hod = 1, department_id = ? WHERE id = ?', [dept.id, facId]);
        }

        // Assign as active HOD
        await db.query(`
          INSERT INTO department_hod_assignments (department_id, faculty_id, start_date, status)
          VALUES (?, ?, CURDATE(), 'active')
          ON DUPLICATE KEY UPDATE faculty_id = VALUES(faculty_id), status = 'active'
        `, [dept.id, facId]);

        activeHodFacultyId = facId;
        hodsCreated++;
        console.log(`[HOD Created] Created and assigned active HOD '${hodName}' (${hodCode}) for ${dept.code}`);
      }
    }

    // Ensure department has at least 2 faculty members (1 HOD + 1 additional mentor faculty)
    const [updatedDeptFaculty] = await db.query(`
      SELECT id, can_mentor FROM faculty WHERE department_id = ?
    `, [dept.id]);

    if (updatedDeptFaculty.length < 2) {
      const facName = names[1] || `Prof. ${code} Staff`;
      const facEmail = `faculty.${code.toLowerCase()}@ats.edu`;
      const facCode = `FAC-${code}-02`;

      let [uRows] = await db.query('SELECT id FROM users WHERE email = ?', [facEmail]);
      let uId;
      if (uRows.length === 0) {
        const [uRes] = await db.query(`
          INSERT INTO users (name, email, password, role, faculty_role, department_id, is_active)
          VALUES (?, ?, ?, 'faculty', 'Faculty', ?, 1)
        `, [facName, facEmail, defaultPasswordHash, dept.id]);
        uId = uRes.insertId;
      } else {
        uId = uRows[0].id;
      }

      let [fRows] = await db.query('SELECT id FROM faculty WHERE email = ? OR faculty_code = ?', [facEmail, facCode]);
      if (fRows.length === 0) {
        await db.query(`
          INSERT INTO faculty (user_id, faculty_code, name, email, department_id, designation, is_hod, can_mentor)
          VALUES (?, ?, ?, ?, ?, 'Associate Professor', 0, 1)
        `, [uId, facCode, facName, facEmail, dept.id]);
        facultyCreated++;
        console.log(`[Staff Created] Created mentor faculty '${facName}' (${facCode}) for ${dept.code}`);
      }
    }

    // Distribute unmentored students evenly among department mentors
    const [deptMentors] = await db.query(`
      SELECT id FROM faculty WHERE department_id = ? AND can_mentor = 1 ORDER BY id ASC
    `, [dept.id]);

    if (deptMentors.length > 0) {
      const [unmentoredStudents] = await db.query(`
        SELECT s.id, s.name, s.register_number
        FROM students s
        LEFT JOIN student_mentors sm ON sm.student_id = s.id AND sm.status = 'active'
        WHERE s.department_id = ? AND sm.id IS NULL
        ORDER BY s.id ASC
      `, [dept.id]);

      if (unmentoredStudents.length > 0) {
        console.log(`[Mentor Balancing] Found ${unmentoredStudents.length} unmentored students in ${dept.code}. Assigning...`);
        for (let i = 0; i < unmentoredStudents.length; i++) {
          const mentor = deptMentors[i % deptMentors.length];
          const student = unmentoredStudents[i];
          await db.query(`
            INSERT INTO student_mentors (student_id, faculty_id, status)
            VALUES (?, ?, 'active')
            ON DUPLICATE KEY UPDATE faculty_id = VALUES(faculty_id), status = 'active'
          `, [student.id, mentor.id]);
          mentorsAssigned++;
        }
      }
    }
  }

  console.log(`\nMigration Operations Complete: New HODs Linked=${hodsCreated}, New Faculty Added=${facultyCreated}, Mentors Assigned=${mentorsAssigned}`);

  console.log('\n--- Step 2: Final Department Snapshot (After Migration) ---');
  const afterSnapshot = await getDepartmentBreakdown();
  console.table(afterSnapshot);

  const afterTotalStudents = afterSnapshot.reduce((a, b) => a + b.Students, 0);
  const afterTotalFaculty = afterSnapshot.reduce((a, b) => a + b.Faculty, 0);
  const afterHODCount = afterSnapshot.filter(b => b.HOD !== 'NONE').length;
  const afterUnmentored = afterSnapshot.reduce((a, b) => a + b.Unmentored, 0);

  console.log(`Summary After: Departments=${afterSnapshot.length}, Students=${afterTotalStudents}, Faculty=${afterTotalFaculty}, Active HODs=${afterHODCount}/25, Unmentored Students=${afterUnmentored}`);

  if (afterHODCount === 25 && afterUnmentored === 0) {
    console.log('\n✅ SUCCESS: All 25 departments have active HODs and 100% of students have assigned mentors!');
  } else {
    console.warn(`\n⚠️ Warning: HODs=${afterHODCount}/25, Unmentored=${afterUnmentored}`);
  }

  return { beforeSnapshot, afterSnapshot };
}

if (require.main === module) {
  organizeDepartments()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { organizeDepartments, getDepartmentBreakdown };
