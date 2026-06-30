const { success } = require('../../shared/utils/response');

const placeholder = async (req, res) => {
    success(res, { message: 'signal module - قيد التطوير' });
};

module.exports = { placeholder };
