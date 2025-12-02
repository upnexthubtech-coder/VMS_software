// controllers/user/userProfileController.js
const userProfileModel = require('../../models/user/userProfileModel');

async function getApproverUsers(req, res) {
  try {
    const users = await userProfileModel.getApproverUsers();
    res.json(users);
  } catch (err) {
    console.error('Get approver users error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  getApproverUsers,
};
