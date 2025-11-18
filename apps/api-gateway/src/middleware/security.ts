/**
 * Security middleware
 */

import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Request validation middleware
 */
export async function validateRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  schema: any
) {
  try {
    request.body = schema.parse(request.body);
  } catch (error: any) {
    reply.code(400);
    return reply.send({
      error: 'Validation error',
      details: error.errors || error.message,
    });
  }
}

/**
 * IP whitelist middleware (optional)
 */
export function ipWhitelist(allowedIPs: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const clientIP = request.ip || request.socket.remoteAddress;
    
    if (!allowedIPs.includes(clientIP || '')) {
      reply.code(403);
      return reply.send({ error: 'IP not allowed' });
    }
  };
}

/**
 * Request size limit middleware
 */
export function requestSizeLimit(maxSize: number) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const contentLength = request.headers['content-length'];
    
    if (contentLength && parseInt(contentLength, 10) > maxSize) {
      reply.code(413);
      return reply.send({ error: 'Request too large' });
    }
  };
}

