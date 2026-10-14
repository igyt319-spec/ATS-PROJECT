const db = require('./db');

async function check() {
  try {
    const [tables] = await db.query('SHOW TABLES');
    console.log('Tables:', tables.map(t => Object.values(t)[0]));

    const [userCols] = await db.query('DESCRIBE users');
    console.log('Users columns:', userCols.map(c => c.Field));

    const [users] = await db.query('SELECT id, name, email, role FROM users LIMIT 10');
    console.log('Sample users:', users);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

check();
