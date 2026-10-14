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
      if (stmt && !/^USE\s/i.test(stmt) &&
          !/^CREATE\s+DATABASE\s/i.test(stmt)) {
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
  if (stmt && !/^USE\s/i.test(stmt) &&
      !/^CREATE\s+DATABASE\s/i.test(stmt)) {
    statements.push(stmt);
  }

  return statements;
}

async function migrate() {
  const host = (process.env.DB_HOST || '').replace(/^"|"$/g, '');
  const user = (process.env.DB_USER || '').replace(/^"|"$/g, '');
  const password = (process.env.DB_PASSWORD || '').replace(/^"|"$/g, '');
  const port = parseInt(process.env.DB_PORT, 10) || 3306;
  const database = (process.env.DB_NAME || '').replace(/^"|"$/g, '');

  if (!host || !user || !database) {
    throw new Error('Missing DB_HOST, DB_USER, or DB_NAME in .env');
  }

  console.log(`Connecting to MySQL at ${host}:${port}/${database} as ${user}...`);

  const caPath = process.env.DB_SSL_CA || '';
  const ssl = host === 'localhost' || host === '127.0.0.1'
    ? undefined
    : caPath && fs.existsSync(caPath)
      ? { ca: fs.readFileSync(caPath) }
      : { rejectUnauthorized: false };

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

    // 1. Run schema.sql
    console.log('Applying schema.sql...');
    const schemaStmts = splitSqlStatements(
      fs.readFileSync(path.join(basePath, 'schema.sql'), 'utf8')
    );

    for (const stmt of schemaStmts) {
      await conn.query(stmt);
    }

    await conn.query(
      'ALTER TABLE marks MODIFY grade_point DECIMAL(4,2) NOT NULL DEFAULT 0'
    ).catch(() => {});

    await conn.query(
      'ALTER TABLE grading_rules MODIFY grade_point DECIMAL(4,2) NOT NULL'
    ).catch(() => {});

    console.log(`schema.sql applied (${schemaStmts.length} statements).`);

    // 2. Run college_data.sql
    console.log('Applying college_data.sql...');
    const collegeStmts = splitSqlStatements(
      fs.readFileSync(path.join(basePath, 'college_data.sql'), 'utf8')
    );

    for (const stmt of collegeStmts) {
      await conn.query(stmt);
    }

    console.log(`college_data.sql applied (${collegeStmts.length} statements).`);

    // 3. Run seed_data.sql
    console.log('Applying seed_data.sql (100 synthetic students)...');
    const seedStmts = splitSqlStatements(
      fs.readFileSync(path.join(basePath, 'seed_data.sql'), 'utf8')
    );

    const chunkSize = 50;

    for (let i = 0; i < seedStmts.length; i += chunkSize) {
      const chunk = seedStmts.slice(i, i + chunkSize);
      const combined = chunk.join(';\n') + ';';

      await conn.query(combined);

      if ((i + chunkSize) % 500 === 0 ||
          i + chunkSize >= seedStmts.length) {
        console.log(
          `Executed ${Math.min(i + chunkSize, seedStmts.length)} / ${seedStmts.length} seed statements...`
        );
      }
    }

    console.log('seed_data.sql applied successfully!');

    // 4. Verify data
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

    console.log(`Total Students: ${studentCount.total} (Synthetic BITD students: ${bitdCount.total})`);
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
  console.error('Migration failed:', err.message, err.sqlMessage, 'code:', err.code);
  process.exit(1);
});
