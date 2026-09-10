/**
 * ESLint Flat Config - Backend (Node.js CommonJS)
 */
const js = require('@eslint/js');

module.exports = [
    js.configs.recommended,
    {
        files: ['src/**/*.js', 'tests/**/*.js', '*.js'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'commonjs',
            globals: {
                process: 'readonly',
                console: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                // Jest
                describe: 'readonly',
                test: 'readonly',
                it: 'readonly',
                expect: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
            },
        },
        rules: {
            // الأخطاء الحرجة
            'no-unused-vars': ['error', { argsIgnorePattern: '^_|^next$|^req$|^res$' }],
            'no-undef': 'error',
            'no-dupe-keys': 'error',
            'no-unreachable': 'error',
            'no-fallthrough': 'error',
            // أمان
            'no-eval': 'error',
            'no-implied-eval': 'error',
            'no-new-func': 'error',
            // جودة
            'eqeqeq': ['error', 'smart'],
            'no-var': 'error',
            'prefer-const': 'warn',
            'no-console': 'off', // الـ logger يستخدم console داخلياً
        },
    },
    {
        ignores: ['node_modules/**', 'coverage/**'],
    },
];
