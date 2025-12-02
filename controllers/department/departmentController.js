const departmentModel = require('../../models/department/departmentModel');

async function getAllDepartments(req, res) {
  try {
    const departments = await departmentModel.getAllDepartments();
    res.json(departments);
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getDepartment(req, res) {
  try {
    const deptId = req.params.id;
    const department = await departmentModel.getDepartmentById(deptId);
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }
    res.json(department);
  } catch (error) {
    console.error('Get department error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function createDepartment(req, res) {
  try {
    const deptData = req.body;
    const newDeptId = await departmentModel.createDepartment(deptData);
    res.status(201).json({ message: 'Department created', dept_id: newDeptId });
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateDepartment(req, res) {
  try {
    const deptId = req.params.id;
    const deptData = req.body;
    await departmentModel.updateDepartment(deptId, deptData);
    res.json({ message: 'Department updated successfully' });
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function deleteDepartment(req, res) {
  try {
    const deptId = req.params.id;
    await departmentModel.deleteDepartment(deptId);
    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  getAllDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment
};
