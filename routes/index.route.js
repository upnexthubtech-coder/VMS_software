const express = require('express');
const router = express.Router();

const loginRoutes = require('./login/login.route.js');
const forgotPasswordRoutes = require('./login/forgotPassword.route.js');
const debugRoutes = require('./debug.route.js');
const departmentRoutes = require('./department/department.route.js'); // Add this line
const employeeRoutes = require('./employee/employee.route.js'); // Add this line

const visitorInviteRoutes = require('./visitor/visitorInviteRoutes.js');
const visitorDashboardRoutes = require('./visitor/visitorDashboardRoutes.js');
const visitorPrebookingRoutes = require('./visitor/visitorPrebookingRoutes.js');
const visitorInoutRoutes = require('./visitor/visitorInoutRoutes.js');
const visitorGatepassRoutes = require('./visitor/visitorGatepassRoutes.js');
const filesRoutes = require('./files.route.js');
const userProfileRoutes = require('./user/userProfileRoutes.js');
const visitorApprovalRoutes = require('./visitor/visitorApprovalRoutes');

router.use('/login', loginRoutes);
router.use('/login', forgotPasswordRoutes);
// Temporary debug routes
router.use('/debug', debugRoutes);

// Add routes for departments and employees
router.use('/departments', departmentRoutes);
router.use('/employees', employeeRoutes);

router.use('/visitor', visitorInviteRoutes);
router.use('/visitor', visitorDashboardRoutes);
router.use('/visitor', visitorPrebookingRoutes);
router.use('/visitor', visitorApprovalRoutes);
router.use('/visitor', visitorInoutRoutes);
router.use('/visitor', visitorGatepassRoutes);
router.use('/files', filesRoutes);
router.use('/users', userProfileRoutes);

module.exports = router;
