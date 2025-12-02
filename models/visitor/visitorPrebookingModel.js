// models/visitor/visitorPrebookingModel.js
// models/visitor/visitorPrebookingModel.js
const { poolPromise } = require('d:/sne_applicatoin2/visitor_mangmant_system/API/config/db.js');
const sql = require('mssql');

async function createPrebooking(prebookingData, belongings = []) {
  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);

  await tx.begin();

  try {
    const request = new sql.Request(tx);

    // normalize incoming time values into SQL-compatible `HH:MM:SS`
    const normalizeTime = (val) => {
      if (val === null || val === undefined) return null;
      if (val instanceof Date) {
        // convert Date -> HH:MM:SS
        const hh = String(val.getHours()).padStart(2, '0');
        const mm = String(val.getMinutes()).padStart(2, '0');
        const ss = String(val.getSeconds()).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
      }
      if (typeof val === 'string') {
        const s = val.trim();
        // Accept formats like 'H:MM', 'HH:MM', 'HH:MM:SS', with optional fractional seconds
        const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
        if (!m) return null; // invalid format — will be treated as null
        const hh = m[1].padStart(2, '0');
        const mm = m[2];
        const ss = m[3] ? m[3] : '00';
        return `${hh}:${mm}:${ss}`;
      }
      // unsupported type
      return null;
    };

    // normalize times: empty string → null, ensure seconds present (only time_slot_from now)
    const rawTimeFrom = prebookingData.time_slot_from;
    const timeFrom = normalizeTime(rawTimeFrom);

    // helpful debug if a caller supplied an unparseable time (avoid silent drop)
    if (rawTimeFrom && timeFrom === null) {
      console.warn('visitorPrebookingModel.createPrebooking: received invalid check-in time', {
        rawTimeFrom,
        normalizedFrom: timeFrom,
      });
    }

    request
      .input('invite_id',        sql.BigInt,        prebookingData.invite_id || null)
      .input('visitor_name',     sql.NVarChar(150), prebookingData.visitor_name)
      .input('visitor_email',    sql.NVarChar(200), prebookingData.visitor_email)
      .input('visitor_phone',    sql.NVarChar(20),  prebookingData.visitor_phone || null)
      .input('company_name',     sql.NVarChar(200), prebookingData.company_name || null)
      .input('purpose',          sql.NVarChar(500), prebookingData.purpose)
      .input('visit_date',       sql.Date,          prebookingData.visit_date)
      .input('host_emp_id',      sql.BigInt,        prebookingData.host_emp_id || null)
      .input('host_user_id',     sql.BigInt,        prebookingData.host_user_id || null)
      .input('host_dept_id',     sql.BigInt,        prebookingData.host_dept_id || null)
      .input('visitor_photo_url',sql.NVarChar(500), prebookingData.visitor_photo_url || null)
      .input('created_ip',       sql.VarChar(50),   prebookingData.created_ip || null);

    // use normalized values (or null). Convert to a JS Date when possible and bind as sql.Time(0)
    const toTimeDate = (t) => {
      if (t === null) return null;
      if (t instanceof Date) return t;
      if (typeof t === 'string') {
        const m = t.match(/^(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
        if (!m) return null;
        const hh = Number(m[1]);
        const mm = Number(m[2]);
        const ss = Number(m[3]);
        // construct a Date on epoch day — time-only is used by driver
        return new Date(Date.UTC(1970, 0, 1, hh, mm, ss));
      }
      return null;
    };

    const timeFromVal = toTimeDate(timeFrom);

    // bind using scale 0 to match DB time(0)
    request.input('time_slot_from', sql.Time(0), timeFromVal);

    const result = await request.query(`
      INSERT INTO visitor_prebooking (
        invite_id, visitor_name, visitor_email, visitor_phone, company_name,
        purpose, visit_date, time_slot_from,
        host_emp_id, host_user_id, host_dept_id, visitor_photo_url, created_ip
      )
      OUTPUT INSERTED.prebooking_id
      VALUES (
        @invite_id, @visitor_name, @visitor_email, @visitor_phone, @company_name,
        @purpose, @visit_date, @time_slot_from,
        @host_emp_id, @host_user_id, @host_dept_id, @visitor_photo_url, @created_ip
      )
    `);

    const prebooking_id = result.recordset[0].prebooking_id;

    for (const b of belongings || []) {
      if (!b.item_name) continue;
      await new sql.Request(tx)
        .input('prebooking_id', sql.BigInt, prebooking_id)
        .input('item_name',     sql.NVarChar(100), b.item_name)
        .input('description',   sql.NVarChar(200), b.description || null)
        .input('quantity',      sql.Int,          b.quantity || 1)
        .query(`
          INSERT INTO visitor_belonging (prebooking_id, item_name, description, quantity)
          VALUES (@prebooking_id, @item_name, @description, @quantity)
        `);
    }

    await tx.commit();
    return prebooking_id;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}




async function getPrebookingById(prebooking_id) {
  const pool = await poolPromise;

  const headerRes = await pool.request()
    .input('prebooking_id', sql.BigInt, prebooking_id)
    .query(`
      SELECT p.*,
             e.full_name AS host_emp_name,
             e.email AS host_emp_email,
             e.dept_id AS host_emp_dept_id,
             d1.dept_name AS host_emp_dept_name,
             u.user_id AS host_user_id,
             u.full_name AS host_user_full_name,
             u.email AS host_user_email,
             u.dept_id AS host_user_dept_id,
             d2.dept_name AS host_user_dept_name
      FROM visitor_prebooking p
      LEFT JOIN employee_master e ON p.host_emp_id = e.emp_id
      LEFT JOIN department_master d1 ON e.dept_id = d1.dept_id
      LEFT JOIN user_profile u ON p.host_user_id = u.user_id
      LEFT JOIN department_master d2 ON u.dept_id = d2.dept_id
      WHERE p.prebooking_id = @prebooking_id
    `);

  if (!headerRes.recordset[0]) return null;

  const belongingsRes = await pool.request()
    .input('prebooking_id', sql.BigInt, prebooking_id)
    .query(`
      SELECT * FROM visitor_belonging WHERE prebooking_id = @prebooking_id
    `);

  // normalize host name: prefer user_profile name when present, else employee name
  const header = headerRes.recordset[0];
  const hostName = header.host_user_full_name || header.host_name || null;

  return {
    ...header,
    host_name: hostName,
    belongings: belongingsRes.recordset,
  };
}

module.exports = {
  createPrebooking,
  getPrebookingById,
};
