const express = require('express');
const router = express.Router();
const ticketsController = require('./tickets.controller');
const { authenticate, authorize } = require('../../shared/middleware/auth');

// All routes require authentication
router.use(authenticate);

router.get('/', ticketsController.getAll);
router.get('/:id', ticketsController.getById);
router.post('/', authorize('admin', 'support'), ticketsController.create);
router.put('/:id', ticketsController.update);
router.delete('/:id', authorize('admin'), ticketsController.delete);
router.post('/:id/assign', authorize('admin', 'support'), ticketsController.assign);
router.post('/:id/start', authorize('technician'), ticketsController.start);
router.post('/:id/complete', authorize('technician'), ticketsController.complete);

module.exports = router;
