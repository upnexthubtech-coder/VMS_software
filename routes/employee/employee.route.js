const express = require('express');
const router = express.Router();
const employeeController = require('../../controllers/employee/employeeController.js');
const { requireAuth } = require('../../middleware/authMiddleware');

// protect all employee endpoints
router.use(requireAuth);

router.get('/', employeeController.getAllEmployees);
// departments dropdown must be before the :id route (otherwise 'departments-dropdown' gets treated as id)
router.get('/departments-dropdown', employeeController.getDepartmentsDropdown);

router.get('/:id', employeeController.getEmployee);
router.post('/', employeeController.createEmployee);
router.put('/:id', employeeController.updateEmployee);
router.delete('/:id', employeeController.deleteEmployee);

module.exports = router;
