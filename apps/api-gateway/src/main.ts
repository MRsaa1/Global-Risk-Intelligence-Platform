/**
 * API Gateway - FastAPI gateway with authentication and routing.
 *
 * This is a TypeScript/Node.js implementation using Fastify.
 * Alternatively, could use Python FastAPI as specified in README.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import { config } from 'dotenv';
import { createServer } from 'http';
import { setupWebSocket } from './websocket/server';

config();

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' } }
        : undefined,
  },
});

// Create HTTP server for WebSocket
const httpServer = createServer();
const io = setupWebSocket(httpServer);

// Attach Fastify to HTTP server
fastify.ready().then(() => {
  httpServer.on('request', fastify.server);
});

// Register plugins
async function setup() {
  // Security
  await fastify.register(helmet);
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  // Rate limiting
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // JWT authentication
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
  });

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Authentication routes (public)
  const { authRoutes } = await import('./routes/auth');
  await fastify.register(authRoutes, { prefix: '/api/v1' });

  // Demo auth routes (public, for demo purposes)
  const { demoAuthRoutes } = await import('./routes/demo-auth');
  await fastify.register(demoAuthRoutes, { prefix: '/api/v1' });

  // Protected routes
  fastify.register(async function (fastify) {
    fastify.addHook('onRequest', async (request, reply) => {
      try {
        // Support both Fastify JWT and custom token verification
        const authHeader = request.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const { authService } = await import('./auth/auth-service');
          const user = authService.verifyToken(token);
          
          if (!user) {
            reply.code(401);
            return reply.send({ error: 'Invalid token' });
          }
          
          // Attach user to request
          (request as any).user = user;
        } else {
          // Try Fastify JWT
          await request.jwtVerify();
        }
      } catch (err) {
        reply.code(401);
        reply.send({ error: 'Authentication required' });
      }
    });

    // Register route modules
    const { scenariosRoutes } = await import('./routes/scenarios');
    const { calculationsRoutes } = await import('./routes/calculations');
    const { portfoliosRoutes } = await import('./routes/portfolios');
    const { queueRoutes } = await import('./routes/queue');
    const { reportsRoutes } = await import('./routes/reports');
    const { riskMonitorRoutes } = await import('./routes/risk-monitor');
    const { earlyWarningRoutes } = await import('./routes/early-warning');
    const { workflowRoutes } = await import('./routes/workflows');
    const { demoRoutes } = await import('./routes/demo');
    
    await fastify.register(scenariosRoutes, { prefix: '/api/v1' });
    await fastify.register(calculationsRoutes, { prefix: '/api/v1' });
    await fastify.register(portfoliosRoutes, { prefix: '/api/v1' });
    await fastify.register(queueRoutes, { prefix: '/api/v1' });
    await fastify.register(reportsRoutes, { prefix: '/api/v1' });
    await fastify.register(riskMonitorRoutes, { prefix: '/api/v1' });
    await fastify.register(earlyWarningRoutes, { prefix: '/api/v1' });
    await fastify.register(workflowRoutes, { prefix: '/api/v1' });
    await fastify.register(demoRoutes, { prefix: '/api/v1' });

    // Setup services with WebSocket
    const { calculationService } = await import('./services/calculation-service');
    calculationService.setIO(io);

    const { notificationService } = await import('./services/notification-service');
    notificationService.setIO(io);
  });

  const port = parseInt(process.env.PORT || '9002', 10);  // Changed to 9002 (9001 is occupied by MinIO)
  const host = process.env.HOST || '0.0.0.0';

  try {
    await fastify.ready();
    httpServer.listen(port, host, () => {
      fastify.log.info(`API Gateway listening on ${host}:${port}`);
      fastify.log.info(`WebSocket server ready on ${host}:${port}`);
    });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

setup();

