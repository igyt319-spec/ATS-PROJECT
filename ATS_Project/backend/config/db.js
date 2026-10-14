const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

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

function getSslConfig() {
  const caPath = process.env.DB_SSL_CA || 'C:\\Users\\Iniyan\\OneDrive\\Documents\\ca (1).pem';
  if (fs.existsSync(caPath)) {
    try {
      return { ca: fs.readFileSync(caPath) };
    } catch (e) {
      console.warn('[DB] Could not read CA file, falling back to rejectUnauthorized: false:', e.message);
    }
  }
  // If host is a remote cloud host (like aivencloud.com), enable SSL by default
  const host = (process.env.DB_HOST || '').replace(/^"|"$/g, '');
  if (host.includes('aivencloud.com') || process.env.DB_SSL === 'true') {
    return { rejectUnauthorized: false };
  }
  return undefined;
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
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``).catch(() => {});
    await connection.query(`USE \`${database}\``).catch(() => {});

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
    await connection.query('ALTER TABLE marks MODIFY grade_point DECIMAL(4,2) NOT NULL DEFAULT 0').catch(() => {});
    await connection.query('ALTER TABLE grading_rules MODIFY grade_point DECIMAL(4,2) NOT NULL').catch(() => {});

    // Ensure 100 original students are present
    const [[studentCheck]] = await connection.query("SELECT COUNT(*) AS count FROM students WHERE register_number LIKE 'BITD%'").catch(() => [[{ count: 0 }]]);
    if (Number(studentCheck.count) === 0) {
      console.log('[DB] Seeding original student records from seed_data.sql...');
      await runSqlFile('seed_data.sql');
    }

    await connection.end();

    // Create pool for runtime operations
    const poolConfig = {
      host,
      user,
      password,
      database,
      port,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 15000
    };
    if (ssl) poolConfig.ssl = ssl;

    pool = mysql.createPool(poolConfig);

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
  if (pool && isConnected) {
    try {
      return await pool.query(sql, params);
    } catch (err) {
      console.error('[DB Query Error]', err.message, 'SQL:', sql.slice(0, 100));
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
  getPool: () => pool
};
