const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../shared/middleware/auth');
const { logLocation, getLiveLocations, getTechnicianPath, logSignal, getSignalReadings } = require('./tracking.controller');

router.post('/log', authenticate, authorize('technician'), logLocation);
router.get('/live', authenticate, authorize('admin', 'support'), getLiveLocations);
router.get('/path/:userId', authenticate, authorize('admin', 'support'), getTechnicianPath);
router.post('/signal', authenticate, authorize('technician'), logSignal);
router.get('/signal', authenticate, getSignalReadings);

module.exports = router;
