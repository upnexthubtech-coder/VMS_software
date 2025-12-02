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
      <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; background:#f3f4f6; padding:28px;">
        <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;padding:22px;border:1px solid #e6e6e6;">
          <div style="text-align:center;padding-bottom:8px;border-bottom:1px solid #f0f0f0;">
            <h2 style="margin:0;color:#0f172a;font-size:20px;">Your Visitor Management System — OTP</h2>
            <p style="margin:6px 0 0;color:#6b7280;font-size:13px">Use the code below to reset your password</p>
          </div>

          <div style="display:flex;align-items:center;justify-content:center;padding:18px 0;">
            <div style="background:linear-gradient(90deg,#4f46e5,#7c3aed);padding:18px 26px;border-radius:12px;color:white;font-weight:800;font-size:26px;letter-spacing:2px;">
              ${otp}
            </div>
          </div>

          <div style="text-align:center;color:#374151;font-size:13px;line-height:1.4;padding-bottom:8px;">
            <p style="margin:0 0 8px 0">This code is valid for <strong>10 minutes</strong>. Keep it secret — do not share it with anyone.</p>
            <p style="margin:0;color:#9aa1ae;font-size:12px">If you didn't request a password reset, please ignore this email or contact your administrator.</p>
          </div>

          <div style="margin-top:12px;border-top:1px dashed #e6e6e6;padding-top:12px;font-size:12px;color:#9aa1ae;text-align:center;">
            <div>Thank you — Visitor Management System</div>
          </div>
        </div>
      </div>
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
