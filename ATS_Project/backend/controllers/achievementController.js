const db = require('../config/db');

// GET /api/achievements/:studentId
async function getAchievementsByStudent(req, res) {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const [achievements] = await db.query(
      'SELECT * FROM achievements WHERE student_id = ? ORDER BY achievement_date DESC',
      [studentId]
    );

    // Distribution by category
    const categoryCounts = {};
    achievements.forEach(item => {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    });

    return res.status(200).json({
      success: true,
      count: achievements.length,
      categoryDistribution: categoryCounts,
      data: achievements
    });
  } catch (error) {
    console.error('[Achievement Get Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/achievements (all, for admin)
async function getAllAchievements(req, res) {
  try {
    const [achievements] = await db.query('SELECT * FROM achievements ORDER BY achievement_date DESC');
    return res.status(200).json({ success: true, count: achievements.length, data: achievements });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// POST /api/achievements
async function addAchievement(req, res) {
  try {
    const { student_id, title, category, achievement_date, description, certificate_url, status } = req.body;

    if (!title || !category || !achievement_date) {
      return res.status(400).json({
        success: false,
        message: 'Title, category, and achievement date are required.'
      });
    }

    const [result] = await db.query(
      `INSERT INTO achievements (student_id, title, category, achievement_date, description, certificate_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        student_id || 1,
        title,
        category,
        achievement_date,
        description || '',
        certificate_url || '',
        status || 'Verified'
      ]
    );

    // Also trigger an automatic achievement notification
    await db.query(
      `INSERT INTO notifications (student_id, type, title, message)
       VALUES (?, 'achievement', 'Achievement Added', ?)`,
      [student_id || 1, `New achievement "${title}" (${category}) has been logged to your ATS profile.`]
    );

    return res.status(201).json({
      success: true,
      message: 'Achievement added successfully.',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('[Achievement Add Error]', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// PUT /api/achievements/:id
async function updateAchievement(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { title, category, achievement_date, description, certificate_url, status } = req.body;

    await db.query(
      `UPDATE achievements SET title = ?, category = ?, achievement_date = ?, description = ?, certificate_url = ?, status = ? WHERE id = ?`,
      [title, category, achievement_date, description, certificate_url, status, id]
    );

    return res.status(200).json({ success: true, message: 'Achievement updated successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// DELETE /api/achievements/:id
async function deleteAchievement(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    await db.query('DELETE FROM achievements WHERE id = ?', [id]);
    return res.status(200).json({ success: true, message: 'Achievement deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getAchievementsByStudent,
  getAllAchievements,
  addAchievement,
  updateAchievement,
  deleteAchievement
};
