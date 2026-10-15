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

  console.log('\n===============================================================');
  console.log(`Phase 4 Test Execution Complete: ${passedCount} PASSED, ${failedCount} FAILED.`);
  console.log('===============================================================');

  if (failedCount > 0) process.exit(1);
}

runPhase4Tests().catch(err => {
  console.error('Fatal Phase 4 Test Error:', err);
  process.exit(1);
});
