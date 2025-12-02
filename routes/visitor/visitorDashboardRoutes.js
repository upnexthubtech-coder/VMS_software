const express = require('express');
const router = express.Router();
const dashboardController = require('../../controllers/visitor/visitorDashboardController');
const { requireAuth } = require('../../middleware/authMiddleware');

// GET /api/visitor/dashboard/today/department-counts
router.get('/dashboard/today/department-counts', requireAuth, dashboardController.getTodayDepartmentCounts);

// GET /api/visitor/dashboard/today/department/:deptId/visitors
router.get('/dashboard/today/department/:deptId/visitors', requireAuth, dashboardController.getTodayDepartmentVisitors);

// GET /api/visitor/notifications/recent
router.get('/notifications/recent', requireAuth, dashboardController.getRecentNotifications);

// GET /api/visitor/report/inout?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD&status=all|checked_in|checked_out|not_checked
router.get('/report/inout', requireAuth, dashboardController.getVisitorInoutReport);

module.exports = router;
