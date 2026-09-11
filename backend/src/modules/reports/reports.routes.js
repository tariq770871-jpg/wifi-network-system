const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../shared/middleware/auth');
const { getDashboardStats, getTechnicianPerformance } = require('./reports.controller');

// الداشبورد إحصائيات مجمعة غير حساسة — لكل الأدوار المصادقة (الفني يرى الصفحة الرئيسية)
router.get('/dashboard', authenticate, getDashboardStats);
// أداء الفنيين تفصيلي — للمدير والدعم فقط
router.get('/technicians', authenticate, authorize('admin', 'support'), getTechnicianPerformance);

module.exports = router;
