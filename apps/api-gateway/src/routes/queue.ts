/**
 * Queue management routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function queueRoutes(fastify: FastifyInstance) {
  // Get queue stats
  fastify.get('/queue/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    if (process.env.USE_QUEUE !== 'true') {
      return { message: 'Queue not enabled' };
    }

    const { getQueueStats } = await import('../services/queue');
    const stats = await getQueueStats();
    return stats;
  });
}

