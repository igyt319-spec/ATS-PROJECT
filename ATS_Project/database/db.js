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

function getSslConfig(targetHost) {
  const cleanHost = (targetHost || process.env.DB_HOST || '').replace(/^"|"$/g, '').trim();

  // If local host, no SSL needed unless explicitly requested
  const isLocal = cleanHost === 'localhost' || cleanHost === '127.0.0.1' || cleanHost === '';
  if (isLocal && process.env.DB_SSL !== 'true') {
    return undefined;
  }

  // Check for inline CA certificate string
  if (process.env.DB_SSL_CA && process.env.DB_SSL_CA.includes('-----BEGIN CERTIFICATE-----')) {
    return { ca: process.env.DB_SSL_CA.trim() };
  }

  // Check for Base64 encoded CA certificate
  if (process.env.DB_SSL_CA_BASE64) {
    try {
      const decodedCa = Buffer.from(process.env.DB_SSL_CA_BASE64, 'base64').toString('utf8');
      if (decodedCa.includes('-----BEGIN CERTIFICATE-----')) {
        return { ca: decodedCa };
      }
    } catch (e) {
      console.warn('[DB SSL] Failed to decode DB_SSL_CA_BASE64:', e.message);
    }
  }

  // Check for CA certificate file path (only if existing file)
  const caPath = process.env.DB_SSL_CA || '';
  if (caPath && fs.existsSync(caPath)) {
    try {
      return { ca: fs.readFileSync(caPath) };
    } catch (e) {
      console.warn('[DB SSL] Could not read CA file, falling back to rejectUnauthorized: false:', e.message);
    }
  }

  // For remote managed databases (e.g. Aiven, Render, AWS RDS), default to rejectUnauthorized: false
  if (cleanHost.includes('aivencloud.com') || process.env.DB_SSL === 'true' || !isLocal) {
    return { rejectUnauthorized: false };
  }

  return undefined;
}

const host = (process.env.DB_HOST || '').replace(/^"|"$/g, '');
const user = (process.env.DB_USER || '').replace(/^"|"$/g, '');
const password = (process.env.DB_PASSWORD || '').replace(/^"|"$/g, '');
const port = parseInt(process.env.DB_PORT, 10) || 3306;
const database = (process.env.DB_NAME || '').replace(/^"|"$/g, '');

const ssl = getSslConfig(host);

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

connection.getSslConfig = getSslConfig;

module.exports = connection;
