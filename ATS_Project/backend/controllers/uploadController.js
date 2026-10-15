const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../../database/db');

// Ensure uploads/avatars folder exists
const uploadsDir = path.join(__dirname, '../../uploads');
const avatarsDir = path.join(uploadsDir, 'avatars');
if (!fs.existsSync(avatarsDir)) {
  try {
    fs.mkdirSync(avatarsDir, { recursive: true });
  } catch (e) {
    console.error('Could not create avatars directory:', e.message);
  }
}

// POST /api/upload/avatar
async function uploadAvatar(req, res) {
  try {
    const { imageData, fileName, mimeType, targetUserId } = req.body || {};

    if (!imageData || typeof imageData !== 'string' || !imageData.trim()) {
      return res.status(400).json({
        success: false,
        message: 'No image data provided. Provide a valid base64 image or public image URL.'
      });
    }

    const trimmedInput = imageData.trim();

    // Determine target user ID
    let targetId = req.user.id;
    if (targetUserId && Number(targetUserId) !== Number(req.user.id)) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: "Access denied: You are not authorized to modify another user's profile photo."
        });
      }
      targetId = parseInt(targetUserId, 10);
    }

    // -------------------------------------------------------------
    // Case 1: URI / External Image URL
    // -------------------------------------------------------------
    const isUri = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmedInput) && !trimmedInput.startsWith('data:image/');
    if (isUri) {
      let parsedUrl;
      try {
        parsedUrl = new URL(trimmedInput);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid external image URL format. Only HTTP and HTTPS URLs are permitted.'
          });
        }
      } catch (urlErr) {
        return res.status(400).json({
          success: false,
          message: 'Invalid external image URL format.'
        });
      }

      const cleanUrl = parsedUrl.toString();

      // Persist clean URL directly to DB (never prepend base64)
      await db.query('UPDATE users SET avatar = ?, updated_at = NOW() WHERE id = ?', [cleanUrl, targetId]);
      await db.query('UPDATE students SET avatar = ?, updated_at = NOW() WHERE user_id = ?', [cleanUrl, targetId]);
      await db.query('UPDATE faculty SET avatar = ?, updated_at = NOW() WHERE user_id = ?', [cleanUrl, targetId]);

      console.log(`[Upload] User #${targetId} updated profile avatar via external URL: ${cleanUrl.slice(0, 50)}...`);

      return res.status(200).json({
        success: true,
        message: 'Profile photo URL updated successfully.',
        avatarUrl: cleanUrl
      });
    }

    // -------------------------------------------------------------
    // Case 2: Base64 Encoded Image File
    // -------------------------------------------------------------
    const mimeMatch = trimmedInput.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/i);
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!mimeMatch && !mimeType) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image payload format. Provide an HTTP/HTTPS image URL or data:image base64 string.'
      });
    }

    const detectedMime = (mimeMatch ? mimeMatch[1] : mimeType).toLowerCase();

    if (!allowedMimeTypes.includes(detectedMime)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image format. Allowed formats are JPEG, PNG, and WebP.'
      });
    }

    // Strip data URI scheme prefix
    const cleanBase64 = trimmedInput.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/i, '').trim();
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid base64 payload: decoded image is empty.'
      });
    }

    // Enforce 2MB maximum size limit
    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    if (buffer.length > MAX_SIZE) {
      return res.status(400).json({
        success: false,
        message: `Image size exceeds the maximum permitted limit of 2MB (received ${(buffer.length / (1024 * 1024)).toFixed(2)}MB).`
      });
    }

    // Generate collision-resistant filename & write to /uploads/avatars/
    const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    const ext = extMap[detectedMime] || 'jpg';
    const uniqueName = `avatar_${targetId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const filePath = path.join(avatarsDir, uniqueName);

    try {
      fs.writeFileSync(filePath, buffer);
    } catch (fsErr) {
      console.error('[Upload File Write Error]', fsErr.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to write uploaded image to storage.'
      });
    }

    // Web-accessible URL path (Relative URL stored in MySQL — NEVER raw base64)
    const storedUrlPath = `/uploads/avatars/${uniqueName}`;

    // Update database records safely
    await db.query('UPDATE users SET avatar = ?, updated_at = NOW() WHERE id = ?', [storedUrlPath, targetId]);
    await db.query('UPDATE students SET avatar = ?, updated_at = NOW() WHERE user_id = ?', [storedUrlPath, targetId]);
    await db.query('UPDATE faculty SET avatar = ?, updated_at = NOW() WHERE user_id = ?', [storedUrlPath, targetId]);

    // Sanitize logs: never print raw base64 payloads to stdout/stderr
    console.log(`[Upload] User #${targetId} uploaded profile photo: ${uniqueName} (${buffer.length} bytes, MIME: ${detectedMime})`);

    return res.status(200).json({
      success: true,
      message: 'Profile photo uploaded and updated successfully.',
      avatarUrl: storedUrlPath
    });

  } catch (err) {
    console.error('[UploadAvatar Error]', err.message);
    return res.status(500).json({ success: false, message: 'Internal server error processing image upload.' });
  }
}

module.exports = {
  uploadAvatar
};
