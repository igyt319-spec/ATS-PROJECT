const db = require('../config/db');

/**
 * Persist an audit log event into the audit_logs table.
 * @param {Object} event
 * @param {number|null} event.userId
 * @param {string|null} event.userEmail
 * @param {string} event.action
 * @param {string} event.entityType
 * @param {string|number} [event.entityId]
 * @param {Object|null} [event.previousValue]
 * @param {Object|null} [event.newValue]
 * @param {string} [event.reason]
 * @param {string} [event.ipAddress]
 */
async function logAuditEvent({
  userId = null,
  userEmail = null,
  action,
  entityType,
  entityId = null,
  previousValue = null,
  newValue = null,
  reason = null,
  ipAddress = null
}) {
  try {
    const prevJson = previousValue ? JSON.stringify(previousValue) : null;
    const newJson = newValue ? JSON.stringify(newValue) : null;
    const strEntityId = entityId !== null && entityId !== undefined ? String(entityId) : null;

    await db.query(
      `INSERT INTO audit_logs 
        (user_id, user_email, action, entity_type, entity_id, previous_value, new_value, reason, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, userEmail, action, entityType, strEntityId, prevJson, newJson, reason, ipAddress]
    );
  } catch (err) {
    console.error('[Audit Log Error]', err.message);
  }
}

/**
 * Check and increment rate limiting for sensitive operations.
 * Allows at most maxAttempts failed tries within windowMinutes.
 * @returns {Promise<{ allowed: boolean, remainingAttempts: number, lockedUntil: Date|null }>}
 */
async function checkRateLimit(identifier, actionType, maxAttempts = 5, windowMinutes = 15) {
  try {
    const [rows] = await db.query(
      `SELECT failed_attempts, locked_until, last_attempt_at 
       FROM sensitive_action_rate_limits 
       WHERE identifier = ? AND action_type = ?`,
      [identifier, actionType]
    );

    const now = new Date();

    if (rows.length > 0) {
      const record = rows[0];
      if (record.locked_until && new Date(record.locked_until) > now) {
        return {
          allowed: false,
          remainingAttempts: 0,
          lockedUntil: new Date(record.locked_until)
        };
      }

      // Check if window has expired to reset
      const lastAttempt = new Date(record.last_attempt_at);
      const diffMinutes = (now - lastAttempt) / (1000 * 60);
      if (diffMinutes > windowMinutes) {
        await db.query(
          `UPDATE sensitive_action_rate_limits 
           SET failed_attempts = 0, locked_until = NULL 
           WHERE identifier = ? AND action_type = ?`,
          [identifier, actionType]
        );
        return { allowed: true, remainingAttempts: maxAttempts, lockedUntil: null };
      }

      const remaining = Math.max(0, maxAttempts - record.failed_attempts);
      return { allowed: remaining > 0, remainingAttempts: remaining, lockedUntil: null };
    }

    return { allowed: true, remainingAttempts: maxAttempts, lockedUntil: null };
  } catch (err) {
    console.error('[Rate Limit Check Error]', err.message);
    return { allowed: true, remainingAttempts: maxAttempts, lockedUntil: null };
  }
}

async function recordFailedAttempt(identifier, actionType, maxAttempts = 5, lockMinutes = 15) {
  try {
    const now = new Date();
    const lockTime = new Date(now.getTime() + lockMinutes * 60 * 1000);

    const [rows] = await db.query(
      `SELECT failed_attempts FROM sensitive_action_rate_limits WHERE identifier = ? AND action_type = ?`,
      [identifier, actionType]
    );

    if (rows.length === 0) {
      await db.query(
        `INSERT INTO sensitive_action_rate_limits (identifier, action_type, failed_attempts) VALUES (?, ?, 1)`,
        [identifier, actionType]
      );
    } else {
      const attempts = rows[0].failed_attempts + 1;
      const shouldLock = attempts >= maxAttempts;
      await db.query(
        `UPDATE sensitive_action_rate_limits 
         SET failed_attempts = ?, locked_until = ? 
         WHERE identifier = ? AND action_type = ?`,
        [attempts, shouldLock ? lockTime : null, identifier, actionType]
      );
    }
  } catch (err) {
    console.error('[Rate Limit Record Error]', err.message);
  }
}

async function resetRateLimit(identifier, actionType) {
  try {
    await db.query(
      `DELETE FROM sensitive_action_rate_limits WHERE identifier = ? AND action_type = ?`,
      [identifier, actionType]
    );
  } catch (err) {
    console.error('[Rate Limit Reset Error]', err.message);
  }
}

module.exports = {
  logAuditEvent,
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit
};
