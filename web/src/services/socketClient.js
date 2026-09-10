import { io } from 'socket.io-client';

// In development, Vite proxy handles /socket.io → localhost:3000
// In production, connect directly to backend or use current origin
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== '/api'
  ? import.meta.env.VITE_API_URL
  : window.location.origin);

/**
 * Realtime (Socket.IO) availability gate
 * --------------------------------------
 * Vercel Serverless Functions do NOT support persistent WebSocket /
 * long-polling sessions, so Socket.IO can never connect there — every
 * attempt spams the browser console with 404s on /socket.io.
 *
 * Realtime stays enabled when:
 *  - running locally in dev (Vite proxy → local API), OR
 *  - VITE_SOCKET_URL is explicitly set (self-hosted API e.g. Render/Railway
 *    where WebSockets work fine).
 * Otherwise (Vercel serverless) we degrade gracefully: Layout.jsx falls
 * back to periodic polling instead of a live socket.
 */
export const REALTIME_ENABLED = import.meta.env.DEV || Boolean(import.meta.env.VITE_SOCKET_URL);

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
});
