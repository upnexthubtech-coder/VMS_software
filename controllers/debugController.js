// Temporary debug controller — remove in production
const userModel = require('../models/login/userModel');

async function getUserByCode(req, res) {
  const { user_code } = req.params;
  if (!user_code) return res.status(400).json({ message: 'user_code required' });

  try {
    const user = await userModel.findUserByUserCode(user_code);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Return the raw DB row for debugging. WARNING: contains password fields.
    return res.json({ user });
  } catch (err) {
    console.error('Debug getUser error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getUserByCode };
