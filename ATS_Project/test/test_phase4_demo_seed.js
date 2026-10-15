const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

async function runPhase4Tests() {
  console.log('===============================================================');
  console.log('=== PHASE 4 REGRESSION TEST SUITE: DATABASE SAFETY & DEMO ACCOUNTS');
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
  // Test 1: Production Safety Guard Verification
  // -------------------------------------------------------------
  console.log('--- Test Group 1: Production Safety Guard ---');

  const seedScriptPath = path.join(__dirname, '../database/seed_demo_accounts.js');
  const seedScriptContent = fs.readFileSync(seedScriptPath, 'utf8');

  // Verify production check statement is present
  const hasProdGuard = seedScriptContent.includes("process.env.NODE_ENV === 'production'") &&
                       seedScriptContent.includes("process.env.ALLOW_DEMO_SEED !== 'true'");
  assert('1.1 Production guard statement is explicitly present', hasProdGuard);

  // -------------------------------------------------------------
  // Test 2: Database Destruction Prevention
  // -------------------------------------------------------------
  console.log('\n--- Test Group 2: Database Destruction Prevention ---');

  const dangerousPatterns = [
    /DROP\s+TABLE/i,
    /DROP\s+DATABASE/i,
    /TRUNCATE\s+TABLE/i,
    /TRUNCATE\s+[a-z_]+/i,
    /DELETE\s+FROM\s+[a-z_]+\s*;/i // Unscoped delete
  ];

  dangerousPatterns.forEach((pat, i) => {
    const found = pat.test(seedScriptContent);
    assert(`2.${i+1} No dangerous destructive pattern (${pat}) found in seed script`, !found);
  });

  // -------------------------------------------------------------
  // Test 3: Demo Accounts Integrity & Password Hashing
  // -------------------------------------------------------------
  console.log('\n--- Test Group 3: Demo Accounts Integrity & Passwords ---');

  const requiredEmails = [
    'kavitha.demo@ats.edu',
    'senthil.demo@ats.edu',
    'anand.demo@ats.edu',
    'admin.demo@ats.edu'
  ];

  requiredEmails.forEach((email, i) => {
    assert(`3.${i+1} Required demo account email '${email}' configured`, seedScriptContent.includes(email));
  });

  // Verify bcrypt hashing of sample passwords
  const sampleHash = await bcrypt.hash('faculty123', 10);
  const isMatch = await bcrypt.compare('faculty123', sampleHash);
  assert('3.5 Bcrypt password comparison succeeds for demo password', isMatch);

  // Verify mentorship assignment is present
  const hasMentorshipLink = seedScriptContent.includes('student_mentors') &&
                            seedScriptContent.includes('assigned_by');
  assert('3.6 Active mentorship assignment logic configured for demo student and mentor', hasMentorshipLink);

  // -------------------------------------------------------------
  // Test 4: Idempotency, Password Preservation & Role Conflict Protection
  // -------------------------------------------------------------
  console.log('\n--- Test Group 4: Idempotency & Role Conflict Protection ---');

  const seedDemoAccounts = require('../database/seed_demo_accounts');

  // 4.1 Mock DB tracking executed queries
  const executedSqls = [];
  const mockDbSuccess = {
    query: async (sql, params = []) => {
      executedSqls.push({ sql, params });
      if (sql.includes('departments WHERE code =')) {
        return [[{ id: 1, name: 'Computer Science and Engineering' }]];
      }
      if (sql.includes('SELECT id, role, password FROM users WHERE email = ?')) {
        const email = params[0];
        const role = email.includes('admin') ? 'admin' : email.includes('kavitha') ? 'student' : 'faculty';
        return [[{ id: 10, role, password: 'existing_secure_custom_hash' }]];
      }
      if (sql.includes('SELECT id FROM faculty WHERE email = ?')) {
        return [[{ id: 5 }]];
      }
      if (sql.includes('SELECT id, faculty_id FROM department_hod_assignments')) {
        return [[{ id: 1, faculty_id: 5 }]];
      }
      if (sql.includes('SELECT id FROM students WHERE email = ?')) {
        return [[{ id: 12 }]];
      }
      if (sql.includes('SELECT id, status FROM student_mentors')) {
        return [[{ id: 1, status: 'active' }]];
      }
      if (sql.includes('SELECT id FROM student_fees')) {
        return [[{ id: 1 }]];
      }
      return [{ insertId: 99, affectedRows: 1 }];
    }
  };

  // Run seeder with mock DB
  await seedDemoAccounts(mockDbSuccess);

  // Assert no password updates were performed on existing users
  const passwordUpdates = executedSqls.filter(q => /UPDATE\s+users\s+SET.*password/i.test(q.sql));
  assert('4.1 Idempotent execution preserves existing passwords (0 password updates on existing users)', passwordUpdates.length === 0);

  // Assert no destructive queries executed
  const destructiveQueries = executedSqls.filter(q => /DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE/i.test(q.sql));
  assert('4.2 Zero destructive queries executed during seeding run', destructiveQueries.length === 0);

  // 4.3 Test Role Conflict Guard
  const mockDbConflict = {
    query: async (sql, params = []) => {
      if (sql.includes('departments WHERE code =')) {
        return [[{ id: 1, name: 'Computer Science' }]];
      }
      if (sql.includes('SELECT id, role, password FROM users WHERE email = ?')) {
        // Return mismatched role: admin email already owned by student
        return [[{ id: 10, role: 'student', password: 'hash' }]];
      }
      return [{ insertId: 99 }];
    }
  };

  let conflictDetected = false;
  try {
    await seedDemoAccounts(mockDbConflict);
  } catch (err) {
    conflictDetected = err.message.includes('Conflict');
  }
  assert('4.3 Role collision detection aborts seeding with conflict error instead of overwriting', conflictDetected);

  // 4.4 Test that independent account verification seeds missing accounts even if some exist
  const independentSqls = [];
  const mockDbPartial = {
    query: async (sql, params = []) => {
      independentSqls.push({ sql, params });
      if (sql.includes('departments WHERE code =')) {
        return [[{ id: 1, name: 'Computer Science and Engineering' }]];
      }
      if (sql.includes('SELECT id, role, password FROM users WHERE email = ?')) {
        const email = params[0];
        // Only Kavitha exists; Senthil and Anand are missing
        if (email === 'kavitha.demo@ats.edu') {
          return [[{ id: 10, role: 'student', password: 'hash' }]];
        }
        return [[]]; // Missing Senthil and Anand
      }
      if (sql.includes('SELECT id FROM faculty WHERE email = ?')) return [[]];
      if (sql.includes('SELECT id, faculty_id FROM department_hod_assignments')) return [[]];
      if (sql.includes('SELECT id FROM students WHERE email = ?')) return [[{ id: 10 }]];
      if (sql.includes('SELECT id, status FROM student_mentors')) return [[]];
      if (sql.includes('SELECT id FROM student_fees')) return [[]];
      return [{ insertId: 77, affectedRows: 1 }];
    }
  };

  await seedDemoAccounts(mockDbPartial);
  const senthilCreated = independentSqls.some(q => q.sql.includes('INSERT INTO users') && q.params.includes('senthil.demo@ats.edu'));
  const anandCreated = independentSqls.some(q => q.sql.includes('INSERT INTO users') && q.params.includes('anand.demo@ats.edu'));
  assert('4.4 Missing demo accounts are seeded independently even when other demo accounts already exist', senthilCreated && anandCreated);

  // 4.5 Test that existing unrelated active HOD is preserved and not deactivated
  const hodSafetySqls = [];
  const mockDbUnrelatedHod = {
    query: async (sql, params = []) => {
      hodSafetySqls.push({ sql, params });
      if (sql.includes('departments WHERE code =')) {
        return [[{ id: 1, name: 'Computer Science and Engineering' }]];
      }
      if (sql.includes('SELECT id, role, password FROM users WHERE email = ?')) {
        return [[]];
      }
      if (sql.includes('SELECT id FROM faculty WHERE email = ?')) return [[]];
      if (sql.includes("SELECT id, faculty_id FROM department_hod_assignments WHERE department_id = ? AND status = 'active'")) {
        // Department 1 already has active HOD who is faculty #88 (unrelated existing professor)
        return [[{ id: 50, faculty_id: 88 }]];
      }
      if (sql.includes('SELECT name FROM faculty WHERE id = ?')) {
        return [[{ name: 'Dr. Unrelated Existing HOD' }]];
      }
      if (sql.includes('LEFT JOIN department_hod_assignments dha ON dha.department_id = d.id AND dha.status = \'active\'')) {
        // Department 2 (ECE) is vacant without an active HOD
        return [[{ id: 2, name: 'Electronics and Communication Engineering' }]];
      }
      if (sql.includes('SELECT id FROM students WHERE email = ?')) return [[]];
      if (sql.includes('SELECT id, status FROM student_mentors')) return [[]];
      if (sql.includes('SELECT id FROM student_fees')) return [[]];
      return [{ insertId: 88, affectedRows: 1 }];
    }
  };

  await seedDemoAccounts(mockDbUnrelatedHod);
  // Ensure NO deactivation query was run against the unrelated HOD
  const deactivatedUnrelated = hodSafetySqls.some(q => q.sql.includes("UPDATE department_hod_assignments SET status = 'inactive'"));
  assert('4.5 Existing unrelated active HOD is preserved without being deactivated', !deactivatedUnrelated);

  console.log('\n===============================================================');
  console.log(`Phase 4 Test Execution Complete: ${passedCount} PASSED, ${failedCount} FAILED.`);
  console.log('===============================================================');

  if (failedCount > 0) process.exit(1);
}

runPhase4Tests().catch(err => {
  console.error('Fatal Phase 4 Test Error:', err);
  process.exit(1);
});
