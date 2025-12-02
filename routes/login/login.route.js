const express = require('express');
const router = express.Router();

const loginController = require('../../controllers/login/loginController');
const { requireAuth } = require('../../middleware/authMiddleware');

router.post('/login', loginController.login);
router.get('/me', requireAuth, loginController.me);
// logout clears the cookie
router.post('/logout', (req, res) => {
	res.clearCookie('auth_token', { httpOnly: true, sameSite: 'strict' });
	res.json({ message: 'Logged out' });
});

module.exports = router;
