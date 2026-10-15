const dns = require('dns');
try {
  dns.setDefaultResultOrder('ipv4first');
  const origLookup = dns.lookup;
  dns.lookup = function(hostname, options, callback) {
    if (typeof options === 'function') { callback = options; options = {}; }
    const opts = Object.assign({}, typeof options === 'object' ? options : { hints: options }, { family: 4 });
    return origLookup.call(this, hostname, opts, callback);
  };
} catch (e) {}
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const sharedPool = require('../../database/db');

let pool = null;
let isConnected = false;
let dbMode = 'uninitialized';
let dbStatusMessage = '';

/**
 * Robustly split SQL script by semicolon while ignoring comments and strings.
 */
function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let inLineComment = false;
  let inBlockComment = false;
  let i = 0;

  while (i < sql.length) {
    const char = sql[i];
    const nextChar = sql[i + 1] || '';

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      i++;
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (inString) {
      current += char;
      if (char === stringChar) {
        if (nextChar === stringChar) {
          current += nextChar;
          i += 2;
          continue;
        } else if (sql[i - 1] !== '\\') {
          inString = false;
        }
      }
      i++;
      continue;
    }

    if (char === '-' && nextChar === '-') {
      inLineComment = true;
      i += 2;
      continue;
    }
    if (char === '/' && nextChar === '*') {
      inBlockComment = true;
      i += 2;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      inString = true;
      stringChar = char;
      current += char;
      i++;
      continue;
    }
    if (char === ';') {
      const stmt = current.trim();
      if (stmt && !/^USE\s/i.test(stmt) && !/^CREATE\s+DATABASE\s/i.test(stmt)) {
        statements.push(stmt);
      }
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  const stmt = current.trim();
  if (stmt && !/^USE\s/i.test(stmt) && !/^CREATE\s+DATABASE\s/i.test(stmt)) {
    statements.push(stmt);
  }

  return statements;
}

const HARMLESS_DDL_ERROR_CODES = new Set([
  'ER_TABLE_EXISTS_ERROR',      // 1050
  'ER_DUP_KEYNAME',             // 1061
  'ER_DUP_FIELDNAME',           // 1060
  'ER_CANT_DROP_FIELD_OR_KEY',  // 1091
  'ER_DB_CREATE_EXISTS'         // 1007
]);

async function safeExecuteDDL(conn, sql, label = '') {
  try {
    return await conn.query(sql);
  } catch (err) {
    if (HARMLESS_DDL_ERROR_CODES.has(err.code)) {
      console.log(`[DB Migration Notice] ${label || 'DDL'} already applied (${err.code}).`);
      return null;
    }
    console.warn(`[DB Migration Warning] ${label || 'DDL'} (${err.code || 'UNKNOWN'}): ${err.message}`);
    if (err.code === 'ER_SYNTAX_ERROR' || err.code === 'ER_PARSE_ERROR' || err.code === 'ER_ACCESS_DENIED_ERROR') {
      throw err;
    }
    return null;
  }
}

function getSslConfig() {
  if (sharedPool && typeof sharedPool.getSslConfig === 'function') {
    return sharedPool.getSslConfig();
  }
  const host = (process.env.DB_HOST || '').replace(/^"|"$/g, '').trim();
  if (host === 'localhost' || host === '127.0.0.1' || host === '') return undefined;
  return { rejectUnauthorized: false };
}

async function initDB() {
  const host = (process.env.DB_HOST || 'localhost').replace(/^"|"$/g, '');
  const user = (process.env.DB_USER || 'root').replace(/^"|"$/g, '');
  const password = (process.env.DB_PASSWORD || '').replace(/^"|"$/g, '');
  const port = parseInt(process.env.DB_PORT, 10) || 3306;
  const database = (process.env.DB_NAME || 'ats_database').replace(/^"|"$/g, '');
  const ssl = getSslConfig();

  console.log(`[DB] Connecting to MySQL at ${host}:${port}/${database}...`);

  try {
    // Initial connection to check database and seed if required
    const initialConfig = {
      host,
      user,
      password,
      port,
      database,
      multipleStatements: true,
      connectTimeout: 15000
    };
    if (ssl) initialConfig.ssl = ssl;

    const connection = await mysql.createConnection(initialConfig);
    console.log(`[DB] Connected to MySQL server at ${host}:${port}`);

    // Ensure database exists
    await safeExecuteDDL(connection, `CREATE DATABASE IF NOT EXISTS \`${database}\``, 'Create DB');
    await connection.query(`USE \`${database}\``);

    const runSqlFile = async (file) => {
      const filePath = path.join(__dirname, '../../database', file);
      if (!fs.existsSync(filePath)) throw new Error(`Required SQL file missing: ${file}`);
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      const statements = splitSqlStatements(sqlContent);
      console.log(`[DB] Executing ${statements.length} statements from ${file}...`);
      
      const chunkSize = 50;
      for (let i = 0; i < statements.length; i += chunkSize) {
        const chunk = statements.slice(i, i + chunkSize);
        await connection.query(chunk.join(';\n') + ';');
      }
    };

    // Check if tables exist
    const [tables] = await connection.query('SHOW TABLES');
    if (tables.length === 0) {
      console.log('[DB] No tables found in database. Initializing original schema and seed data...');
      await runSqlFile('schema.sql');
      await runSqlFile('college_data.sql');
      await runSqlFile('seed_data.sql');
    }

    // Ensure grade_point columns support 10.00 (DECIMAL(4,2))
    await safeExecuteDDL(connection, 'ALTER TABLE marks MODIFY grade_point DECIMAL(4,2) NOT NULL DEFAULT 0', 'Alter marks.grade_point');
    await safeExecuteDDL(connection, 'ALTER TABLE grading_rules MODIFY grade_point DECIMAL(4,2) NOT NULL', 'Alter grading_rules.grade_point');

    // Ensure 100 original students are present
    let studentCheckCount = 0;
    try {
      const [[studentCheck]] = await connection.query("SELECT COUNT(*) AS count FROM students WHERE register_number LIKE 'BITD%'");
      studentCheckCount = Number(studentCheck.count || 0);
    } catch (countErr) {
      console.warn('[DB] Student check query notice:', countErr.message);
    }

    if (studentCheckCount === 0) {
      console.log('[DB] Seeding original student records from seed_data.sql...');
      await runSqlFile('seed_data.sql');
    }

    // Ensure department_hod_assignments exists with database-enforced single active HOD constraint
    await safeExecuteDDL(connection, `
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
    `, 'Create department_hod_assignments table');

    // Ensure avatar columns support relative upload paths and long URLs
    await safeExecuteDDL(connection, 'ALTER TABLE users MODIFY COLUMN avatar TEXT', 'Alter users.avatar');
    await safeExecuteDDL(connection, 'ALTER TABLE students MODIFY COLUMN avatar TEXT', 'Alter students.avatar');
    await safeExecuteDDL(connection, 'ALTER TABLE faculty MODIFY COLUMN avatar TEXT', 'Alter faculty.avatar');

    // Ensure student_fees exists for payment simulation
    await safeExecuteDDL(connection, `
      CREATE TABLE IF NOT EXISTS student_fees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        fee_category VARCHAR(100) NOT NULL,
        academic_year VARCHAR(20) NOT NULL,
        semester VARCHAR(24) NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        balance_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        status ENUM('Pending', 'Partially Paid', 'Paid', 'Overdue') NOT NULL DEFAULT 'Pending',
        due_date DATE NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_fees_student (student_id)
      )
    `, 'Create student_fees table');

    // Ensure fee_payments exists for payment simulation
    await safeExecuteDDL(connection, `
      CREATE TABLE IF NOT EXISTS fee_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fee_id INT NOT NULL,
        student_id INT NOT NULL,
        transaction_ref VARCHAR(100) NOT NULL UNIQUE,
        payment_method VARCHAR(50) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status ENUM('Success', 'Failed', 'Pending', 'Cancelled') NOT NULL DEFAULT 'Success',
        is_demo TINYINT(1) NOT NULL DEFAULT 1,
        payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_payments_fee (fee_id),
        KEY idx_payments_student (student_id)
      )
    `, 'Create fee_payments table');

    // Safe, non-destructive demo accounts check
    // Disabled in production and ambiguous environments by default unless ALLOW_DEMO_SEED=true
    const currentEnv = (process.env.NODE_ENV || '').toLowerCase().trim();
    const isSafeDemoEnv = currentEnv === 'development' || currentEnv === 'demo' || currentEnv === 'test';
    const allowDemoSeed = process.env.ALLOW_DEMO_SEED === 'true';

    if (isSafeDemoEnv || allowDemoSeed) {
      try {
        const requiredDemoEmails = [
          'kavitha.demo@ats.edu',
          'senthil.demo@ats.edu',
          'anand.demo@ats.edu'
        ];
        const [existingDemoUsers] = await connection.query(
          "SELECT email FROM users WHERE email IN (?)",
          [requiredDemoEmails]
        ).catch(() => [[]]);

        const existingEmails = new Set((existingDemoUsers || []).map(u => u.email));
        const missingEmails = requiredDemoEmails.filter(email => !existingEmails.has(email));

        if (missingEmails.length > 0) {
          console.log(`[DB] Incomplete demo accounts detected (missing: ${missingEmails.join(', ')}). Running safe idempotent seeder...`);
          const seedDemoAccounts = require('../../database/seed_demo_accounts');
          await seedDemoAccounts(connection);
        } else {
          console.log('[DB] Verified all required demo accounts (Student, Faculty, HOD) are present in database.');
        }
      } catch (seedErr) {
        console.warn('[DB] Demo accounts check notice:', seedErr.message);
      }
    } else {
      console.log(`[DB] Environment '${currentEnv || 'undefined'}': demo seeding disabled by default (requires ALLOW_DEMO_SEED=true).`);
    }

    await connection.end();

    // Use unified connection pool from database/db to avoid connection leaks and multiple pools
    pool = sharedPool;

    // Test a quick query from the pool
    const [[countResult]] = await pool.query('SELECT COUNT(*) AS total FROM students');
    isConnected = true;
    dbMode = 'mysql';
    dbStatusMessage = `Connected to MySQL (${database} on ${host}:${port}) - ${countResult.total} original students loaded`;
    console.log(`[DB] MySQL Pool ready. Mode: ${dbMode} | Students: ${countResult.total}`);
    return;
  } catch (err) {
    isConnected = false;
    dbMode = 'error';
    dbStatusMessage = `MySQL connection failed: ${err.message}`;
    console.error(`[DB Error] ${dbStatusMessage}`);
    throw err;
  }
}

/**
 * Unified query executor querying live MySQL pool.
 */
async function query(sql, params = []) {
  const activePool = pool || sharedPool;
  if (activePool) {
    try {
      return await activePool.query(sql, params);
    } catch (err) {
      if (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ETIMEDOUT') {
        console.warn(`[DB Notice] Retrying query on transient network error (${err.code})...`);
        await new Promise(r => setTimeout(r, 250));
        return await activePool.query(sql, params);
      }
      console.error('[DB Query Error]', err.message, 'SQL:', (typeof sql === 'string' ? sql.slice(0, 100) : ''));
      throw err;
    }
  }

  throw new Error(`Database is not connected. Status: ${dbStatusMessage}`);
}

function getDbStatus() {
  return {
    isConnected,
    isMySQL: dbMode === 'mysql',
    mode: dbMode,
    message: dbStatusMessage
  };
}

module.exports = {
  initDB,
  query,
  getDbStatus,
  getPool: () => pool || sharedPool,
  safeExecuteDDL,
  HARMLESS_DDL_ERROR_CODES
};
