const { validationResult } = require('express-validator');
const { error } = require('../utils/response');

const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const messages = errors.array().map(e => e.msg);
        return error(res, messages.join('، '), 400);
    }
    next();
};

module.exports = { validateRequest };
