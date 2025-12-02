// controllers/visitor/visitorApprovalController.js
const { poolPromise } = require('../../config/db');
const sql = require('mssql');
const notificationModel = require('../../models/visitor/visitorNotificationModel');
const gatepassModel = require('../../models/visitor/visitorGatepassModel');
const mailerService = require('../../services/mailerService');

async function updatePrebookingStatus(req, res) {
  try {
    const { id } = req.params;
    const { action, approve_date } = req.body;

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action' });
    }

    const pool = await poolPromise;

    const preRes = await pool.request()
      .input('prebooking_id', sql.BigInt, id)
      .query(`
        SELECT p.*, u.user_id AS host_user_id, u.full_name AS host_user_full_name
        FROM visitor_prebooking p
        LEFT JOIN user_profile u ON p.host_user_id = u.user_id
        WHERE p.prebooking_id = @prebooking_id
      `);

    const pre = preRes.recordset[0];
    if (!pre) return res.status(404).json({ message: 'Prebooking not found' });

    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const finalDate = approve_date || pre.visit_date;

    await pool.request()
      .input('prebooking_id', sql.BigInt, id)
      .input('status', sql.VarChar(20), newStatus)
      .input('visit_date', sql.Date, finalDate)
      .query(`
        UPDATE visitor_prebooking
        SET status = @status, visit_date = @visit_date
        WHERE prebooking_id = @prebooking_id
      `);

    const message =
      action === 'APPROVE'
        ? `Your visit on ${finalDate} has been approved.`
        : `Your visit request has been rejected.`;

    if (action === 'APPROVE') {
      const hostName = pre.host_user_full_name || null;

      (async () => {
        try {
          const gp = await gatepassModel.createGatepass({
            prebooking_id: id,
            visitor_name: pre.visitor_name,
            visitor_email: pre.visitor_email,
            visitor_phone: pre.visitor_phone || null,
            company_name: pre.company_name || null,
            purpose: pre.purpose || null,
            host_emp_id: pre.host_emp_id || null,
            host_name: hostName,
            visit_date: finalDate,
            visitor_photo_url: pre.visitor_photo_url || null,
            expires_at: null,
            time_slot_from: pre.time_slot_from || null,
          });

          try {
            await mailerService.sendGatepassEmail(
              pre.visitor_email,
              {
                visitor_name: pre.visitor_name,
                host_name: hostName,
                visit_date: finalDate,
                visitor_photo_url: gp.visitor_photo_url || null,
                gatepass_code: gp.gatepass_code,
                company_name: pre.company_name || null,
              },
              gp.pdf_file_url
                ? [{ filename: `${gp.gatepass_code}.pdf`, path: `.${gp.pdf_file_url}` }]
                : []
            );
          } catch (emailErr) {
            console.warn('Failed sending gatepass email', emailErr);
          }
        } catch (err) {
          console.error('Background gatepass creation/email failed', err);
        }
      })();
    }

    // Notify the host (if available) and admins. Also best-effort set host_dept_id on the prebooking
    const pool2 = await poolPromise;

    // attempt to set host_dept_id on the prebooking if missing by looking up employee/user values
    try {
      const lookup = await pool2.request()
        .input('prebooking_id', sql.BigInt, id)
        .query(`
          SELECT p.prebooking_id, p.host_dept_id, p.host_emp_id, p.host_user_id, e.dept_id AS emp_dept, u.dept_id AS user_dept
          FROM visitor_prebooking p
          LEFT JOIN employee_master e ON p.host_emp_id = e.emp_id
          LEFT JOIN user_profile u ON p.host_user_id = u.user_id
          WHERE p.prebooking_id = @prebooking_id
        `);

      const row = lookup.recordset[0];
      const resolvedDept = row && (row.host_dept_id || row.emp_dept || row.user_dept) || null;
      if (row && !row.host_dept_id && resolvedDept) {
        await pool2.request()
          .input('prebooking_id', sql.BigInt, id)
          .input('dept_id', sql.BigInt, Number(resolvedDept))
          .query('UPDATE visitor_prebooking SET host_dept_id = @dept_id WHERE prebooking_id = @prebooking_id');
      }
    } catch (e) {
      // non-fatal
      console.warn('Failed to backfill host_dept_id during approval:', e && e.message);
    }

    // notify host user/employee (if present)
    // Safely extract numeric ID (handle comma-separated values)
    const getNumericId = (val) => {
      if (!val) return null;
      const idStr = String(val).trim();
      const cleanId = idStr.split(',')[0].trim();
      const num = Number(cleanId);
      return Number.isFinite(num) && num > 0 ? num : null;
    };
    
    const hostUserId = getNumericId(pre.host_user_id);
    const hostEmpId = getNumericId(pre.host_emp_id);
    const targetHost = hostUserId || hostEmpId || null;
    
    if (targetHost) {
      await notificationModel.createNotification({
        prebooking_id: id,
        target_user_id: targetHost,
        target_role: null,
        type: `PREBOOKING_${newStatus}`,
        message,
      });
    }

      // admin notification — resolve department then try to find a department admin user
      // Fall back to just setting the role if no admin user can be resolved
      let adminUserId = null;
      try {
        // Resolve dept id: prefer pre.host_dept_id, else try host_emp_id -> employee_master.dept_id,
        // else try host_user_id -> user_profile.dept_id
        let deptId = pre.host_dept_id;

        if (!deptId) {
          if (pre.host_emp_id) {
            try {
              const empRes = await pool.request()
                .input('emp_id', sql.BigInt, getNumericId(pre.host_emp_id))
                .query(`SELECT TOP 1 dept_id FROM employee_master WHERE emp_id = @emp_id`);
              if (empRes.recordset && empRes.recordset.length > 0) {
                deptId = empRes.recordset[0].dept_id;
              }
            } catch (er) {
              console.warn('Failed to resolve dept from host_emp_id', er && er.message);
            }
          }
        }

        if (!deptId && pre.host_user_id) {
          try {
            const userRes = await pool.request()
              .input('user_id', sql.BigInt, getNumericId(pre.host_user_id))
              .query(`SELECT TOP 1 dept_id FROM user_profile WHERE user_id = @user_id`);
            if (userRes.recordset && userRes.recordset.length > 0) {
              deptId = userRes.recordset[0].dept_id;
            }
          } catch (er) {
            console.warn('Failed to resolve dept from host_user_id', er && er.message);
          }
        }

        if (deptId) {
          const adminRes = await pool.request()
            .input('dept_id', sql.BigInt, deptId)
            .query(`
              SELECT TOP 1 u.user_id FROM user_profile u
              WHERE u.dept_id = @dept_id AND (u.role = 'ADMIN' OR u.role = 'DEPT_HEAD')
              ORDER BY u.user_id
            `);
          if (adminRes.recordset && adminRes.recordset.length > 0) {
            adminUserId = adminRes.recordset[0].user_id;
          }
        }
      } catch (e) {
        // non-fatal - we still create a role-based notification if lookup fails
        console.warn('Failed to find dept admin for notification', e && e.message);
      }

      await notificationModel.createNotification({
        prebooking_id: id,
        target_user_id: adminUserId || null,
        target_role: adminUserId ? null : 'ADMIN',
        type: `PREBOOKING_${newStatus}`,
        message,
      });

    const io = req.app.get('io');
    if (io) {
      if (targetHost) {
        io.to(`user:${targetHost}`).emit('prebooking:status-changed', {
          prebooking_id: id,
          status: newStatus,
          visit_date: finalDate,
        });
      }

      io.to('role:ADMIN').emit('prebooking:status-changed', {
        prebooking_id: id,
        status: newStatus,
        visit_date: finalDate,
      });
    }

    res.json({ message: `Prebooking ${newStatus.toLowerCase()}`, status: newStatus });
  } catch (err) {
    console.error('Update prebooking status error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getPendingPrebookings(req, res) {
  try {
    const pool = await poolPromise;

    // DEBUG: dekhne ke liye actual req.user kya aa raha hai
    console.log('req.user in getPendingPrebookings = ', req.user);

    // If user is admin, return all pending prebookings. Otherwise return only those
    // assigned to the current user (host_user_id == req.user.user_id)
    const isAdmin = String(req.user?.role || '').toUpperCase() === 'ADMIN';

    let query;
    const request = pool.request();
    if (isAdmin) {
      query = `
        SELECT p.prebooking_id, p.visitor_name, p.visitor_email, p.visit_date, 
               p.time_slot_from, p.time_slot_to, p.host_emp_id, p.host_user_id, 
               u.full_name AS host_user_full_name, p.status, p.created_at
        FROM visitor_prebooking p
        LEFT JOIN user_profile u ON p.host_user_id = u.user_id
        WHERE p.status IS NULL OR p.status = 'PENDING'
        ORDER BY p.created_at DESC
      `;
    } else {
      // restrict to current signed-in user's user_id
      request.input('user_id', sql.BigInt, req.user.user_id);
      query = `
        SELECT p.prebooking_id, p.visitor_name, p.visitor_email, p.visit_date, 
               p.time_slot_from, p.time_slot_to, p.host_emp_id, p.host_user_id, 
               u.full_name AS host_user_full_name, p.status, p.created_at
        FROM visitor_prebooking p
        LEFT JOIN user_profile u ON p.host_user_id = u.user_id
        WHERE (p.status IS NULL OR p.status = 'PENDING')
          AND p.host_user_id = @user_id
        ORDER BY p.created_at DESC
      `;
    }

    const result = await request.query(query);

    res.json(result.recordset || []);
  } catch (err) {
    console.error('Get pending prebookings error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}


module.exports = {
  updatePrebookingStatus,
  getPendingPrebookings,
};
