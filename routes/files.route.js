const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { uploadFile } = require('../controllers/filesController');

// ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');

// simple disk storage with unique filename
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const safe = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
    cb(null, safe);
  }
});

const upload = multer({ storage });

// POST /api/files/upload
router.post('/upload', upload.single('file'), uploadFile);

module.exports = router;
