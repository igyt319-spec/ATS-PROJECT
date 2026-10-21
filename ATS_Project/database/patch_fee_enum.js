const db = require('./db');

async function patch() {
  try {
    await db.query(`
      ALTER TABLE fee_payments 
      MODIFY COLUMN status ENUM('Success', 'Failed', 'Pending', 'Cancelled') NOT NULL DEFAULT 'Success'
    `);
    console.log('✅ Safely patched fee_payments status column to include Pending and Cancelled.');
  } catch (err) {
    console.log('Notice on fee_payments status alter:', err.message);
  } finally {
    process.exit(0);
  }
}

patch();
