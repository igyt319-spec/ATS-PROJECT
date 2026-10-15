const fs = require('fs');
const path = require('path');
const dbDatabase = require('../database/db');
const dbConfig = require('../backend/config/db');

async function runPhase5DbConfigTests() {
  console.log('===============================================================');
  console.log('=== PHASE 5 REGRESSION TEST SUITE: DB CONFIG & MIGRATION SAFETY');
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
  // Test Group 1: Unified Connection Pool & Interface
  // -------------------------------------------------------------
  console.log('--- Test Group 1: Unified Connection Pool & Interface ---');

  assert('1.1 database/db exports query function', typeof dbDatabase.query === 'function');
  assert('1.2 backend/config/db exports query function', typeof dbConfig.query === 'function');
  assert('1.3 backend/config/db getPool() returns unified pool reference', Boolean(dbConfig.getPool()));
  assert('1.4 database/db and backend/config/db pool interfaces are compatible', 
    dbConfig.getPool().query === dbDatabase.query || typeof dbConfig.getPool().query === 'function');

  // -------------------------------------------------------------
  // Test Group 2: SSL Configuration & Removal of Hardcoded Paths
  // -------------------------------------------------------------
  console.log('\n--- Test Group 2: SSL Configuration & Elimination of Hardcoded Paths ---');

  const getSslConfig = dbDatabase.getSslConfig;
  assert('2.1 getSslConfig function is exported from database/db', typeof getSslConfig === 'function');

  // Save original env
  const origDbSsl = process.env.DB_SSL;
  const origCa = process.env.DB_SSL_CA;
  const origB64 = process.env.DB_SSL_CA_BASE64;

  delete process.env.DB_SSL;
  delete process.env.DB_SSL_CA;
  delete process.env.DB_SSL_CA_BASE64;

  // Localhost without DB_SSL or CA
  const sslLocal = getSslConfig('localhost');
  assert('2.2 Localhost returns undefined SSL config (no TLS required for local)', sslLocal === undefined);

  // Aiven cloud host without CA file returns rejectUnauthorized: false
  const sslAiven = getSslConfig('mysql-service-project.aivencloud.com');
  assert('2.3 Aiven cloud host returns rejectUnauthorized: false by default when no CA is configured', 
    sslAiven && sslAiven.rejectUnauthorized === false);

  // Inline PEM CA
  process.env.DB_SSL_CA = '-----BEGIN CERTIFICATE-----\nMIIB...test\n-----END CERTIFICATE-----';
  const sslInline = getSslConfig('remote-db.example.com');
  assert('2.4 Inline PEM CA string is parsed directly into ca field', 
    sslInline && sslInline.ca && sslInline.ca.includes('BEGIN CERTIFICATE'));

  // Base64 CA
  delete process.env.DB_SSL_CA;
  const samplePem = '-----BEGIN CERTIFICATE-----\nSAMPLE_B64_CERT\n-----END CERTIFICATE-----';
  process.env.DB_SSL_CA_BASE64 = Buffer.from(samplePem).toString('base64');
  const sslB64 = getSslConfig('remote-db.example.com');
  assert('2.5 Base64 encoded CA string is decoded into ca field',
    sslB64 && sslB64.ca && sslB64.ca.includes('SAMPLE_B64_CERT'));

  // Restore env
  if (origDbSsl !== undefined) process.env.DB_SSL = origDbSsl;
  if (origCa !== undefined) process.env.DB_SSL_CA = origCa; else delete process.env.DB_SSL_CA;
  if (origB64 !== undefined) process.env.DB_SSL_CA_BASE64 = origB64; else delete process.env.DB_SSL_CA_BASE64;

  // Verify no hardcoded Windows paths in db.js or config/db.js
  const dbJsContent = fs.readFileSync(path.join(__dirname, '../database/db.js'), 'utf8');
  const configDbContent = fs.readFileSync(path.join(__dirname, '../backend/config/db.js'), 'utf8');

  assert('2.6 database/db.js contains no hardcoded personal or OneDrive file paths',
    !dbJsContent.includes('OneDrive') && !dbJsContent.includes('Iniyan'));
  assert('2.7 backend/config/db.js contains no hardcoded personal or OneDrive file paths',
    !configDbContent.includes('OneDrive') && !configDbContent.includes('Iniyan'));

  // -------------------------------------------------------------
  // Test Group 3: Structured DDL Error Handling (safeExecuteDDL)
  // -------------------------------------------------------------
  console.log('\n--- Test Group 3: Structured DDL Error Handling ---');

  const safeExecuteDDL = dbConfig.safeExecuteDDL;
  assert('3.1 safeExecuteDDL is exported from backend/config/db', typeof safeExecuteDDL === 'function');

  // Harmless error simulation: ER_TABLE_EXISTS_ERROR
  const mockConnTableExists = {
    async query() {
      const err = new Error("Table 'test_tbl' already exists");
      err.code = 'ER_TABLE_EXISTS_ERROR';
      throw err;
    }
  };
  let handledResult1 = null;
  let didThrow1 = false;
  try {
    handledResult1 = await safeExecuteDDL(mockConnTableExists, 'CREATE TABLE test_tbl (...)', 'Test Table');
  } catch (e) {
    didThrow1 = true;
  }
  assert('3.2 ER_TABLE_EXISTS_ERROR (1050) is handled gracefully without throwing', !didThrow1 && handledResult1 === null);

  // Harmless error simulation: ER_DUP_KEYNAME
  const mockConnDupKey = {
    async query() {
      const err = new Error("Duplicate key name 'idx_test'");
      err.code = 'ER_DUP_KEYNAME';
      throw err;
    }
  };
  let handledResult2 = null;
  let didThrow2 = false;
  try {
    handledResult2 = await safeExecuteDDL(mockConnDupKey, 'CREATE INDEX idx_test (...)', 'Test Index');
  } catch (e) {
    didThrow2 = true;
  }
  assert('3.3 ER_DUP_KEYNAME (1061) is handled gracefully without throwing', !didThrow2 && handledResult2 === null);

  // Critical error simulation: ER_SYNTAX_ERROR must throw
  const mockConnSyntax = {
    async query() {
      const err = new Error("You have an error in your SQL syntax near 'INVALID SQL'");
      err.code = 'ER_SYNTAX_ERROR';
      throw err;
    }
  };
  let didThrowSyntax = false;
  try {
    await safeExecuteDDL(mockConnSyntax, 'INVALID SYNTAX STATEMENT', 'Syntax Test');
  } catch (e) {
    didThrowSyntax = true;
  }
  assert('3.4 Critical syntax errors (ER_SYNTAX_ERROR) are NOT swallowed and properly thrown', didThrowSyntax);

  // Critical error simulation: ER_ACCESS_DENIED_ERROR must throw
  const mockConnAccess = {
    async query() {
      const err = new Error("Access denied for user 'test'@'%'");
      err.code = 'ER_ACCESS_DENIED_ERROR';
      throw err;
    }
  };
  let didThrowAccess = false;
  try {
    await safeExecuteDDL(mockConnAccess, 'SELECT 1', 'Access Test');
  } catch (e) {
    didThrowAccess = true;
  }
  assert('3.5 Critical access errors (ER_ACCESS_DENIED_ERROR) are NOT swallowed and properly thrown', didThrowAccess);

  // -------------------------------------------------------------
  // Test Group 4: Package Dependency Version Alignment
  // -------------------------------------------------------------
  console.log('\n--- Test Group 4: Package Dependency Alignment ---');

  const rootPkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
  const backendPkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../backend/package.json'), 'utf8'));

  assert('4.1 Root package.json specifies mysql2 as ^3.12.0', rootPkg.dependencies && rootPkg.dependencies.mysql2 === '^3.12.0');
  assert('4.2 backend/package.json specifies mysql2 as ^3.12.0', backendPkg.dependencies && backendPkg.dependencies.mysql2 === '^3.12.0');
  assert('4.3 mysql2 dependency versions are identical across both package manifests',
    rootPkg.dependencies.mysql2 === backendPkg.dependencies.mysql2);

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`=== PHASE 5 DB CONFIG RESULTS: ${passedCount} PASSED, ${failedCount} FAILED ===`);
  console.log('===============================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase5DbConfigTests();
