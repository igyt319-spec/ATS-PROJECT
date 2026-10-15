const db = require('../config/db');

// GET /api/audit-logs (Admin only)
async function getAuditLogs(req, res) {
  try {
    const { action, entity_type, limit = 50, offset = 0 } = req.query;

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

    if (conditions.length > 0) {
      queryStr += ' WHERE ' + conditions.join(' AND ');
    }

    queryStr += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit, 10) || 50, parseInt(offset, 10) || 0);

    const [rows] = await db.query(queryStr, params);

    // Total count for pagination
    let countQuery = 'SELECT COUNT(*) AS total FROM audit_logs';
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

module.exports = {
  getAuditLogs
};
