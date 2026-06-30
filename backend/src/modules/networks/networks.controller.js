const { success } = require('../../shared/utils/response');

const placeholder = async (req, res) => {
    success(res, { message: 'networks module - قيد التطوير' });
};

module.exports = { placeholder };
