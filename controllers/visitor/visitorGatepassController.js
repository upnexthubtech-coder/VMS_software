const { poolPromise } = require('../../config/db');
const sql = require('mssql');

async function getGatepassByPrebooking(req, res) {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    const r = await pool.request()
      .input('prebooking_id', sql.BigInt, id)
      .query(`SELECT * FROM visitor_gatepass WHERE prebooking_id = @prebooking_id`);

    if (!r.recordset[0]) return res.status(404).json({ message: 'Gatepass not found' });

    res.json(r.recordset[0]);
  } catch (err) {
    console.error('getGatepassByPrebooking', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getGatepassByCode(req, res) {
  try {
    const { code } = req.params;
    const pool = await poolPromise;
    const r = await pool.request()
      .input('gatepass_code', sql.VarChar(100), code)
      .query(`SELECT * FROM visitor_gatepass WHERE gatepass_code = @gatepass_code`);

    if (!r.recordset[0]) return res.status(404).json({ message: 'Gatepass not found' });

    res.json(r.recordset[0]);
  } catch (err) {
    console.error('getGatepassByCode', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getGatepassByPrebooking, getGatepassByCode };
