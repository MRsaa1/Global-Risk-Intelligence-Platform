/**
 * Metrics middleware for Prometheus
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function metricsMiddleware(fastify: FastifyInstance) {
  // Metrics endpoint
  fastify.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    // In production, would expose Prometheus metrics
    // For now, return basic metrics
    return {
      calculations_total: 0,
      api_requests_total: 0,
      active_calculations: 0,
    };
  });

  // Request metrics middleware
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();

    reply.addHook('onSend', async (request, reply) => {
      const duration = Date.now() - startTime;
      
      // Log metrics (in production, would send to Prometheus)
      fastify.log.info({
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        duration: `${duration}ms`,
      });
    });
  });
}

