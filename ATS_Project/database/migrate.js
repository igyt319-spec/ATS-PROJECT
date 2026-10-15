const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '../backend/.env')
});

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const next = sql[i + 1] || '';

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      current += char;

      if (char === stringChar) {
        if (next === stringChar) {
          current += next;
          i++;
        } else if (sql[i - 1] !== '\\') {
          inString = false;
        }
      }
      continue;
    }

    if (char === '-' && next === '-') {
      inLineComment = true;
      i++;
      continue;
    }

    if (char === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    if (char === "'" || char === '"' || char === '`') {
      inString = true;
      stringChar = char;
      current += char;
      continue;
    }

    if (char === ';') {
      const stmt = current.trim();

      if (
        stmt &&
        !/^USE\s/i.test(stmt) &&
        !/^CREATE\s+DATABASE\s/i.test(stmt)
      ) {
        statements.push(stmt);
      }

      current = '';
      continue;
    }

    current += char;
  }

  const stmt = current.trim();

  if (
    stmt &&
    !/^USE\s/i.test(stmt) &&
    !/^CREATE\s+DATABASE\s/i.test(stmt)
  ) {
    statements.push(stmt);
  }

  return statements;
}

async function migrate() {
  const clean = value =>
    (value || '').replace(/^"|"$/g, '').trim();

  const host = clean(process.env.DB_HOST);
  const user = clean(process.env.DB_USER);
  const password = clean(process.env.DB_PASSWORD);
  const port = Number(process.env.DB_PORT);
  const database = clean(process.env.DB_NAME);

  if (
    !host ||
    !user ||
    !password ||
    !Number.isInteger(port) ||
    port <= 0 ||
    !database
  ) {
    throw new Error(
      'Missing or invalid DB_HOST, DB_USER, DB_PASSWORD, DB_PORT or DB_NAME.'
    );
  }

  let ssl;

  if (host.includes('aivencloud.com')) {
    const caPath = clean(process.env.DB_SSL_CA);

    if (!caPath || !fs.existsSync(caPath)) {
      throw new Error(
        'DB_SSL_CA is missing or the SSL certificate file was not found.'
      );
    }

    ssl = {
      ca: fs.readFileSync(caPath),
      rejectUnauthorized: true
    };
  }

  console.log(`Connecting to MySQL at ${host}:${port}/${database}...`);

  const conn = await mysql.createConnection({
    host,
    user,
    password,
    port,
    database,
    multipleStatements: true,
    ...(ssl ? { ssl } : {}),
    connectTimeout: 15000
  });

  try {
    console.log('Connected to MySQL successfully!');

    const basePath = __dirname;

    console.log('Applying schema.sql...');
    const schemaStmts = splitSqlStatements(
      fs.readFileSync(path.join(basePath, 'schema.sql'), 'utf8')
    );

    for (const stmt of schemaStmts) {
      await conn.query(stmt);
    }

    const HARMLESS_DDL_CODES = new Set(['ER_TABLE_EXISTS_ERROR', 'ER_DUP_KEYNAME', 'ER_DUP_FIELDNAME', 'ER_CANT_DROP_FIELD_OR_KEY']);
    const safeDDL = async (stmt, label) => {
      try {
        await conn.query(stmt);
      } catch (err) {
        if (HARMLESS_DDL_CODES.has(err.code)) {
          console.log(`[Migration Notice] ${label} already applied (${err.code}).`);
        } else {
          console.warn(`[Migration Warning] ${label} (${err.code || 'UNKNOWN'}): ${err.message}`);
        }
      }
    };

    await safeDDL('ALTER TABLE marks MODIFY grade_point DECIMAL(4,2) NOT NULL DEFAULT 0', 'Alter marks.grade_point');
    await safeDDL('ALTER TABLE grading_rules MODIFY grade_point DECIMAL(4,2) NOT NULL', 'Alter grading_rules.grade_point');

    console.log(`schema.sql applied (${schemaStmts.length} statements).`);

    console.log('Applying college_data.sql...');
    const collegeStmts = splitSqlStatements(
      fs.readFileSync(path.join(basePath, 'college_data.sql'), 'utf8')
    );

    for (const stmt of collegeStmts) {
      await conn.query(stmt);
    }

    console.log(
      `college_data.sql applied (${collegeStmts.length} statements).`
    );

    console.log('Applying seed_data.sql (100 synthetic students)...');
    const seedStmts = splitSqlStatements(
      fs.readFileSync(path.join(basePath, 'seed_data.sql'), 'utf8')
    );

    const chunkSize = 50;

    for (let i = 0; i < seedStmts.length; i += chunkSize) {
      const chunk = seedStmts.slice(i, i + chunkSize);
      await conn.query(chunk.join(';\n') + ';');

      if (i + chunkSize >= seedStmts.length) {
        console.log(
          `Executed ${Math.min(i + chunkSize, seedStmts.length)} / ${seedStmts.length} seed statements...`
        );
      }
    }

    console.log('seed_data.sql applied successfully!');

    const [tables] = await conn.query('SHOW TABLES');
    console.log('\n--- VERIFICATION: TABLES IN DATABASE ---');
    console.table(tables);

    const [[studentCount]] = await conn.query(
      'SELECT COUNT(*) AS total FROM students'
    );

    const [[bitdCount]] = await conn.query(
      "SELECT COUNT(*) AS total FROM students WHERE register_number LIKE 'BITD%'"
    );

    const [[userCount]] = await conn.query(
      'SELECT COUNT(*) AS total FROM users'
    );

    const [[deptCount]] = await conn.query(
      'SELECT COUNT(*) AS total FROM departments'
    );

    const [[subjectCount]] = await conn.query(
      'SELECT COUNT(*) AS total FROM subjects'
    );

    const [[marksCount]] = await conn.query(
      'SELECT COUNT(*) AS total FROM marks'
    );

    const [[attendanceCount]] = await conn.query(
      'SELECT COUNT(*) AS total FROM attendance'
    );

    console.log(
      `Total Students: ${studentCount.total} (Synthetic BITD students: ${bitdCount.total})`
    );
    console.log(`Total Users: ${userCount.total}`);
    console.log(`Total Departments: ${deptCount.total}`);
    console.log(`Total Subjects: ${subjectCount.total}`);
    console.log(`Total Marks records: ${marksCount.total}`);
    console.log(`Total Attendance records: ${attendanceCount.total}`);
  } finally {
    await conn.end();
  }
}

migrate().catch(err => {
  console.error(
    'Migration failed:',
    err.message,
    err.sqlMessage || '',
    'code:',
    err.code || ''
  );

  process.exitCode = 1;
});
