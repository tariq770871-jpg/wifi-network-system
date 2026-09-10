/**
 * Vercel Serverless Entry Point
 * ------------------------------
 * Vercel's Node.js runtime wraps any Express app exported from /api/*.js
 * and routes all requests (via vercel.json rewrites) to this handler.
 *
 * Notes:
 * - src/app.js only calls server.listen() when run directly (require.main),
 *   so importing it here is safe (no port binding on serverless).
 * - Socket.IO WebSockets are not supported on serverless; REST API is
 *   fully functional. Clients degrade gracefully (autoConnect: false).
 */
const { app } = require('../src/app');

module.exports = app;
