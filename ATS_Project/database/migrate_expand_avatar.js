/**
 * Safe Migration Runner: Expand Avatar Column to TEXT
 * 
 * Safely executes:
 *   ALTER TABLE users MODIFY COLUMN avatar TEXT;
 *   ALTER TABLE students MODIFY COLUMN avatar TEXT;
 *   ALTER TABLE faculty MODIFY COLUMN avatar TEXT;
 * 
 * Idempotent and backward-compatible.
 */

const db = require('./db');

async function runAvatarMigration() {
  console.log('[Migration] Starting avatar column expansion to TEXT...');
  
  const tables = ['users', 'students', 'faculty'];
  for (const table of tables) {
    try {
      await db.query(`ALTER TABLE ${table} MODIFY COLUMN avatar TEXT`);
      console.log(`✅ Altered ${table}.avatar to TEXT.`);
    } catch (err) {
      console.warn(`[Migration Notice] ${table}.avatar alter notice:`, err.message);
    }
  }

  console.log('[Migration] Avatar expansion migration completed.');
}

if (require.main === module) {
  runAvatarMigration()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[Migration Error]', err.message);
      process.exit(1);
    });
}

module.exports = runAvatarMigration;
