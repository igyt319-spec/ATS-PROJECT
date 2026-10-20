/**
 * ATS Smart Academic Integrity and Audit System Controller
 * ========================================================
 * Feature 7: Smart Academic Integrity & Audit System
 * 
 * Provides:
 * - Immutable, filterable audit log viewer for administrators & institutional auditors.
 * - Multi-criteria filters: action, entity_type, actor email, date range.
 * - Exportable audit records in CSV and JSON formats.
 * - Rule-based anomaly detection scanner identifying unusual access/modification patterns.
 */

const db = require('../config/db');

// GET /api/audit-logs
async function getAuditLogs(req, res) {
  try {
    const { action, entity_type, user_email, from_date, to_date, limit = 50, offset = 0 } = req.query;

    let queryStr = `
      SELECT al.*, u.name AS user_name, u.role AS user_role
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
    `;
    const params = [];
    const conditions = [];

    if (action) {
      conditions.push('al.action = ?');
      params.push(action);
    }
    if (entity_type) {
      conditions.push('al.entity_type = ?');
      params.push(entity_type);
    }
    if (user_email) {
      conditions.push('al.user_email LIKE ?');
      params.push(`%${user_email}%`);
    }
    if (from_date) {
      conditions.push('al.created_at >= ?');
      params.push(from_date);
    }
    if (to_date) {
      conditions.push('al.created_at <= ?');
      params.push(to_date);
    }

    if (conditions.length > 0) {
      queryStr += ' WHERE ' + conditions.join(' AND ');
    }

    queryStr += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit, 10) || 50, parseInt(offset, 10) || 0);

    const [rows] = await db.query(queryStr, params);

    // Total count for pagination
    let countQuery = 'SELECT COUNT(*) AS total FROM audit_logs al';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }
    const [countResult] = await db.query(countQuery, params.slice(0, conditions.length));

    const parsedRows = rows.map(r => ({
      ...r,
      previous_value: typeof r.previous_value === 'string' ? JSON.parse(r.previous_value) : r.previous_value,
      new_value: typeof r.new_value === 'string' ? JSON.parse(r.new_value) : r.new_value
    }));

    return res.status(200).json({
      success: true,
      total: countResult[0].total,
      count: parsedRows.length,
      data: parsedRows
    });
  } catch (err) {
    console.error('[Get Audit Logs Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/audit-logs/export (Downloadable audit trail report)
async function exportAuditLogs(req, res) {
  try {
    const format = (req.query.format || 'csv').toLowerCase();
    const limit = Math.min(1000, parseInt(req.query.limit, 10) || 500);

    const [rows] = await db.query(
      `SELECT al.id, al.user_id, al.user_email, al.action, al.entity_type, al.entity_id,
              al.reason, al.ip_address, al.created_at,
              u.name AS user_name, u.role AS user_role
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC LIMIT ?`,
      [limit]
    );

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="ats_audit_report.json"');
      return res.status(200).send(JSON.stringify(rows, null, 2));
    }

    // CSV format output
    const headers = ['Log ID', 'Timestamp', 'Actor Name', 'Actor Email', 'Role', 'Action', 'Entity Type', 'Entity ID', 'Reason', 'IP Address'];
    const csvLines = [headers.join(',')];

    rows.forEach(r => {
      const clean = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
      csvLines.push([
        r.id,
        clean(new Date(r.created_at).toISOString()),
        clean(r.user_name || 'System / Unregistered'),
        clean(r.user_email || 'N/A'),
        clean(r.user_role || 'N/A'),
        clean(r.action),
        clean(r.entity_type),
        clean(r.entity_id),
        clean(r.reason || ''),
        clean(r.ip_address || '')
      ].join(','));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="ats_audit_report.csv"');
    return res.status(200).send(csvLines.join('\n'));

  } catch (err) {
    console.error('[Export Audit Logs Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/audit-logs/anomalies (Heuristic Rule-Based Anomaly Detection Scanner)
async function getAuditAnomalies(req, res) {
  try {
    const anomalies = [];

    // Rule 1: Rapid Consecutive Modifications on Same Entity (within 10 minutes)
    const [rapidEdits] = await db.query(`
      SELECT a1.id AS first_event_id, a2.id AS second_event_id,
             a1.user_email, a1.entity_type, a1.entity_id, a1.action,
             a1.created_at AS first_time, a2.created_at AS second_time,
             TIMESTAMPDIFF(MINUTE, a1.created_at, a2.created_at) AS diff_minutes
      FROM audit_logs a1
      JOIN audit_logs a2 ON a1.entity_type = a2.entity_type 
                         AND a1.entity_id = a2.entity_id 
                         AND a1.id < a2.id
                         AND a2.created_at >= a1.created_at
                         AND TIMESTAMPDIFF(MINUTE, a1.created_at, a2.created_at) <= 10
      WHERE a1.action IN ('UPDATE_MARKS', 'UPDATE_ATTENDANCE', 'UPDATE_USER_ROLE')
      ORDER BY a2.created_at DESC LIMIT 15
    `);

    rapidEdits.forEach(r => {
      anomalies.push({
        rule: 'RAPID_CONSECUTIVE_MODIFICATIONS',
        severity: 'MEDIUM',
        description: `Rapid consecutive modifications detected on ${r.entity_type} (ID: ${r.entity_id}) within ${r.diff_minutes} minute(s).`,
        actorEmail: r.user_email,
        entityType: r.entity_type,
        entityId: r.entity_id,
        timestamp: r.second_time,
        notice: 'Heuristic Review Flag: Review with actor to confirm if edit was intentional revision or transcription error.'
      });
    });

    // Rule 2: Off-Hours Grade or Marks Adjustments (Between 23:00 and 05:00)
    const [offHours] = await db.query(`
      SELECT al.*, u.name AS user_name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE (HOUR(al.created_at) >= 23 OR HOUR(al.created_at) < 5)
        AND al.action IN ('UPDATE_MARKS', 'RECORD_MARKS', 'VERIFY_ACTIVITY')
      ORDER BY al.created_at DESC LIMIT 15
    `);

    offHours.forEach(o => {
      anomalies.push({
        rule: 'OFF_HOURS_SENSITIVE_MODIFICATION',
        severity: 'LOW',
        description: `Sensitive action "${o.action}" executed outside standard institutional operating hours (${new Date(o.created_at).toLocaleTimeString()}).`,
        actorEmail: o.user_email,
        entityType: o.entity_type,
        entityId: o.entity_id,
        timestamp: o.created_at,
        notice: 'Heuristic Review Flag: Off-hours operation flagged for routine verification.'
      });
    });

    // Summary counts
    const summary = {
      totalAnomaliesDetected: anomalies.length,
      highSeverityCount: anomalies.filter(a => a.severity === 'HIGH').length,
      mediumSeverityCount: anomalies.filter(a => a.severity === 'MEDIUM').length,
      lowSeverityCount: anomalies.filter(a => a.severity === 'LOW').length,
      disclaimer: 'Anomaly flags represent testable heuristic pattern matches and should not be construed as confirmed security incidents or malicious activities.'
    };

    return res.status(200).json({
      success: true,
      anomaliesDetected: anomalies.length,
      summary,
      anomalies
    });

  } catch (err) {
    console.error('[Get Audit Anomalies Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getAuditLogs,
  exportAuditLogs,
  getAuditAnomalies
};
