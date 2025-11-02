import { io } from 'socket.io-client';

let socket = null;

export function initSocket() {
  if (socket) return socket;
  const backend = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
  // enable reconnection and sensible defaults
  socket = io(backend, {
    transports: ['websocket'],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });

  // suppress socket debug logs in production
  socket.on('connect_error', (err) => {});
  socket.on('reconnect_attempt', (count) => {});

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
