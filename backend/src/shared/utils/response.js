const success = (res, data, message = 'تم بنجاح', statusCode) => {
    const payload = { success: true, message, data };
    if (statusCode) {
        res.status(statusCode).json(payload);
    } else {
        res.json(payload);
    }
};

const error = (res, message, statusCode = 400) => {
    res.status(statusCode).json({ success: false, error: message });
};

module.exports = { success, error };
