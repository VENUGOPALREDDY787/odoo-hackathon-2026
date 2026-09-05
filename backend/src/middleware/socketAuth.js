import { container } from '../container/index.js';
import { logger } from '../utils/logger.js';

/**
 * Socket.IO authentication middleware.
 * Expects a JWT token in handshake auth payload or headers.
 * Populates socket.user and automatically joins role-based and user-specific rooms.
 */
export const socketAuth = (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
  
  if (!token) {
    logger.warn({ socketId: socket.id }, 'Socket connection attempt without token');
    return next(new Error('Authentication error: Token required'));
  }

  try {
    const authService = container.get('authService');
    const decoded = authService.verifyAccessToken(token);

    // Attach minimal user info to the socket
    socket.user = {
      id: decoded.sub,
      role: decoded.role, // Assuming role is embedded in the JWT payload
    };

    // Auto-join dashboard rooms based on user ID and role
    socket.join(`dashboard:${socket.user.id}`);
    if (socket.user.role) {
      socket.join(`dashboard:${socket.user.role}`);
    }

    logger.debug({ socketId: socket.id, userId: socket.user.id, role: socket.user.role }, 'Socket authenticated and joined default rooms');
    next();
  } catch (err) {
    logger.warn({ socketId: socket.id, err: err.message }, 'Socket authentication failed');
    next(new Error('Authentication error: Invalid token'));
  }
};
