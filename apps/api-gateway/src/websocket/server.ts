/**
 * WebSocket server for real-time updates
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import prisma from '../db/client';

export function setupWebSocket(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
    path: '/socket.io',
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const { authService } = await import('../auth/auth-service');
      const user = authService.verifyToken(token);
      
      if (!user) {
        return next(new Error('Invalid token'));
      }

      (socket as any).user = user;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user;
    console.log(`User connected: ${user.username}`);

    // Join user's personal room
    socket.join(`user:${user.user_id}`);

    // Subscribe to calculation updates
    socket.on('subscribe:calculation', (calculationId: string) => {
      socket.join(`calculation:${calculationId}`);
      console.log(`Subscribed to calculation: ${calculationId}`);
    });

    // Subscribe to scenario updates
    socket.on('subscribe:scenario', (scenarioId: string) => {
      socket.join(`scenario:${scenarioId}`);
    });

    // Unsubscribe
    socket.on('unsubscribe:calculation', (calculationId: string) => {
      socket.leave(`calculation:${calculationId}`);
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${user.username}`);
    });
  });

  return io;
}

/**
 * Emit calculation update
 */
export async function emitCalculationUpdate(
  io: SocketIOServer,
  calculationId: string,
  update: any
): Promise<void> {
  io.to(`calculation:${calculationId}`).emit('calculation:update', {
    calculation_id: calculationId,
    ...update,
  });
}

/**
 * Emit notification to user
 */
export async function emitNotification(
  io: SocketIOServer,
  userId: string,
  notification: {
    type: 'success' | 'error' | 'info' | 'warning';
    title: string;
    message: string;
    data?: any;
  }
): Promise<void> {
  io.to(`user:${userId}`).emit('notification', notification);
}

