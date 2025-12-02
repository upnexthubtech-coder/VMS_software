// api/controllers/visitor/dashboardController.js

const { poolPromise } = require('../../config/db');
const sql = require('mssql');

// ---------- TODAY BY DEPARTMENT (for dashboard chart & cards) ----------

async function getTodayDepartmentCounts(req, res) {
  try {
    const pool = await poolPromise;

    const r = await pool.request().query(`
      ;WITH today_data AS (
        SELECT
          r.*,
          COALESCE(r.host_dept_id, e.dept_id, u.dept_id) AS resolved_dept_id,
          COALESCE(e.full_name, u.full_name)             AS resolved_host_name
        FROM dbo.visitor_prebooking_inout_report r
        LEFT JOIN employee_master e ON r.host_emp_id = e.emp_id
        LEFT JOIN user_profile     u ON r.host_user_id = u.user_id
        WHERE CAST(r.visit_date AS DATE) = CAST(GETDATE() AS DATE)
      )
      SELECT
        d.dept_id,
        d.dept_name,
        COUNT(t.prebooking_id) AS visitor_count,
        ISNULL(hosts_list.hosts, '') AS hosts
      FROM department_master d
      LEFT JOIN today_data t ON t.resolved_dept_id = d.dept_id
      OUTER APPLY (
        SELECT STRING_AGG(x.resolved_host_name, ', ') AS hosts
        FROM (
          SELECT DISTINCT resolved_host_name
          FROM today_data
          WHERE resolved_dept_id = d.dept_id
        ) x
      ) hosts_list
      WHERE d.is_active = 1
      GROUP BY d.dept_id, d.dept_name, hosts_list.hosts
      ORDER BY visitor_count DESC, d.dept_name;
    `);

    res.json(r.recordset || []);
  } catch (err) {
    console.error('getTodayDepartmentCounts error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}


// ---------- TODAY VISITORS OF ONE DEPARTMENT (for modal) ----------

async function getTodayDepartmentVisitors(req, res) {
  try {
    const deptId = parseInt(req.params.deptId, 10) || null;
    if (!deptId) {
      return res.status(400).json({ message: 'Invalid department id' });
    }

    const pool = await poolPromise;

    const r = await pool.request()
      .input('dept_id', sql.BigInt, deptId)
      .query(`
        SELECT
          r.*,
          COALESCE(e.full_name, u.full_name) AS host_emp_name,
          u.user_id                          AS host_user_id,
          u.full_name                        AS host_user_full_name,
          COALESCE(d1.dept_name, d2.dept_name) AS host_dept_name,
          -- last action and timestamps from visitor_inout
          (SELECT TOP 1 action_type
             FROM visitor_inout i
             WHERE i.prebooking_id = r.prebooking_id
             ORDER BY checked_at DESC) AS last_action,
          (SELECT TOP 1 checked_at
             FROM visitor_inout i
             WHERE i.prebooking_id = r.prebooking_id
               AND i.action_type = 'CHECK_IN'
             ORDER BY checked_at ASC) AS first_check_in_at,
          (SELECT TOP 1 checked_at
             FROM visitor_inout i
             WHERE i.prebooking_id = r.prebooking_id
               AND i.action_type = 'CHECK_OUT'
             ORDER BY checked_at DESC) AS last_check_out_at,
          (SELECT TOP 1 checked_by_name
             FROM visitor_inout i
             WHERE i.prebooking_id = r.prebooking_id
               AND i.action_type = 'CHECK_IN'
             ORDER BY checked_at ASC) AS check_in_by_name,
          (SELECT TOP 1 checked_by_name
             FROM visitor_inout i
             WHERE i.prebooking_id = r.prebooking_id
               AND i.action_type = 'CHECK_OUT'
             ORDER BY checked_at DESC) AS check_out_by_name
        FROM dbo.visitor_prebooking_inout_report r
        LEFT JOIN employee_master   e  ON r.host_emp_id = e.emp_id
        LEFT JOIN user_profile      u  ON r.host_user_id = u.user_id
        LEFT JOIN department_master d1 ON r.host_dept_id = d1.dept_id
        LEFT JOIN department_master d2 ON COALESCE(e.dept_id, u.dept_id) = d2.dept_id
        WHERE CAST(r.visit_date AS DATE) = CAST(GETDATE() AS DATE)
          AND COALESCE(r.host_dept_id, e.dept_id, u.dept_id) = @dept_id
        ORDER BY r.time_slot_from, r.visit_date;
      `);

    res.json(r.recordset || []);
  } catch (err) {
    console.error('getTodayDepartmentVisitors error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ---------- RECENT NOTIFICATIONS (unchanged) ----------

async function getRecentNotifications(req, res) {
  try {
    const pool = await poolPromise;
    const r = await pool.request().query(`
      SELECT TOP (50)
        n.*,
        p.visitor_name,
        p.visit_date
      FROM visitor_notification n
      LEFT JOIN visitor_prebooking p ON p.prebooking_id = n.prebooking_id
      ORDER BY n.created_at DESC;
    `);
    res.json(r.recordset || []);
  } catch (err) {
    console.error('getRecentNotifications error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// ---------- FULL VISITOR IN/OUT REPORT (your existing code, untouched) ----------

async function getVisitorInoutReport(req, res) {
  try {
    const pool = await poolPromise;

    // filters
    let {
      from_date,
      to_date,
      status,
      host_dept_id,
      host_emp_id,
      visitor_name,
      company_name,
    } = req.query;

    // defaults: last 30 days when not specified
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    from_date = from_date ? new Date(from_date) : thirtyDaysAgo;
    to_date = to_date ? new Date(to_date) : today;

    const fmt = (d) => new Date(d).toISOString().split('T')[0];
    const fromDateStr = fmt(from_date);
    const toDateStr = fmt(to_date);

    let page = parseInt(req.query.page || '1', 10);
    let pageSize = parseInt(req.query.pageSize || '20', 10);
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(pageSize) || pageSize < 1) pageSize = 20;

    const offset = (page - 1) * pageSize;
    const { group } = req.query || {};

    if (group === 'department') {
      let aggSql = `
        SELECT
          COALESCE(r.host_dept_id, e.dept_id, u.dept_id) AS dept_id,
          COALESCE(d.dept_name, '(Unknown)')             AS dept_name,
          COUNT(*)                                       AS visitor_count
        FROM dbo.visitor_prebooking_inout_report r
        LEFT JOIN employee_master   e ON r.host_emp_id = e.emp_id
        LEFT JOIN user_profile      u ON r.host_user_id = u.user_id
        LEFT JOIN department_master d ON COALESCE(r.host_dept_id, e.dept_id, u.dept_id) = d.dept_id
        WHERE r.visit_date BETWEEN @from_date AND @to_date
      `;

      const aggReq = pool.request()
        .input('from_date', sql.Date, fromDateStr)
        .input('to_date', sql.Date, toDateStr);

      if (status && status !== 'all') {
        if (status === 'checked_in') {
          aggSql += ' AND r.check_in_at IS NOT NULL AND r.check_out_at IS NULL';
        } else if (status === 'checked_out') {
          aggSql += ' AND r.check_out_at IS NOT NULL';
        } else if (status === 'not_checked') {
          aggSql += ' AND r.check_in_at IS NULL AND r.check_out_at IS NULL';
        }
      }

      if (visitor_name) {
        aggReq.input('visitor_name', sql.NVarChar(200), `%${visitor_name}%`);
        aggSql += ' AND r.visitor_name LIKE @visitor_name';
      }

      if (company_name) {
        aggReq.input('company_name', sql.NVarChar(200), `%${company_name}%`);
        aggSql += ' AND r.company_name LIKE @company_name';
      }

      aggSql += `
        GROUP BY
          COALESCE(r.host_dept_id, e.dept_id, u.dept_id),
          COALESCE(d.dept_name, '(Unknown)')
        ORDER BY visitor_count DESC, dept_name;
      `;

      const aggRes = await aggReq.query(aggSql);
      return res.json(aggRes.recordset || []);
    }

    // detailed, paginated report (unchanged)
    let sqlText = `
      SELECT
        r.*,
        d.dept_name                     AS host_dept_name,
        COALESCE(e.full_name, u.full_name) AS host_emp_name,
        u.user_id                       AS host_user_id,
        u.full_name                     AS host_user_full_name,
        COUNT(*) OVER()                 AS total_count
      FROM dbo.visitor_prebooking_inout_report r
      LEFT JOIN department_master d ON r.host_dept_id = d.dept_id
      LEFT JOIN employee_master  e ON r.host_emp_id  = e.emp_id
      LEFT JOIN user_profile     u ON r.host_user_id = u.user_id
      WHERE r.visit_date BETWEEN @from_date AND @to_date
    `;

    const request = pool.request()
      .input('from_date', sql.Date, fromDateStr)
      .input('to_date', sql.Date, toDateStr);

    if (status && status !== 'all') {
      if (status === 'checked_in') {
        sqlText += ' AND r.check_in_at IS NOT NULL AND r.check_out_at IS NULL';
      } else if (status === 'checked_out') {
        sqlText += ' AND r.check_out_at IS NOT NULL';
      } else if (status === 'not_checked') {
        sqlText += ' AND r.check_in_at IS NULL AND r.check_out_at IS NULL';
      }
    }

    if (host_dept_id) {
      request.input('host_dept_id', sql.BigInt, parseInt(host_dept_id, 10));
      sqlText += ' AND r.host_dept_id = @host_dept_id';
    }

    if (host_emp_id) {
      request.input('host_emp_id', sql.BigInt, parseInt(host_emp_id, 10));
      sqlText += ' AND r.host_emp_id = @host_emp_id';
    }

    if (visitor_name) {
      request.input('visitor_name', sql.NVarChar(200), `%${visitor_name}%`);
      sqlText += ' AND r.visitor_name LIKE @visitor_name';
    }

    if (company_name) {
      request.input('company_name', sql.NVarChar(200), `%${company_name}%`);
      sqlText += ' AND r.company_name LIKE @company_name';
    }

    sqlText += ' ORDER BY r.visit_date DESC, r.time_slot_from, r.check_in_at';
    sqlText += ' OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY';

    request.input('offset', sql.Int, offset).input('pageSize', sql.Int, pageSize);

    const result = await request.query(sqlText);
    const rows = result.recordset || [];
    const total = rows.length ? rows[0].total_count || 0 : 0;

    res.json({ rows, total_count: total, page, pageSize });
  } catch (err) {
    console.error('getVisitorInoutReport error', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  getTodayDepartmentCounts,
  getTodayDepartmentVisitors,
  getRecentNotifications,
  getVisitorInoutReport,
};
