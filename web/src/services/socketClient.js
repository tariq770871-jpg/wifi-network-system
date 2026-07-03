import { io } from 'socket.io-client';

// In development, Vite proxy handles /socket.io → localhost:3000
// In production, connect directly to backend or use current origin
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== '/api'
  ? import.meta.env.VITE_API_URL
  : window.location.origin);

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
});