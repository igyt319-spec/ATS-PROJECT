const path = require('path');
const mysql = require('mysql2/promise');
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

require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function checkConnections() {
  console.log('--- 1. Testing Localhost:3306 ---');
  try {
    const localConn = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: '',
      connectTimeout: 2000
    });
    console.log('✅ Localhost:3306 is RUNNING and accessible!');
    const [databases] = await localConn.query('SHOW DATABASES');
    console.log('Local databases:', databases.map(d => Object.values(d)[0]).join(', '));
    await localConn.end();
  } catch (err) {
    console.log(`❌ Localhost:3306: ${err.message}`);
  }

  console.log('\n--- 2. Testing Cloud Host with IPv4 forced ---');
  const dbHost = (process.env.DB_HOST || '').replace(/^"|"$/g, '');
  const dbPort = parseInt(process.env.DB_PORT, 10) || 3306;
  const dbName = (process.env.DB_NAME || '').replace(/^"|"$/g, '');
  const dbUser = (process.env.DB_USER || '').replace(/^"|"$/g, '');

  try {
    const cloudConn = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: process.env.DB_PASSWORD,
      database: dbName,
      connectTimeout: 5000,
      ssl: { rejectUnauthorized: false }
    });
    console.log(`✅ Cloud Host (${dbHost}) is ACCESSIBLE!`);
    const [tables] = await cloudConn.query('SHOW TABLES');
    console.log('Tables in cloud database:', tables.map(t => Object.values(t)[0]).join(', '));
    await cloudConn.end();
  } catch (err) {
    console.log(`❌ Cloud Host (${dbHost}): ${err.message}`);
  }
}

checkConnections();
