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

require('dotenv').config({
  path: path.join(__dirname, '../backend/.env')
});

const host = (process.env.DB_HOST || '').replace(/^"|"$/g, '');
const user = (process.env.DB_USER || '').replace(/^"|"$/g, '');
const password = (process.env.DB_PASSWORD || '').replace(/^"|"$/g, '');
const port = parseInt(process.env.DB_PORT, 10) || 3306;
const database = (process.env.DB_NAME || '').replace(/^"|"$/g, '');

const caPath = process.env.DB_SSL_CA || '';
const ssl = host === 'localhost' || host === '127.0.0.1'
  ? undefined
  : caPath && fs.existsSync(caPath)
    ? { ca: fs.readFileSync(caPath) }
    : { rejectUnauthorized: false };

const connection = mysql.createPool({
  host,
  user,
  password,
  port,
  database,
  ...(ssl ? { ssl } : {}),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

module.exports = connection;
