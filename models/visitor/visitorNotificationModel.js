// models/visitor/visitorNotificationModel.js
const { poolPromise } = require('../../config/db');
const sql = require('mssql');

async function createNotification({ prebooking_id, target_user_id, target_role, type, message }) {
  const pool = await poolPromise;
  
  // Safely convert target_user_id to number (handle string values and comma-separated strings)
  let targetUserId = null;
  if (target_user_id) {
    const idStr = String(target_user_id).trim();
    // If comma-separated, take first value
    const cleanId = idStr.split(',')[0].trim();
    const num = Number(cleanId);
    if (Number.isFinite(num) && num > 0) {
      targetUserId = num;
    }
  }

  // Normalize: the notification table stores 'target_emp_id' (employee id) — callers may pass a user_profile id.
  // If we have a numeric id, try to validate whether it refers to employee_master.emp_id; if not, try mapping
  // the id as user_profile.user_id -> user_code -> employee_master.emp_code -> emp_id.
  let targetEmpId = null;
  if (targetUserId) {
    try {
      // check if an employee with this id exists
      const empCheck = await pool.request()
        .input('emp_id', sql.BigInt, targetUserId)
        .query('SELECT TOP 1 emp_id FROM employee_master WHERE emp_id = @emp_id AND is_active = 1');
      if (empCheck.recordset && empCheck.recordset.length > 0) {
        targetEmpId = empCheck.recordset[0].emp_id;
      } else {
        // not an employee id — treat as user_profile id and try mapping via user_code
        const userRes = await pool.request()
          .input('user_id', sql.BigInt, targetUserId)
          .query('SELECT TOP 1 user_code FROM user_profile WHERE user_id = @user_id AND is_active = 1');
        if (userRes.recordset && userRes.recordset.length > 0 && userRes.recordset[0].user_code) {
          const code = userRes.recordset[0].user_code;
          const mapRes = await pool.request()
            .input('emp_code', sql.VarChar(100), code)
            .query('SELECT TOP 1 emp_id FROM employee_master WHERE emp_code = @emp_code AND is_active = 1');
          if (mapRes.recordset && mapRes.recordset.length > 0) {
            targetEmpId = mapRes.recordset[0].emp_id;
          }
        }
      }
    } catch (e) {
      // non-fatal — we'll fall back to null targetEmpId
      targetEmpId = null;
    }
  }
  
  // Ensure prebooking_id is a numeric value (or NULL) to avoid driver validation errors
  const safePrebookingId = (prebooking_id === null || prebooking_id === undefined) ? null : (Number.isFinite(Number(prebooking_id)) ? Number(prebooking_id) : null);
  if (prebooking_id !== null && prebooking_id !== undefined && safePrebookingId === null) {
    // invalid prebooking_id provided — log and continue with NULL (notification still useful)
    console.warn('createNotification: invalid prebooking_id provided, inserting NULL instead', { prebooking_id });
  }

  // helper that tries to bind parameter with a type, falling back to value-only binding
  const safeRequest = pool.request();
  const bindParam = (req, name, type, val) => {
    try {
      // if caller passed a valid mssql type object, use typed binding
      if (type && typeof type === 'object' && typeof type.validate === 'function') {
        return req.input(name, type, val);
      }
      // if type appears to be the mssql module function (constructor), try it
      if (type && typeof type === 'function' && typeof type().validate === 'function') {
        return req.input(name, type, val);
      }
      // fallback: let the driver infer the type from the value
      return req.input(name, val);
    } catch (err) {
      // fallback binding if a type-based bind fails (defensive)
      try { return req.input(name, val); } catch (e) { throw err; }
    }
  };

  // debug-type check for easier tracing when drivers throw parameter errors
  console.debug('createNotification: safePrebookingId type', typeof safePrebookingId, safePrebookingId, 'targetEmpId', typeof targetEmpId, targetEmpId);

  bindParam(safeRequest, 'prebooking_id', sql.BigInt, safePrebookingId);
  bindParam(safeRequest, 'target_emp_id', sql.BigInt, targetEmpId);
  bindParam(safeRequest, 'target_role', sql.VarChar(50), target_role || null);
  bindParam(safeRequest, 'type', sql.VarChar(50), type);
  bindParam(safeRequest, 'message', sql.NVarChar(500), message);

  const res = await safeRequest.query(`
      INSERT INTO visitor_notification (
        prebooking_id, target_emp_id, target_role, type, message
      )
      OUTPUT INSERTED.notification_id
      VALUES (@prebooking_id, @target_emp_id, @target_role, @type, @message)
    `);
  return res.recordset[0];
}

module.exports = { createNotification };
