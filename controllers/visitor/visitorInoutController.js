const { poolPromise } = require('../../config/db');
const sql = require('mssql');
const { createNotification } = require('../../models/visitor/visitorNotificationModel');
const { getPrebookingById } = require('../../models/visitor/visitorPrebookingModel');

async function createInoutRecord(req, res) {
  try {
    const {
      prebooking_id,
      gatepass_id,
      qr_data,
      visitor_name,
      visitor_email,
      visitor_phone,
      company_name,
      action_type, // 'CHECK_IN' | 'CHECK_OUT' | 'RETURN'
      checked_by_emp_id,
      checked_by_name,
      ppe_issued,
      devices_issued,
      vehicle_info,
      notes,
    } = req.body;

    if (!action_type || !['CHECK_IN', 'CHECK_OUT', 'RETURN'].includes(action_type)) {
      return res.status(400).json({ message: 'Invalid action_type' });
    }

    if (!gatepass_id) {
      return res.status(400).json({ message: 'gatepass_id is required' });
    }

    const pool = await poolPromise;

    // Fetch the most recent visitor_inout record for the same visitor and gatepass_id
    const lastRecordResult = await pool.request()
      .input('gatepass_id', sql.BigInt, gatepass_id)
      .input('visitor_phone', sql.NVarChar(50), visitor_phone || null)
      .input('visitor_email', sql.NVarChar(200), visitor_email || null)
      .query(`
        SELECT TOP 1 action_type FROM visitor_inout 
        WHERE gatepass_id = @gatepass_id 
          AND (visitor_phone = @visitor_phone OR visitor_email = @visitor_email)
        ORDER BY checked_at DESC
      `);
    
    const lastActionType = lastRecordResult.recordset.length > 0 ? lastRecordResult.recordset[0].action_type : null;

    // Logic for validation
    if (action_type === 'CHECK_IN' || action_type === 'CHECK_OUT') {
      if (lastActionType === 'CHECK_IN' && action_type === 'CHECK_IN') {
        return res.status(400).json({ message: 'Visitor is already checked in with this gatepass_id' });
      }
      if (lastActionType === 'CHECK_OUT') {
        // Visitor has already checked out; block any further check-in or check-out with the same gatepass_id
        return res.status(400).json({ message: 'Visitor has already checked out with this gatepass_id. No further in/out allowed.' });
      }
    }
    // 'RETURN' action allowed anytime

    // Insert new inout record
    const r = await pool.request()
      .input('prebooking_id', sql.BigInt, prebooking_id || null)
      .input('gatepass_id', sql.BigInt, gatepass_id)
      .input('qr_data', sql.NVarChar(2000), qr_data || null)
      .input('visitor_name', sql.NVarChar(150), visitor_name || null)
      .input('visitor_email', sql.NVarChar(200), visitor_email || null)
      .input('visitor_phone', sql.NVarChar(50), visitor_phone || null)
      .input('company_name', sql.NVarChar(200), company_name || null)
      .input('action_type', sql.VarChar(20), action_type)
      .input('checked_by_emp_id', sql.BigInt, checked_by_emp_id || null)
      .input('checked_by_name', sql.NVarChar(150), checked_by_name || null)
      .input('ppe_issued', sql.NVarChar(500), ppe_issued || null)
      .input('devices_issued', sql.NVarChar(500), devices_issued || null)
      .input('vehicle_info', sql.NVarChar(500), vehicle_info || null)
      .input('notes', sql.NVarChar(1000), notes || null)
      .query(`
        INSERT INTO visitor_inout (prebooking_id, gatepass_id, qr_data, visitor_name, visitor_email, visitor_phone, company_name, action_type, checked_by_emp_id, checked_by_name, ppe_issued, devices_issued, vehicle_info, notes)
        OUTPUT INSERTED.inout_id
        VALUES (@prebooking_id, @gatepass_id, @qr_data, @visitor_name, @visitor_email, @visitor_phone, @company_name, @action_type, @checked_by_emp_id, @checked_by_name, @ppe_issued, @devices_issued, @vehicle_info, @notes)
      `);

    // If this is a CHECK_IN create a notification for the host and emit real-time event
    try {
      if (action_type === 'CHECK_IN' && prebooking_id) {
        // try to load prebooking to find host
        const prebooking = await getPrebookingById(prebooking_id);
        const hostId = prebooking && (prebooking.host_user_id || prebooking.host_emp_id) ? (prebooking.host_user_id || prebooking.host_emp_id) : null;
        const message = `${visitor_name || 'A visitor'} has checked in for ${prebooking ? prebooking.purpose || 'a visit' : 'a visit'}`;
        // create notification (target_user_id will be hostId when available)
        const notif = await createNotification({ prebooking_id, target_user_id: hostId, target_role: hostId ? null : 'reception', type: 'CHECK_IN', message });

        // emit via socket.io — notify host and role rooms
        try {
          const io = req.app.get('io');
          if (io) {
            if (hostId) io.to(`user:${hostId}`).emit('visitor_checkin', notif);
            io.to('role:reception').emit('visitor_checkin', notif);
          }
        } catch (e) {
          console.warn('failed to emit socket for new checkin', e);
        }
      }
    } catch (err) {
      // don't block response on notification errors
      console.warn('notification creation failed', err);
    }

    res.status(201).json({ inout_id: r.recordset[0].inout_id });
  } catch (err) {
    console.error('createInoutRecord error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function listRecentInouts(req, res) {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT TOP (200) * FROM visitor_inout ORDER BY checked_at DESC
    `);
    res.json(result.recordset || []);
  } catch (err) {
    console.error('listRecentInouts error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getInoutByGatepass(req, res) {
  try {
    const { gatepass_id } = req.query;

    if (!gatepass_id) {
      return res.status(400).json({ message: 'gatepass_id is required' });
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input('gatepass_id', sql.BigInt, gatepass_id)
      .query(`
        SELECT TOP 1 
          inout_id, gatepass_id, action_type, checked_at, 
          ppe_issued, devices_issued, vehicle_info, notes,
          visitor_name, visitor_email, visitor_phone, company_name,
          checked_by_emp_id, checked_by_name
        FROM visitor_inout
        WHERE gatepass_id = @gatepass_id AND action_type = 'CHECK_IN'
        ORDER BY checked_at DESC
      `);

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({ message: 'No check-in record found for this gatepass' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error('getInoutByGatepass error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  createInoutRecord,
  listRecentInouts,
  getInoutByGatepass,
};
