const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../../database/db');

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (e) {
    console.error('Could not create uploads directory:', e.message);
  }
}

// POST /api/upload/avatar
async function uploadAvatar(req, res) {
  try {
    const { imageData, fileName, mimeType, targetUserId } = req.body;

    if (!imageData) {
      return res.status(400).json({
        success: false,
        message: 'No image data provided. Provide base64 image string.'
      });
    }

    // Validate MIME type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const detectedMime = mimeType || (imageData.match(/^data:(image\/[a-zA-Z+]+);base64,/) || [])[1];

    if (detectedMime && !allowedMimeTypes.includes(detectedMime.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image format. Allowed formats are JPEG, PNG, and WebP.'
      });
    }

    // Strip base64 prefix if present
    const cleanBase64 = imageData.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    // 2MB size check
    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    if (buffer.length > MAX_SIZE) {
      return res.status(400).json({
        success: false,
        message: 'Image size exceeds maximum permitted limit of 2MB.'
      });
    }

    // Target user check
    let targetId = req.user.id;
    if (targetUserId && targetUserId !== req.user.id) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to modify another user\'s profile photo.'
        });
      }
      targetId = parseInt(targetUserId, 10);
    }

    // Generate local filename & save file to /uploads
    const ext = detectedMime ? detectedMime.split('/')[1] : 'jpg';
    const uniqueName = `avatar_${targetId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const filePath = path.join(uploadsDir, uniqueName);

    try {
      fs.writeFileSync(filePath, buffer);
    } catch (fsErr) {
      console.warn('[Upload save file warning]:', fsErr.message);
    }

    // Render-safe storage: Use persistent data URL if ephemeral disk, or URL path
    // A clean data URI guarantees permanence on Render restarts without S3
    const mimePrefix = detectedMime || 'image/jpeg';
    const avatarDataUri = `data:${mimePrefix};base64,${cleanBase64}`;
    const avatarLocalUrl = `/uploads/${uniqueName}`;

    // Prefer Data URI for complete Render crash/restart resilience, or local URL if small
    const avatarUrlToSave = buffer.length < 500000 ? avatarDataUri : avatarLocalUrl;

    // Update users table
    await db.query('UPDATE users SET avatar = ?, updated_at = NOW() WHERE id = ?', [avatarUrlToSave, targetId]);
    await db.query('UPDATE students SET avatar = ?, updated_at = NOW() WHERE user_id = ?', [avatarUrlToSave, targetId]);
    await db.query('UPDATE faculty SET avatar = ?, updated_at = NOW() WHERE user_id = ?', [avatarUrlToSave, targetId]);

    return res.status(200).json({
      success: true,
      message: 'Profile photo uploaded and updated successfully.',
      avatarUrl: avatarUrlToSave,
      localPath: avatarLocalUrl
    });

  } catch (err) {
    console.error('[UploadAvatar Error]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  uploadAvatar
};
