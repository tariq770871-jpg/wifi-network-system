const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../shared/middleware/auth');
const { getAll, getById, create, update, assign, complete, delete: deleteTicket } = require('./tickets.controller');

router.get('/', authenticate, getAll);
router.get('/:id', authenticate, getById);
router.post('/', authenticate, authorize('admin', 'support'), create);
router.put('/:id', authenticate, update);
router.post('/:id/assign', authenticate, authorize('admin', 'support'), assign);
router.post('/:id/complete', authenticate, authorize('technician'), complete);
router.delete('/:id', authenticate, authorize('admin'), deleteTicket);

module.exports = router;
