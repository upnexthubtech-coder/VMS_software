// routes/user/userProfileRoutes.js
const express = require('express');
const router = express.Router();
const userProfileController = require('../../controllers/user/userProfileController.js');

// GET /api/users/approvers
router.get('/approvers', userProfileController.getApproverUsers);

module.exports = router;
