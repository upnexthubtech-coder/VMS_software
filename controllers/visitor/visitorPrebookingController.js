// controllers/visitor/visitorPrebookingController.js

const visitorPrebookingModel = require('../../models/visitor/visitorPrebookingModel');
const userModel = require('../../models/login/userModel');
const userProfileModel = require('../../models/user/userProfileModel');
const visitorInviteModel = require('../../models/visitor/visitorInviteModel');
const notificationModel = require('../../models/visitor/visitorNotificationModel');
const { poolPromise, sql } = require('../../config/db.js');

async function createPrebooking(req, res) {
  try {
    const {
      invite_token,
      visitor_name,
      visitor_email,
      visitor_phone,
      company_name,
      purpose,
      visit_date,
      time_slot_from,
      host_user_id,          // optional: user_profile user_id
      host_user_code,        // optional: allow visitors to specify host by user_code (string)
      host_emp_id,           // optional: legacy employee id (invite flow)
      host_dept_id,
      visitor_photo_url,
      belongings,
    } = req.body;

    // Accept either host_user_id (user_profile), host_user_code (string) or host_emp_id (employee_master) as valid host
    if (!visitor_name || !visitor_email || !visit_date || !(host_user_id || host_emp_id)) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    const invite = invite_token
      ? await visitorInviteModel.getInviteByToken(invite_token)
      : null;

    // ensure we pass through the legacy host_emp_id column to the model
    // If client passed host_user_code, resolve to user id
    let resolvedHostUserId = host_user_id || null;
    if (!resolvedHostUserId && host_user_code) {
      const user = await userModel.findUserByUserCode(host_user_code);
      if (user) resolvedHostUserId = user.user_id;
    }

    // If host_dept_id wasn't provided, try to resolve it from host user/employee records
    let resolvedHostDeptId = host_dept_id || null;
    if (!resolvedHostDeptId && resolvedHostUserId) {
      try {
        // prefer model helper to fetch user profile (includes dept_id)
        const up = await userProfileModel.getUserById(resolvedHostUserId);
        if (up && up.dept_id) resolvedHostDeptId = up.dept_id;
      } catch (e) {
        // ignore — best-effort resolution
      }
    }
    if (!resolvedHostDeptId && host_emp_id) {
      try {
        const pool = await poolPromise;
        const p2 = await pool.request()
          .input('emp_id', sql.BigInt, Number(host_emp_id))
          .query('SELECT dept_id FROM employee_master WHERE emp_id = @emp_id');
        if (p2.recordset[0] && p2.recordset[0].dept_id) resolvedHostDeptId = p2.recordset[0].dept_id;
      } catch (e) { /* ignore */ }
    }

    const prebooking_id = await visitorPrebookingModel.createPrebooking(
      {
        invite_id: invite?.invite_id || null,
        visitor_name,
        visitor_email,
        visitor_phone,
        company_name,
        purpose,
        visit_date,
        time_slot_from,
        host_emp_id: host_emp_id || null,
        host_user_id: resolvedHostUserId || null,
        host_dept_id: resolvedHostDeptId,
        visitor_photo_url,
        created_ip: req.ip,
      },
      Array.isArray(belongings) ? belongings : []
    );

    // create notifications: to approver + admin role
    const message = `New visitor request from ${visitor_name} for ${visit_date}`;

    // Determine the employee id to use for visitor_notification.target_emp_id
    // Preference: explicit host_emp_id, else try mapping host user -> employee via user_code -> emp_code
    let targetEmpId = null;
    if (host_emp_id) {
      targetEmpId = Number(host_emp_id);
    } else if (resolvedHostUserId) {
      try {
        const up = await userProfileModel.getUserById(resolvedHostUserId);
        if (up && up.user_code) {
          const pool = await poolPromise;
          const r = await pool.request()
            .input('emp_code', sql.VarChar(100), up.user_code)
            .query('SELECT TOP 1 emp_id FROM employee_master WHERE emp_code = @emp_code AND is_active = 1');
          if (r.recordset[0]) targetEmpId = r.recordset[0].emp_id;
        }
      } catch (e) {
        // ignore mapping failures — we'll fall back to null (no emp target)
      }
    }

    // the socket target (who to push in realtime) should still prefer user id if available
    const socketTarget = resolvedHostUserId || host_emp_id || null;

    await notificationModel.createNotification({
      prebooking_id,
      target_user_id: targetEmpId, // this will be inserted into target_emp_id column by model
      target_role: null,
      type: 'NEW_PREBOOKING',
      message,
    });
    await notificationModel.createNotification({
      prebooking_id,
      target_user_id: null,
      target_role: 'ADMIN',
      type: 'NEW_PREBOOKING',
      message,
    });

    // socket.io real-time push (io injected via req.app.get)
    const io = req.app.get('io');
    if (io) {
      // send only to host user/employee room (prefer user id)
      if (socketTarget) {
        io.to(`user:${socketTarget}`).emit('prebooking:new', {
          prebooking_id,
          visitor_name,
          visit_date,
          message,
        });
      }
      // to all admins room
      io.to('role:ADMIN').emit('prebooking:new', {
        prebooking_id,
        visitor_name,
        visit_date,
        message,
      });
    }

    res.status(201).json({ message: 'Prebooking created', prebooking_id });
  } catch (error) {
    console.error('Create prebooking error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getPrebooking(req, res) {
  try {
    const { id } = req.params;
    const data = await visitorPrebookingModel.getPrebookingById(id);
    if (!data) {
      return res.status(404).json({ message: 'Prebooking not found' });
    }
    res.json(data);
  } catch (error) {
    console.error('Get prebooking error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  createPrebooking,
  getPrebooking,
};
