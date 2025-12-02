// routes/visitor/visitorInviteRoutes.js
const express = require('express');
const router = express.Router();
const visitorInviteController = require('../../controllers/visitor/visitorInviteController');

// POST /api/visitor/invite  → employee enters visitor email (requires auth)
const { requireAuth } = require('../../middleware/authMiddleware');
router.post('/invite', requireAuth, visitorInviteController.createVisitorInvite);

// GET /api/visitor/invite?token=... → validate invite from link
router.get('/invite', visitorInviteController.getInviteByToken);

module.exports = router;
