/**
 * Secure Production API Gateway
 * Enhanced with security, stability, and monitoring
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import { config } from 'dotenv';
import { z } from 'zod';

config();

// Environment validation
const envSchema = z.object({
  PORT: z.string().default('9002'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  CORS_ORIGIN: z.string().optional(),
  RATE_LIMIT_MAX: z.string().default('100'),
  RATE_LIMIT_WINDOW: z.string().default('60000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

let env: z.infer<typeof envSchema>;
try {
  env = envSchema.parse(process.env);
} catch (error) {
  console.error('❌ Environment validation failed:', error);
  process.exit(1);
}

// Configure logger based on environment
const loggerConfig = env.NODE_ENV === 'production'
  ? {
      level: env.LOG_LEVEL,
      serializers: {
        req: (req: any) => ({
          method: req.method,
          url: req.url,
          remoteAddress: req.ip,
        }),
        res: (res: any) => ({
          statusCode: res.statusCode,
        }),
        err: (err: any) => ({
          type: err.type,
          message: err.message,
          stack: env.NODE_ENV === 'development' ? err.stack : undefined,
        }),
      },
    }
  : {
      level: env.LOG_LEVEL,
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
      },
    };

const fastify = Fastify({
  logger: loggerConfig,
  requestIdLogLabel: 'reqId',
  requestIdHeader: 'x-request-id',
  disableRequestLogging: false,
  trustProxy: true, // Trust proxy headers (for rate limiting behind reverse proxy)
});

// Graceful shutdown handler
const shutdown = async (signal: string) => {
  fastify.log.info(`Received ${signal}, starting graceful shutdown...`);
  
  try {
    await fastify.close();
    fastify.log.info('Server closed successfully');
    process.exit(0);
  } catch (err) {
    fastify.log.error('Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error({ err: error, req: request }, 'Request error');
  
  // Don't expose internal errors in production
  const isDevelopment = env.NODE_ENV === 'development';
  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 && !isDevelopment
    ? 'Internal server error'
    : error.message;

  reply.code(statusCode).send({
    error: message,
    statusCode,
    ...(isDevelopment && { stack: error.stack }),
  });
});

// Not found handler
fastify.setNotFoundHandler((request, reply) => {
  reply.code(404).send({
    error: 'Not found',
    statusCode: 404,
    path: request.url,
  });
});

async function setup() {
  // Security: Helmet for security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow embedding if needed
  });

  // Security: CORS with proper configuration
  await fastify.register(cors, {
    origin: env.CORS_ORIGIN || (env.NODE_ENV === 'production' ? false : '*'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
  });

  // Security: Rate limiting
  await fastify.register(rateLimit, {
    max: parseInt(env.RATE_LIMIT_MAX, 10),
    timeWindow: parseInt(env.RATE_LIMIT_WINDOW, 10),
    errorResponseBuilder: (request, context) => {
      return {
        error: 'Too many requests',
        statusCode: 429,
        retryAfter: Math.ceil(context.ttl / 1000),
      };
    },
    // Skip rate limiting for health checks
    skip: (request) => request.url === '/health',
  });

  // Security: JWT
  await fastify.register(jwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: '15m', // Short-lived access tokens
    },
  });

  // Request ID middleware
  fastify.addHook('onRequest', async (request, reply) => {
    const requestId = request.headers['x-request-id'] || 
                     `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    request.id = requestId;
    reply.header('X-Request-ID', requestId);
  });

  // Health check (no auth required)
  fastify.get('/health', async (request) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
    };
  });

  // Detailed health check (for monitoring)
  fastify.get('/health/detailed', async (request) => {
    const memoryUsage = process.memoryUsage();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: env.NODE_ENV,
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
      },
      version: process.env.npm_package_version || '1.0.0',
    };
  });

  // Favicon handler
  fastify.get('/favicon.ico', async (request, reply) => {
    reply.code(204).send();
  });

  // Demo login (with rate limiting)
  const loginSchema = z.object({
    username: z.string().min(1).max(100),
    password: z.string().min(1).max(200),
  });

  fastify.post('/api/v1/demo/login', {
    config: {
      rateLimit: {
        max: 5, // Stricter rate limit for login
        timeWindow: '15 minutes',
      },
    },
  }, async (request: any, reply) => {
    try {
      const body = loginSchema.parse(request.body);
      
      // In production, you should verify credentials against database
      // For demo, we accept any credentials but log the attempt
      fastify.log.info({ username: body.username, ip: request.ip }, 'Demo login attempt');
      
      const token = await reply.jwtSign({
        user_id: 'demo_user',
        username: body.username,
        email: `${body.username}@demo.com`,
        role: 'user',
      });

      return {
        token,
        user: {
          user_id: 'demo_user',
          username: body.username,
          email: `${body.username}@demo.com`,
        },
      };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        reply.code(400);
        return { error: 'Invalid request', details: error.errors };
      }
      throw error;
    }
  });

  // Demo data endpoints (protected with JWT)
  fastify.register(async function (fastify) {
    // JWT verification middleware
    fastify.addHook('onRequest', async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.code(401);
        return reply.send({ error: 'Authentication required' });
      }
    });

    // Demo data
    fastify.get('/api/v1/demo/data', async () => {
      return {
        dashboard: {
          active_scenarios: 5,
          running_calculations: 2,
          completed_calculations: 12,
          portfolios: 8,
          total_var: 15000000,
          total_capital: 100000000,
          capital_ratio: 0.125,
        },
        scenarios: [
          {
            scenario_id: 'scenario_1',
            name: 'CCAR Severely Adverse 2024',
            description: 'Federal Reserve severely adverse scenario',
            status: 'active',
            created_at: new Date().toISOString(),
          },
          {
            scenario_id: 'scenario_2',
            name: 'EBA Stress Test 2024',
            description: 'European Banking Authority stress test',
            status: 'active',
            created_at: new Date().toISOString(),
          },
        ],
        calculations: [
          {
            calculation_id: 'calc_1',
            scenario_id: 'scenario_1',
            portfolio_id: 'portfolio_1',
            status: 'completed',
            created_at: new Date(Date.now() - 3600000).toISOString(),
            completed_at: new Date().toISOString(),
            results: {
              basel_iv_calc: {
                cet1_ratio: 0.125,
                capital_requirement: 8000000,
                capital_surplus: 2000000,
                rwa: 80000000,
              },
              lcr_calc: {
                lcr: 1.15,
                hqla: 115000000,
                net_cash_outflows_30d: 100000000,
                meets_requirement: true,
              },
            },
          },
          {
            calculation_id: 'calc_2',
            scenario_id: 'scenario_2',
            portfolio_id: 'portfolio_2',
            status: 'running',
            created_at: new Date(Date.now() - 1800000).toISOString(),
          },
        ],
        portfolios: [
          {
            portfolio_id: 'portfolio_1',
            portfolio_name: 'Trading Portfolio',
            as_of_date: new Date().toISOString(),
            total_notional: 500000000,
            total_market_value: 510000000,
            total_rwa: 40000000,
            position_count: 150,
          },
          {
            portfolio_id: 'portfolio_2',
            portfolio_name: 'Investment Portfolio',
            as_of_date: new Date().toISOString(),
            total_notional: 1000000000,
            total_market_value: 1020000000,
            total_rwa: 80000000,
            position_count: 300,
          },
        ],
      };
    });

    // Demo metrics
    fastify.get('/api/v1/demo/metrics', async () => {
      const now = Date.now();
      const days = 30;
      const metrics = [];

      for (let i = days; i >= 0; i--) {
        const date = new Date(now - i * 24 * 60 * 60 * 1000);
        metrics.push({
          date: date.toISOString().split('T')[0],
          var: 10000000 + Math.random() * 5000000,
          capital_ratio: 0.12 + Math.random() * 0.03,
        });
      }

      return { metrics };
    });

    // Scenarios endpoints
    fastify.get('/api/v1/scenarios', async () => {
      return [
        {
          scenario_id: 'scenario_1',
          name: 'CCAR Severely Adverse 2024',
          description: 'Federal Reserve severely adverse scenario',
          status: 'active',
          created_at: new Date().toISOString(),
        },
        {
          scenario_id: 'scenario_2',
          name: 'EBA Stress Test 2024',
          description: 'European Banking Authority stress test',
          status: 'active',
          created_at: new Date().toISOString(),
        },
      ];
    });

    // Portfolios endpoints
    fastify.get('/api/v1/portfolios', async () => {
      return [
        {
          portfolio_id: 'portfolio_1',
          portfolio_name: 'Trading Portfolio',
          as_of_date: new Date().toISOString(),
          total_notional: 500000000,
          total_market_value: 510000000,
          total_rwa: 40000000,
          position_count: 150,
        },
        {
          portfolio_id: 'portfolio_2',
          portfolio_name: 'Investment Portfolio',
          as_of_date: new Date().toISOString(),
          total_notional: 1000000000,
          total_market_value: 1020000000,
          total_rwa: 80000000,
          position_count: 300,
        },
      ];
    });

    // Calculations endpoints
    fastify.get('/api/v1/calculations', async () => {
      return [
        {
          calculation_id: 'calc_1',
          scenario_id: 'scenario_1',
          portfolio_id: 'portfolio_1',
          status: 'completed',
          created_at: new Date(Date.now() - 3600000).toISOString(),
          completed_at: new Date().toISOString(),
          results: {
            basel_iv_calc: {
              cet1_ratio: 0.125,
              capital_requirement: 8000000,
              capital_surplus: 2000000,
              rwa: 80000000,
            },
          },
        },
        {
          calculation_id: 'calc_2',
          scenario_id: 'scenario_2',
          portfolio_id: 'portfolio_2',
          status: 'running',
          created_at: new Date(Date.now() - 1800000).toISOString(),
        },
      ];
    });

    // Calculate endpoint
    fastify.post('/api/v1/calculate', async (request: any) => {
      const body = request.body || {};
      return {
        calculation_id: `calc_${Date.now()}`,
        scenario_id: body.scenario_id || 'scenario_1',
        portfolio_id: body.portfolio_id || 'portfolio_1',
        status: 'running',
        created_at: new Date().toISOString(),
      };
    });

    // Cancel calculation
    fastify.post('/api/v1/calculations/:id/cancel', async () => {
      return { success: true };
    });
  });

  // WebSocket endpoint (disabled in secure mode)
  fastify.get('/socket.io/*', async (request, reply) => {
    reply.code(404).send({ error: 'WebSocket not available in secure mode' });
  });

  const port = parseInt(env.PORT, 10);
  const host = env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

  try {
    await fastify.listen({ port, host });
    fastify.log.info(`✅ Secure API Gateway listening on ${host}:${port}`);
    fastify.log.info(`📊 Health: http://${host}:${port}/health`);
    fastify.log.info(`🔒 Environment: ${env.NODE_ENV}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

setup().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

