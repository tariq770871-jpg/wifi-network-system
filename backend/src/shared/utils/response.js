const success = (res, data, message = 'تم بنجاح') => {
    res.json({ success: true, message, data });
};

const error = (res, message, statusCode = 400) => {
    res.status(statusCode).json({ success: false, error: message });
};

module.exports = { success, error };
