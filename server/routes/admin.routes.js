const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate, requireAdmin);

router.get('/metrics', adminController.getMetrics);
router.get('/reports', adminController.getReports);
router.put('/reports/:id', adminController.updateReportStatus);
router.post('/remove-content', adminController.removeContent);
router.put('/users/:id/status', adminController.toggleUserStatus);
router.put('/users/:id/verify', adminController.verifyUser);
router.get('/audit-logs', adminController.getAuditLogs);

module.exports = router;
