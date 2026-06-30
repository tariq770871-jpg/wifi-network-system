const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../shared/middleware/auth');
const { getAll, getById, create, review, getMyRequests, delete: deletePoint } = require('./map-points.controller');

router.get('/', authenticate, getAll);
router.get('/my-requests', authenticate, authorize('technician'), getMyRequests);
router.get('/:id', authenticate, getById);
router.post('/', authenticate, authorize('technician'), create);
router.post('/:id/review', authenticate, authorize('admin', 'support'), review);
router.delete('/:id', authenticate, authorize('admin'), deletePoint);

module.exports = router;
