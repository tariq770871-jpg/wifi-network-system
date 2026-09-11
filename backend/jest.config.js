module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.js'],
    verbose: true,
    forceExit: true,
    clearMocks: true,
    // يشغّل ترقيات المخطط تلقائياً على قاعدة الاختبار قبل كل الحزم
    // (قاعدة جديدة فارغة لن تُفشل 100 اختبار «relation does not exist» بعد الآن)
    globalSetup: '<rootDir>/tests/global-setup.js',
};
