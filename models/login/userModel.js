const { poolPromise } = require('../../config/db');

async function findUserByUserCode(user_code) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('user_code', user_code)
    .query('SELECT * FROM user_profile WHERE user_code = @user_code AND is_active = 1');

  return result.recordset[0] || null;
}

async function findUserByEmail(email) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('email', email)
    .query('SELECT * FROM user_profile WHERE email = @email AND is_active = 1');

  return result.recordset[0] || null;
}

async function insertPasswordResetOtp(user_id, otp_code, expires_at) {
  const pool = await poolPromise;
  await pool.request()
    .input('user_id', user_id)
    .input('otp_code', otp_code)
    .input('expires_at', expires_at)
    .query(`INSERT INTO password_reset_otp (user_id, otp_code, expires_at, is_used, created_at)
            VALUES (@user_id, @otp_code, @expires_at, 0, GETUTCDATE())`);
}

async function findValidOtp(user_id, otp_code) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('user_id', user_id)
    .input('otp_code', otp_code)
    .query(`SELECT TOP 1 * FROM password_reset_otp
            WHERE user_id = @user_id AND otp_code = @otp_code AND is_used = 0
            ORDER BY created_at DESC`);

  return result.recordset[0] || null;
}

async function updatePassword(user_id, password_hash) {
  const pool = await poolPromise;
  await pool.request()
    .input('user_id', user_id)
    .input('password_hash', password_hash)
    .query('UPDATE user_profile SET password_hash = @password_hash WHERE user_id = @user_id');
}

async function markOtpUsed(otp_id) {
  const pool = await poolPromise;
  await pool.request()
    .input('otp_id', otp_id)
    .query('UPDATE password_reset_otp SET is_used = 1 WHERE id = @otp_id');
}

module.exports = {
  findUserByUserCode,
  findUserByEmail,
  insertPasswordResetOtp,
  findValidOtp,
  updatePassword,
  markOtpUsed
};
