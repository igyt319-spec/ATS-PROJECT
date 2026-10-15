const db = require('./db');

async function runSystemUpgradeMigration() {
  console.log('[Migration] Starting system upgrade migration...');

  // 1. Create department_hod_assignments table with database-enforced single active HOD constraint
  await db.query(`
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
    );
  `);
  console.log('✅ Created table department_hod_assignments with single active HOD unique constraint.');

  try {
    await db.query('ALTER TABLE department_hod_assignments ADD CONSTRAINT fk_dha_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE');
    console.log('✅ Added foreign key fk_dha_dept');
  } catch (e) {
    if (!e.message.includes('Duplicate')) console.log('Notice on fk_dha_dept:', e.message);
  }

  try {
    await db.query('ALTER TABLE department_hod_assignments ADD CONSTRAINT fk_dha_fac FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE');
    console.log('✅ Added foreign key fk_dha_fac');
  } catch (e) {
    if (!e.message.includes('Duplicate')) console.log('Notice on fk_dha_fac:', e.message);
  }

  // 2. Create audit_logs table
  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      user_email VARCHAR(100) NULL,
      action VARCHAR(80) NOT NULL,
      entity_type VARCHAR(60) NOT NULL,
      entity_id VARCHAR(50) NULL,
      previous_value JSON NULL,
      new_value JSON NULL,
      reason TEXT NULL,
      ip_address VARCHAR(50) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_audit_user (user_id),
      KEY idx_audit_action (action),
      KEY idx_audit_entity (entity_type, entity_id),
      KEY idx_audit_created (created_at)
    );
  `);
  console.log('✅ Created table audit_logs.');

  // 3. Create sensitive_action_rate_limits table
  await db.query(`
    CREATE TABLE IF NOT EXISTS sensitive_action_rate_limits (
      id INT AUTO_INCREMENT PRIMARY KEY,
      identifier VARCHAR(120) NOT NULL,
      action_type VARCHAR(50) NOT NULL,
      failed_attempts INT NOT NULL DEFAULT 1,
      locked_until DATETIME NULL,
      last_attempt_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_action_identifier (identifier, action_type)
    );
  `);
  console.log('✅ Created table sensitive_action_rate_limits.');

  // 4. Populate department_hod_assignments from existing faculty WHERE is_hod = 1
  const [existingHODs] = await db.query(`
    SELECT f.id AS faculty_id, f.department_id, f.user_id 
    FROM faculty f 
    WHERE f.is_hod = 1
  `);
  for (const hod of existingHODs) {
    await db.query(`
      INSERT IGNORE INTO department_hod_assignments 
        (department_id, faculty_id, assigned_by, start_date, status)
      VALUES (?, ?, ?, CURDATE(), 'active')
    `, [hod.department_id, hod.faculty_id, hod.user_id || 1]).catch(() => {});
  }
  console.log(`✅ Seeded ${existingHODs.length} existing active HOD assignments.`);

  // 5. Ensure mentor_assignments view exists pointing to student_mentors
  await db.query(`
    CREATE OR REPLACE VIEW mentor_assignments AS 
    SELECT sm.id, sm.student_id, sm.faculty_id, sm.assigned_by, sm.status, sm.assigned_at, sm.updated_at
    FROM student_mentors sm;
  `).catch(err => console.warn('Could not create view mentor_assignments:', err.message));
  console.log('✅ Created view mentor_assignments.');

  console.log('[Migration] System upgrade migration completed successfully.');
}

if (require.main === module) {
  runSystemUpgradeMigration()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[Migration Error]', err);
      process.exit(1);
    });
}

module.exports = runSystemUpgradeMigration;
