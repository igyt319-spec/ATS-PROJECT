const db = require('../config/db');

// GET /api/recommendations/:studentId
async function getRecommendationsByStudent(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const [recommendations] = await db.query(
      "SELECT * FROM recommendations WHERE student_id = ? ORDER BY CASE priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 ELSE 4 END ASC, created_at DESC",
      [studentId]
    );

    return res.status(200).json({
      success: true,
      count: recommendations.length,
      data: recommendations
    });
  } catch (error) {
    console.error('[Recommendation Get Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// POST /api/recommendations
async function addRecommendation(req, res) {
  try {
    const { student_id, priority, title, reason, recommendation, category } = req.body;

    const [result] = await db.query(
      `INSERT INTO recommendations (student_id, priority, title, reason, recommendation, category, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
      [student_id || 1, priority || 'MEDIUM', title, reason, recommendation, category || 'Academic']
    );

    return res.status(201).json({
      success: true,
      message: 'Recommendation created successfully',
      data: { id: result.insertId }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// PUT /api/recommendations/:id
async function updateRecommendationStatus(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;

    await db.query('UPDATE recommendations SET status = ? WHERE id = ?', [status || 'Completed', id]);

    return res.status(200).json({ success: true, message: 'Recommendation updated successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getRecommendationsByStudent,
  addRecommendation,
  updateRecommendationStatus
};
