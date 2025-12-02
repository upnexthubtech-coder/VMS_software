const employeeModel = require('../../models/employee/employeeModel.js');

async function getAllEmployees(req, res) {
  try {
    const employees = await employeeModel.getAllEmployees();
    res.json(employees);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getEmployee(req, res) {
  try {
    const empId = req.params.id;
    // validate id is numeric
    if (!/^[0-9]+$/.test(String(empId))) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }
    const employee = await employeeModel.getEmployeeById(empId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    res.json(employee);
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

const { hashPassword } = require('../../utils/login/hashPassword');
const loginUserModel = require('../../models/login/userModel.js');
const userProfileModel = require('../../models/user/userProfileModel.js');
const { poolPromise, sql } = require('../../config/db');
const { mapDesignationToRole, ALLOWED_ROLES } = require('../../config/roles.js');

async function createEmployee(req, res) {
  try {
    const empData = req.body;

    if (!empData.emp_code || !empData.full_name || !empData.email) {
      return res.status(400).json({ message: 'Missing required fields: emp_code, full_name, email' });
    }

    if (empData.dept_id && !/^[0-9]+$/.test(String(empData.dept_id))) {
      return res.status(400).json({ message: 'dept_id must be numeric' });
    }

    if (empData.reporting_to && !/^[0-9]+$/.test(String(empData.reporting_to))) {
      return res.status(400).json({ message: 'reporting_to must be numeric' });
    }

    const userCode = empData.emp_code;
    const existingByCode = await loginUserModel.findUserByUserCode(userCode);
    const existingByEmail = empData.email ? await loginUserModel.findUserByEmail(empData.email) : null;

    let newEmpId;

    // =========================================
    //   CREATE BOTH EMPLOYEE + USER IF NOT EXISTS
    // =========================================
    if (!existingByCode && !existingByEmail) {
      // Prefer using the designation as the role token if it already matches
      // one of the allowed DB tokens. Otherwise fall back to the mapping helper.
      let roleToSave = null;
      if (empData.designation) {
        const candidate = String(empData.designation).trim().toLowerCase();
        if (Array.isArray(ALLOWED_ROLES) && ALLOWED_ROLES.includes(candidate)) {
          // store canonical lower-case token for later normalization
          roleToSave = candidate;
        } else {
          roleToSave = mapDesignationToRole(empData.designation);
        }
      }

      const normalizeBigInt = (val) => {
        if (!val) return null;
        const n = Number(val);
        return Number.isFinite(n) ? n : null;
      };

      const deptVal = normalizeBigInt(empData.dept_id);
      const reportingToVal = normalizeBigInt(empData.reporting_to);

      const pool = await poolPromise;

      // DEBUG: log incoming designation and chosen role token so we can
      // diagnose cases where database ends up receiving NULL for role.
      console.debug('createEmployee: incoming designation ->', empData.designation, 'computed roleToSave ->', roleToSave);
      const transaction = new sql.Transaction(pool);

      try {
        await transaction.begin();

        // INSERT INTO employee_master
        const empReq = transaction.request()
          .input('emp_code', empData.emp_code)
          .input('full_name', empData.full_name)
          .input('email', empData.email)
          .input('phone', empData.phone || null)
          .input('designation', empData.designation || null)
          .input('dept_id', deptVal)
          .input('reporting_to', reportingToVal);

        const empRes = await empReq.query(`
          INSERT INTO employee_master (emp_code, full_name, email, phone, dept_id, designation, reporting_to)
          OUTPUT INSERTED.emp_id
          VALUES (@emp_code, @full_name, @email, @phone, @dept_id, @designation, @reporting_to)
        `);

        newEmpId = empRes.recordset[0].emp_id;

        // USER PROFILE CREATE
        const hashed = await hashPassword(String(userCode));
        const userReq = transaction.request()
          .input('user_code', userCode)
          .input('full_name', empData.full_name)
          .input('email', empData.email)
          // Normalize for DB: the schema expects specific tokens (CHECK constraints)
          // — convert to uppercase (e.g. 'user' -> 'USER'). If we still can't
          // resolve a known token, fall back to 'USER' as a safe default from the
          // allowed set to avoid CHECK/NULL failures.
            .input('role', (roleToSave ? String(roleToSave).toUpperCase() : 'USER'))
          .input('designation', empData.designation)
          .input('dept_id', deptVal)
          .input('password_hash', hashed);

        await userReq.query(`
          INSERT INTO user_profile (user_code, full_name, email, role, designation, dept_id, password_hash)
          VALUES (@user_code, @full_name, @email, @role, @designation, @dept_id, @password_hash)
        `);

        await transaction.commit();
      } catch (e) {
        await transaction.rollback();
        console.error('Create employee transaction failed:', e && e.message, e && e.info ? e.info.message : '');
        throw e;
      }

    } 
    // =========================================
    //    USER ALREADY EXISTS → ONLY EMPLOYEE ENTRY
    // =========================================
    else {
      newEmpId = await employeeModel.createEmployee(empData);

      // If a user_profile already exists for this employee, update their profile
      // so the dashboard / prebooking logic can see dept_id and latest name/email
      const userToUpdate = existingByCode || existingByEmail || null;
      if (userToUpdate) {
        try {
          const pool2 = await poolPromise;
          await pool2.request()
            .input('user_id', sql.BigInt, Number(userToUpdate.user_id))
            .input('full_name', empData.full_name || userToUpdate.full_name || null)
            .input('email', empData.email || userToUpdate.email || null)
            .input('designation', empData.designation || userToUpdate.designation || null)
            .input('dept_id', sql.BigInt, deptVal)
            .query(`
              UPDATE user_profile
              SET full_name = @full_name,
                  email = @email,
                  designation = @designation,
                  dept_id = @dept_id
              WHERE user_id = @user_id
            `);
        } catch (e) {
          // Non-fatal: log but don't fail employee creation if profile update fails
          console.warn('Failed to update existing user_profile with department:', e && e.message);
        }
      }
    }

    return res.status(201).json({ message: 'Employee created', emp_id: newEmpId });

  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}


async function updateEmployee(req, res) {
  try {
    const empId = req.params.id;
    if (!/^[0-9]+$/.test(String(empId))) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }
    const empData = req.body;
    // if dept_id provided, ensure numeric
    if (empData.dept_id && !/^[0-9]+$/.test(String(empData.dept_id))) {
      return res.status(400).json({ message: 'dept_id must be a numeric id' });
    }
    if (empData.reporting_to && !/^[0-9]+$/.test(String(empData.reporting_to))) {
      return res.status(400).json({ message: 'reporting_to must be a numeric id' });
    }
    await employeeModel.updateEmployee(empId, empData);

    // Also update the corresponding user_profile (if any) so dashboard/approvers stay in sync
    try {
      // get employee to resolve emp_code -> user_code
      const emp = await employeeModel.getEmployeeById(empId);
      if (emp && emp.emp_code) {
        const pool2 = await poolPromise;

        // only update fields that were present in the request body
        // Determine role value from incoming designation (if any)
        let roleForUpdate = null;
        if (empData.designation) {
          const cand = String(empData.designation).trim().toLowerCase();
          if (Array.isArray(ALLOWED_ROLES) && ALLOWED_ROLES.includes(cand)) {
            roleForUpdate = cand;
          } else {
            roleForUpdate = mapDesignationToRole(empData.designation);
          }
        }

        // normalize to uppercase token to satisfy DB constraints
        const inputs = pool2.request()
          .input('user_code', emp.emp_code)
          .input('full_name', empData.full_name || null)
          .input('email', empData.email || null)
          .input('designation', empData.designation || null)
          .input('dept_id', empData.dept_id != null ? Number(empData.dept_id) : null)
          .input('role', roleForUpdate ? String(roleForUpdate).toUpperCase() : null);

        // we use a simple update — if a field is null in the payload we won't overwrite existing non-null values
        // so build SQL to update only provided fields
        const updates = [];
        if (empData.full_name) updates.push('full_name = @full_name');
        if (empData.email) updates.push('email = @email');
        if (empData.designation) updates.push('designation = @designation');
        if (roleForUpdate) updates.push('role = @role');
        if (empData.dept_id !== undefined) updates.push('dept_id = @dept_id');

        if (updates.length > 0) {
          const query = `UPDATE user_profile SET ${updates.join(', ')} WHERE user_code = @user_code`;
          await inputs.query(query);
        }
      }
    } catch (e) {
      console.warn('Failed to update user_profile during employee update:', e && e.message);
    }
    res.json({ message: 'Employee updated successfully' });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function deleteEmployee(req, res) {
  try {
    const empId = req.params.id;
    if (!/^[0-9]+$/.test(String(empId))) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }
    await employeeModel.deleteEmployee(empId);
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getDepartmentsDropdown(req, res) {
  try {
    const departments = await employeeModel.getDepartmentsForDropdown();
    res.json(departments);
  } catch (error) {
    console.error('Get departments dropdown error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  getAllEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getDepartmentsDropdown
};
