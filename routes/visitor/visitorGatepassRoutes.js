const express = require('express');
const router = express.Router();
const gatepassController = require('../../controllers/visitor/visitorGatepassController');
const { requireAuth } = require('../../middleware/authMiddleware');

// GET /api/visitor/gatepass/prebooking/:id
router.get('/gatepass/prebooking/:id', requireAuth, gatepassController.getGatepassByPrebooking);

// GET /api/visitor/gatepass/code/:code
router.get('/gatepass/code/:code', requireAuth, gatepassController.getGatepassByCode);

module.exports = router;
