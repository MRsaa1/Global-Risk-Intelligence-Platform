/**
 * Demo authentication - simplified for demo purposes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const LoginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export async function demoAuthRoutes(fastify: FastifyInstance) {
  // Demo login - no real authentication
  fastify.post('/demo/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = LoginSchema.parse(request.body);

    // Demo: accept any credentials
    const token = Buffer.from(`${body.username}:${Date.now()}`).toString('base64');

    return {
      token,
      user: {
        user_id: 'demo_user',
        username: body.username,
        email: `${body.username}@demo.com`,
      },
    };
  });

  // Demo token verification
  fastify.get('/demo/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    return {
      valid: true,
      user: {
        user_id: 'demo_user',
        username: 'demo',
      },
    };
  });
}

