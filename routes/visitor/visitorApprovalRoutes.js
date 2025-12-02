// routes/visitor/visitorApprovalRoutes.js
const express = require('express');
const router = express.Router();
const approvalController = require('../../controllers/visitor/visitorApprovalController');
const { requireAuth, authorizePrebookingHostOrAdmin } = require('../../middleware/authMiddleware');

// PUT /api/visitor/prebooking/:id/status
router.put('/prebooking/:id/status', requireAuth, authorizePrebookingHostOrAdmin, approvalController.updatePrebookingStatus);
// GET /api/visitor/prebookings/pending
router.get('/prebookings/pending', requireAuth, approvalController.getPendingPrebookings);

module.exports = router;
