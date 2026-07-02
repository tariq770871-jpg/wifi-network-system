const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../shared/middleware/auth');
const { getDashboardStats, getTechnicianPerformance } = require('./reports.controller');

router.get('/dashboard', authenticate, authorize('admin', 'support'), getDashboardStats);
router.get('/technicians', authenticate, authorize('admin', 'support'), getTechnicianPerformance);

module.exports = router;
