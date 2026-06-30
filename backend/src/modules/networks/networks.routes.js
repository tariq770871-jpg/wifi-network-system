const express = require('express');
const router = express.Router();
const { authenticate } = require('../../shared/middleware/auth');
const { placeholder } = require('./networks.controller');

router.get('/', authenticate, placeholder);

module.exports = router;
