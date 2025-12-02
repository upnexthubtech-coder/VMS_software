const express = require('express');
const router = express.Router();

const forgotPasswordController = require('../../controllers/login/forgotPasswordController');

router.post('/request-otp', forgotPasswordController.requestOTP);
router.post('/reset-password', forgotPasswordController.resetPassword);

module.exports = router;
