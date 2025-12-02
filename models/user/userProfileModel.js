// models/user/userProfileModel.js
const { poolPromise, sql } = require('../../config/db');

async function getApproverUsers() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    -- include department details (if any) sokkkkkkk frontend can associate approvers with a department
    SELECT 
      u.user_id,
      u.full_name,
      u.user_code,
      u.role,
      u.designation,
      u.dept_id,
      d.dept_name
    FROM user_profile u
    LEFT JOIN department_master d ON u.dept_id = d.dept_id
    WHERE u.is_active = 1
  `);
  return result.recordset;
}

const { ALLOWED_ROLES, mapDesignationToRole } = require('../../config/roles');

async function createUserProfile({ user_code, full_name, email, role, designation, dept_id, password_hash }) {
  // Normalise role token to match DB CHECKs (uppercase tokens: SECURITY/HOD/USER/ADMIN)
  let roleToInsert = null;
  if (role) {
    const cand = String(role).trim().toLowerCase();
    if (Array.isArray(ALLOWED_ROLES) && ALLOWED_ROLES.includes(cand)) {
      roleToInsert = String(cand).toUpperCase();
    }
  }
  // If role wasn't provided or not mappable, try to map from designation
  if (!roleToInsert && designation) {
    const mapped = mapDesignationToRole(designation);
    if (mapped) roleToInsert = String(mapped).toUpperCase();
  }
  // If still missing, default to USER (safe allowed token)
  if (!roleToInsert) roleToInsert = 'USER';
  const pool = await poolPromise;
  const r = await pool.request()
    .input('user_code', user_code)
    .input('full_name', full_name)
    .input('email', email || null)
    // use normalized role value safe for DB
    .input('role', roleToInsert)
    // store free-text designation separately so DB role CHECK does not need to be relaxed
    .input('designation', designation || null)
    // optional department id (bigint)
    .input('dept_id', sql.BigInt, dept_id != null ? Number(dept_id) : null)
    .input('password_hash', password_hash || null)
    .query(`
      INSERT INTO user_profile (user_code, full_name, email, role, designation, dept_id, password_hash)
      OUTPUT INSERTED.user_id
      VALUES (@user_code, @full_name, @email, @role, @designation, @dept_id, @password_hash)
    `);
  return r.recordset[0].user_id;
}

// fetch a user profile by id (including department info)
async function getUserById(user_id) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('user_id', user_id)
    .query(`
      SELECT u.*, d.dept_name
      FROM user_profile u
      LEFT JOIN department_master d ON u.dept_id = d.dept_id
      WHERE u.user_id = @user_id
    `);
  return result.recordset[0] || null;
}

module.exports = {
  getApproverUsers,
  createUserProfile,
  getUserById,
};
