const { poolPromise, sql } = require('../../config/db');

async function getAllDepartments() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT d.*, e.full_name as dept_head_name 
    FROM department_master d 
    LEFT JOIN employee_master e ON d.dept_head_user_id = e.emp_id 
    WHERE d.is_active = 1
    ORDER BY d.dept_name
  `);
  return result.recordset;
}

async function getDepartmentById(deptId) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('dept_id', sql.BigInt, deptId != null ? Number(deptId) : null)
    .query(`
      SELECT d.*, e.full_name as dept_head_name 
      FROM department_master d 
      LEFT JOIN employee_master e ON d.dept_head_user_id = e.emp_id 
      WHERE d.dept_id = @dept_id
    `);
  return result.recordset[0] || null;
}

async function createDepartment(deptData) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('dept_code', deptData.dept_code)
    .input('dept_name', deptData.dept_name)
    .input('dept_head_user_id', deptData.dept_head_user_id || null)
    .query(`
      INSERT INTO department_master (dept_code, dept_name, dept_head_user_id)
      OUTPUT INSERTED.dept_id
      VALUES (@dept_code, @dept_name, @dept_head_user_id)
    `);
  return result.recordset[0].dept_id;
}

async function updateDepartment(deptId, deptData) {
  const pool = await poolPromise;
  await pool.request()
    .input('dept_id', sql.BigInt, deptId != null ? Number(deptId) : null)
    .input('dept_code', deptData.dept_code)
    .input('dept_name', deptData.dept_name)
    .input('dept_head_user_id', deptData.dept_head_user_id || null)
    .query(`
      UPDATE department_master 
      SET dept_code = @dept_code, dept_name = @dept_name, dept_head_user_id = @dept_head_user_id
      WHERE dept_id = @dept_id
    `);
}

async function deleteDepartment(deptId) {
  const pool = await poolPromise;
  await pool.request()
    .input('dept_id', sql.BigInt, deptId != null ? Number(deptId) : null)
    .query('UPDATE department_master SET is_active = 0 WHERE dept_id = @dept_id');
}

module.exports = {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment
};
