const { poolPromise, sql } = require('d:/sne_applicatoin2/visitor_mangmant_system/API/config/db.js');



async function getAllEmployees() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT e.*, d.dept_name 
    FROM employee_master e 
    LEFT JOIN department_master d ON e.dept_id = d.dept_id 
    WHERE e.is_active = 1
    ORDER BY e.full_name
  `);
  return result.recordset;
}

async function getEmployeeById(empId) {
  const pool = await poolPromise;
  const result = await pool.request()
    // ensure SQL gets a BigInt parameter (emp_id is bigint in DB)
    .input('emp_id', sql.BigInt, Number(empId))
    .query(`
      SELECT e.*, d.dept_name 
      FROM employee_master e 
      LEFT JOIN department_master d ON e.dept_id = d.dept_id 
      WHERE e.emp_id = @emp_id
    `);
  return result.recordset[0] || null;
}

async function createEmployee(empData) {
  const pool = await poolPromise;
  // defensive normalization — avoid passing undefined / objects / NaN to mssql driver
  const normalizeBigInt = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  };

  const deptVal = normalizeBigInt(empData.dept_id);
  const reportingToVal = normalizeBigInt(empData.reporting_to);

  console.debug('employeeModel.createEmployee params normalized', { emp_code: empData.emp_code, deptVal, reportingToVal });

  const result = await pool.request()
    .input('emp_code', empData.emp_code)
    .input('full_name', empData.full_name)
    .input('email', empData.email)
    .input('phone', empData.phone || null)
    // dept_id is bigint in the DB — convert if present, otherwise NULL
    .input('designation', empData.designation || null)
    // let the driver infer the type for numeric values (avoids cross-instance type issues)
    .input('dept_id', deptVal)
    .input('reporting_to', reportingToVal)
    .query(`
      INSERT INTO employee_master (emp_code, full_name, email, phone, dept_id, designation, reporting_to)
      OUTPUT INSERTED.emp_id
      VALUES (@emp_code, @full_name, @email, @phone, @dept_id, @designation, @reporting_to)
    `);
  return result.recordset[0].emp_id;
}

async function updateEmployee(empId, empData) {
  const pool = await poolPromise;
  const normalizeBigInt = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  };

  const deptVal = normalizeBigInt(empData.dept_id);
  const reportingToVal = normalizeBigInt(empData.reporting_to);

  console.debug('employeeModel.updateEmployee params normalized', { empId, deptVal, reportingToVal });

  await pool.request()
    .input('emp_id', sql.BigInt, Number(empId))
    .input('emp_code', empData.emp_code)
    .input('full_name', empData.full_name)
    .input('email', empData.email)
    .input('phone', empData.phone || null)
    .input('designation', empData.designation || null)
    .input('dept_id', deptVal)   
    .input('reporting_to', reportingToVal)
    .query(`
      UPDATE employee_master 
      SET emp_code = @emp_code, full_name = @full_name, email = @email, 
          phone = @phone, dept_id = @dept_id, designation = @designation, 
          reporting_to = @reporting_to
      WHERE emp_id = @emp_id
    `);
}
async function deleteEmployee(empId) {
  const pool = await poolPromise;
  await pool.request()
    // emp_id is a bigint in the DB — pass as BigInt
    .input('emp_id', sql.BigInt, Number(empId))
    .query('UPDATE employee_master SET is_active = 0 WHERE emp_id = @emp_id');
}

async function getDepartmentsForDropdown() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT dept_id, dept_name FROM department_master WHERE is_active = 1
  `);
  return result.recordset;
}

module.exports = {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getDepartmentsForDropdown
};
