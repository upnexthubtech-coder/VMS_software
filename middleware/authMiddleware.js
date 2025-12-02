const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

function requireAuth(req, res, next) {
  try {
    // token expected in httpOnly cookie named 'auth_token'
    const token = req.cookies && req.cookies.auth_token;
    if (!token) return res.status(401).json({ message: 'Authentication required' });

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    console.error('Auth failed:', err.message || err);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// Authorize actions on a prebooking resource: only ADMIN or the host_user_id may proceed
async function authorizePrebookingHostOrAdmin(req, res, next) {
  try {
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });

    // Lazy-require DB to avoid circular imports at module load
    const { poolPromise } = require('../config/db');
    const sql = require('mssql');
    const pool = await poolPromise;

    const id = req.params.id;
    if (!id) return res.status(400).json({ message: 'Missing prebooking id' });

    const r = await pool.request()
      .input('prebooking_id', sql.BigInt, id)
      .query('SELECT host_user_id, host_emp_id FROM visitor_prebooking WHERE prebooking_id = @prebooking_id');

    const rec = r.recordset && r.recordset[0];
    if (!rec) return res.status(404).json({ message: 'Prebooking not found' });

    // Admins may act on any prebooking
    if (String(req.user.role).toUpperCase() === 'ADMIN') return next();

    // Only the assigned host (user id) may approve/reject
    if (rec.host_user_id && String(rec.host_user_id) === String(req.user.user_id)) return next();

    // otherwise forbidden
    return res.status(403).json({ message: 'Not authorized to modify this prebooking' });
  } catch (err) {
    console.error('authorizePrebookingHostOrAdmin error:', err);
    return res.status(500).json({ message: 'Authorization check failed' });
  }
}

module.exports = { requireAuth, authorizePrebookingHostOrAdmin };
