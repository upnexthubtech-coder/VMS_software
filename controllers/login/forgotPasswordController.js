const userModel = require('../../models/login/userModel');
const generateOTP = require('../../utils/login/generateOTP');
const sendMail = require('../../config/mailer');
const { hashPassword } = require('../../utils/login/hashPassword');
const sql = require('mssql');
const dbConfig = require('../../config/db');   // contains poolPromise

// ---------------------------------------------------------
// 1️⃣ REQUEST OTP
// ---------------------------------------------------------
async function requestOTP(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const user = await userModel.findUserByEmail(email);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await userModel.insertPasswordResetOtp(user.user_id, otp, expiresAt);

    const htmlContent = `
      <p>Your OTP for password reset is: <b>${otp}</b>.</p>
      <p>It expires in 10 minutes.</p>
    `;

    await sendMail(email, 'Password Reset OTP', htmlContent);

    return res.json({ message: 'OTP sent to your email' });

  } catch (error) {
    console.error('Request OTP error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}



// ---------------------------------------------------------
// 2️⃣ RESET PASSWORD (with MSSQL Transaction FIXED)
// ---------------------------------------------------------
async function resetPassword(req, res) {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({
      message: 'Email, OTP and new password are required'
    });
  }

  try {
    const user = await userModel.findUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const otpRecord = await userModel.findValidOtp(user.user_id, otp);
    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid or used OTP' });
    }

    if (new Date(otpRecord.expires_at) < new Date()) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    const hashedPassword = await hashPassword(newPassword);

    // -------- FIXED TRANSACTION CODE ----------
    const pool = await dbConfig.poolPromise;

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const request = new sql.Request(transaction);

      // Update Password
      await request
        .input('password_hash', hashedPassword)
        .input('user_id', user.user_id)
        .query(`
          UPDATE user_profile 
          SET password_hash = @password_hash 
          WHERE user_id = @user_id
        `);

      // Mark OTP as used
      await request
        .input('otp_id', otpRecord.id)
        .query(`
          UPDATE password_reset_otp 
          SET is_used = 1 
          WHERE id = @otp_id
        `);

      await transaction.commit();

      return res.json({ message: 'Password reset successful' });

    } catch (txError) {
      await transaction.rollback(); // rollback transaction
      throw txError;
    }

  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}


// Export functions
module.exports = { requestOTP, resetPassword };
