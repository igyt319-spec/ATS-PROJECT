const fs = require('fs');
const path = require('path');
const db = require('../database/db');
const { uploadAvatar } = require('../backend/controllers/uploadController');

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

async function runPhase5Tests() {
  console.log('===============================================================');
  console.log('=== PHASE 5 REGRESSION TEST SUITE: AVATAR UPLOAD & IMAGE STORAGE');
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

  // Intercept db.query to prevent local network timeout while verifying SQL invocations
  const originalQuery = db.query;
  const queriesExecuted = [];
  db.query = async function(...args) {
    queriesExecuted.push(args[0]);
    return [{ affectedRows: 1 }];
  };

  // -------------------------------------------------------------
  // Test 1: Payload & MIME Type Validation
  // -------------------------------------------------------------
  console.log('--- Test Group 1: Payload & MIME Type Validation ---');

  // 1.1 Empty body
  let reqEmpty = { user: { id: 1, role: 'student' }, body: {} };
  let resEmpty = createMockRes();
  await uploadAvatar(reqEmpty, resEmpty);
  assert('1.1 Empty image payload returns HTTP 400', resEmpty.statusCode === 400);

  // 1.2 Invalid MIME format (e.g., gif or executable)
  let reqBadMime = {
    user: { id: 1, role: 'student' },
    body: { imageData: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' }
  };
  let resBadMime = createMockRes();
  await uploadAvatar(reqBadMime, resBadMime);
  assert('1.2 Disallowed MIME type (image/gif) returns HTTP 400', resBadMime.statusCode === 400);

  // 1.3 Oversized image (>2MB)
  const largeBuffer = Buffer.alloc(2.5 * 1024 * 1024); // 2.5MB
  const largeBase64 = `data:image/jpeg;base64,${largeBuffer.toString('base64')}`;
  let reqLarge = {
    user: { id: 1, role: 'student' },
    body: { imageData: largeBase64 }
  };
  let resLarge = createMockRes();
  await uploadAvatar(reqLarge, resLarge);
  assert('1.3 Payload exceeding 2MB limit returns HTTP 400', resLarge.statusCode === 400);

  // -------------------------------------------------------------
  // Test 2: Public Image URL Handling
  // -------------------------------------------------------------
  console.log('\n--- Test Group 2: Public Image URL Handling ---');

  // 2.1 Invalid URL scheme
  let reqBadUrl = {
    user: { id: 1, role: 'student' },
    body: { imageData: 'javascript:alert(1)' }
  };
  let resBadUrl = createMockRes();
  await uploadAvatar(reqBadUrl, resBadUrl);
  assert('2.1 Malicious or non-http/https URL is rejected (HTTP 400)', resBadUrl.statusCode === 400);

  // 2.2 Valid HTTP/HTTPS URL
  let reqGoodUrl = {
    user: { id: 1, role: 'student' },
    body: { imageData: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400' }
  };
  let resGoodUrl = createMockRes();
  await uploadAvatar(reqGoodUrl, resGoodUrl);
  assert('2.2 Valid HTTPS image URL returns HTTP 200', resGoodUrl.statusCode === 200);
  assert('2.3 Stored avatarUrl is identical clean external URL', resGoodUrl.body.avatarUrl === 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400');
  assert('2.4 Clean external URL does NOT have data:image/jpeg;base64 prepended', !resGoodUrl.body.avatarUrl.startsWith('data:image'));

  // -------------------------------------------------------------
  // Test 3: Base64 Decoupling from Database
  // -------------------------------------------------------------
  console.log('\n--- Test Group 3: Elimination of Raw Base64 in Database ---');

  // 3.1 Valid small PNG upload
  const smallPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  let reqValidPng = {
    user: { id: 7, role: 'student' },
    body: { imageData: smallPngBase64 }
  };
  let resValidPng = createMockRes();
  await uploadAvatar(reqValidPng, resValidPng);
  assert('3.1 Valid base64 PNG upload returns HTTP 200', resValidPng.statusCode === 200);
  assert('3.2 Returned avatarUrl is relative storage path (/uploads/avatars/...)', resValidPng.body.avatarUrl && resValidPng.body.avatarUrl.startsWith('/uploads/avatars/'));
  assert('3.3 Database does NOT store raw Base64 data URI', !resValidPng.body.avatarUrl.startsWith('data:image'));

  // Verify file was actually written to uploads/avatars/
  const uploadedFilename = path.basename(resValidPng.body.avatarUrl);
  const writtenFilePath = path.join(__dirname, '../uploads/avatars', uploadedFilename);
  assert('3.4 Decoded image file exists on local filesystem', fs.existsSync(writtenFilePath));
  // Clean up created test file
  if (fs.existsSync(writtenFilePath)) fs.unlinkSync(writtenFilePath);

  // -------------------------------------------------------------
  // Test 4: Database Migration File Verification
  // -------------------------------------------------------------
  console.log('\n--- Test Group 4: Migration SQL Verification ---');

  const migrationPath = path.join(__dirname, '../database/migrations/expand_avatar_column.sql');
  assert('4.1 Migration file expand_avatar_column.sql exists', fs.existsSync(migrationPath));

  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  assert('4.2 Migration alters users.avatar to TEXT', migrationSql.includes('ALTER TABLE users MODIFY COLUMN avatar TEXT'));
  assert('4.3 Migration alters students.avatar to TEXT', migrationSql.includes('ALTER TABLE students MODIFY COLUMN avatar TEXT'));
  assert('4.4 Migration alters faculty.avatar to TEXT', migrationSql.includes('ALTER TABLE faculty MODIFY COLUMN avatar TEXT'));

  // Restore query
  db.query = originalQuery;

  console.log('\n===============================================================');
  console.log(`Phase 5 Test Execution Complete: ${passedCount} PASSED, ${failedCount} FAILED.`);
  console.log('===============================================================');

  if (failedCount > 0) process.exit(1);
}

runPhase5Tests().catch(err => {
  console.error('Fatal Phase 5 Test Error:', err);
  process.exit(1);
});
