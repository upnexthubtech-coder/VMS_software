const express = require('express');
const router = express.Router();
const departmentController = require('../../controllers/department/departmentController');
const { requireAuth } = require('../../middleware/authMiddleware');

// protect department routes
router.use(requireAuth);

router.get('/', departmentController.getAllDepartments);
router.get('/:id', departmentController.getDepartment);
router.post('/', departmentController.createDepartment);
router.put('/:id', departmentController.updateDepartment);
router.delete('/:id', departmentController.deleteDepartment);

module.exports = router;
