const express = require('express');
const router = express.Router();
const debugController = require('../controllers/debugController');

// Temporary debug route — remove after troubleshooting
router.get('/user/:user_code', debugController.getUserByCode);

module.exports = router;
