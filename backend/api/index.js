/**
 * Vercel Serverless Entry Point
 * ------------------------------
 * Vercel's Node.js runtime wraps any Express app exported from /api/*.js
 * and routes all requests (via vercel.json rewrites) to this handler.
 *
 * Notes:
 * - src/app.js only calls server.listen() when run directly (require.main),
 *   so importing it here is safe (no port binding on serverless).
 * - Socket.IO WebSockets are not supported on serverless. The web client
 *   gates realtime on import.meta.env.DEV / VITE_SOCKET_URL and falls back
 *   to periodic polling, so /socket.io is never requested here (no 404s).
 * - app.js sets `trust proxy` = 1 for correct client IPs behind Vercel.
 */
const { app } = require('../src/app');

module.exports = app;
