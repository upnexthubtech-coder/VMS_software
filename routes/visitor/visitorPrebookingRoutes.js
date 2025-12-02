// routes/visitor/visitorPrebookingRoutes.js
const express = require('express');
const router = express.Router();
const prebookingController = require('../../controllers/visitor/visitorPrebookingController');
const { requireAuth, authorizePrebookingHostOrAdmin } = require('../../middleware/authMiddleware');

// POST /api/visitor/prebooking    (visitor submits form)
router.post('/prebooking', prebookingController.createPrebooking);

// GET /api/visitor/prebooking/:id  (view one prebooking, for host/admin/detail)
router.get('/prebooking/:id', requireAuth, authorizePrebookingHostOrAdmin, prebookingController.getPrebooking);

module.exports = router;
