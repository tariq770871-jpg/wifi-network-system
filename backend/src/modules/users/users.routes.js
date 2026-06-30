const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../shared/middleware/auth');
const { getAll, getById, update, controlTracking, vetoTracking } = require('./users.controller');

router.get('/', authenticate, authorize('admin', 'support'), getAll);
router.get('/:id', authenticate, getById);
router.put('/:id', authenticate, authorize('admin'), update);
router.post('/:id/tracking', authenticate, authorize('admin'), controlTracking);
router.post('/me/veto', authenticate, authorize('technician'), vetoTracking);

module.exports = router;
