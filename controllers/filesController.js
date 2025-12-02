const path = require('path');

async function uploadFile(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    // build public URL for the uploaded file
    // stored at /uploads/<filename>
    const host = process.env.APP_API_ORIGIN || `https://vms-software.onrender.com:${process.env.PORT || 3000}`;
    const fileUrl = `${host}/uploads/${req.file.filename}`;

    return res.json({ url: fileUrl });
  } catch (err) {
    console.error('File upload error', err);
    return res.status(500).json({ message: 'Failed to upload file' });
  }
}

module.exports = { uploadFile };
