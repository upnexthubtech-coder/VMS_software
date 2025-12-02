const { poolPromise } = require('d:/sne_applicatoin2/visitor_mangmant_system/API/config/db');
const sql = require('mssql');

async function createInvite({ visitor_email, invite_message, invited_for_date, created_by }) {
  const pool = await poolPromise;

  const safeEmail = visitor_email.trim().slice(0, 200);
  const safeInviteMessage = invite_message ? String(invite_message).slice(0, 500) : null;
  const safeCreatedBy = created_by ? Number(created_by) : null;
  const safeInvitedForDate = invited_for_date || null;

  const result = await pool.request()
    .input('visitor_email', safeEmail)
    .input('invite_message', safeInviteMessage)
    .input('invited_for_date', safeInvitedForDate)
    .input('created_by', safeCreatedBy)
    .query(`
      INSERT INTO visitor_invite (
        visitor_email, invite_message, invited_for_date, created_by
      )
      OUTPUT INSERTED.invite_id, INSERTED.invite_token, INSERTED.created_at
      VALUES (@visitor_email, @invite_message, @invited_for_date, @created_by)
    `);

  return result.recordset[0];
}

async function getInviteByToken(invite_token) {
  const pool = await poolPromise;

  const result = await pool.request()
    .input('invite_token', invite_token)
    .query(`
      SELECT *
      FROM visitor_invite
      WHERE invite_token = @invite_token
    `);

  return result.recordset[0] || null;
}

module.exports = {
  createInvite,
  getInviteByToken,
};
