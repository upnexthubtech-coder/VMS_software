const path = require('path');

async function uploadFile(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    // build public URL for the uploaded file (prefer explicit env override)
    // Use request host/protocol as fallback so deployed environments behind proxies work
    const host = process.env.APP_API_ORIGIN || `${req.protocol}://${req.get('host')}`;
    const fileUrl = `${host.replace(/\/$/, '')}/uploads/${req.file.filename}`;

    return res.json({ url: fileUrl });
  } catch (err) {
    console.error('File upload error', err);
    return res.status(500).json({ message: 'Failed to upload file' });
  }
}

module.exports = { uploadFile };
