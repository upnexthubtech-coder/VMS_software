const express = require('express');
const router = express.Router();
const inoutController = require('../../controllers/visitor/visitorInoutController');
const { requireAuth } = require('../../middleware/authMiddleware');

// POST /api/visitor/inout
router.post('/inout', requireAuth, inoutController.createInoutRecord);

// GET /api/visitor/inout/recent
router.get('/inout/recent', requireAuth, inoutController.listRecentInouts);

// GET /api/visitor/inout/lookup?gatepass_id=X — retrieve PPE/notes/vehicle details for a gatepass
router.get('/inout/lookup', requireAuth, inoutController.getInoutByGatepass);

module.exports = router;
