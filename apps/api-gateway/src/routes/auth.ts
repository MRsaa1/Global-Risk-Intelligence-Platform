/**
 * Authentication routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authService } from '../auth/auth-service';

const LoginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

const RegisterSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['user', 'analyst', 'risk_manager', 'admin']).optional(),
});

export async function authRoutes(fastify: FastifyInstance) {
  // Login
  fastify.post('/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = LoginSchema.parse(request.body);
    
    const result = await authService.authenticate(body.username, body.password);
    
    if (!result) {
      reply.code(401);
      return { error: 'Invalid credentials' };
    }

    return {
      token: result.token,
      refresh_token: result.refreshToken,
      user: result.user,
    };
  });

  // Register
  fastify.post('/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = RegisterSchema.parse(request.body);
    
    try {
      const user = await authService.createUser(body);
      const result = await authService.authenticate(body.username, body.password!);

      reply.code(201);
      return {
        token: result!.token,
        refresh_token: result!.refreshToken,
        user,
      };
    } catch (error: any) {
      reply.code(400);
      return { error: error.message || 'Registration failed' };
    }
  });

  // Refresh token
  fastify.post('/auth/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const { refresh_token } = request.body as { refresh_token?: string };
    
    if (!refresh_token) {
      reply.code(400);
      return { error: 'Refresh token required' };
    }

    const token = await authService.refreshToken(refresh_token);
    
    if (!token) {
      reply.code(401);
      return { error: 'Invalid refresh token' };
    }

    return { token };
  });

  // OIDC login (initiate)
  fastify.get('/auth/oidc/login', async (request: FastifyRequest, reply: FastifyReply) => {
    // Redirect to OIDC provider
    const oidcUrl = process.env.OIDC_AUTHORIZATION_URL || '';
    if (!oidcUrl) {
      reply.code(501);
      return { error: 'OIDC not configured' };
    }

    reply.redirect(oidcUrl);
  });

  // OIDC callback
  fastify.get('/auth/oidc/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code } = request.query as { code?: string };
    
    if (!code) {
      reply.code(400);
      return { error: 'Authorization code required' };
    }

    const result = await authService.authenticateOIDC(code, '');
    
    if (!result) {
      reply.code(401);
      return { error: 'OIDC authentication failed' };
    }

    // In production, would redirect to frontend with token
    return {
      token: result.token,
      refresh_token: result.refreshToken,
      user: result.user,
    };
  });

  // Get current user
  fastify.get('/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token = request.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        reply.code(401);
        return { error: 'Token required' };
      }

      const user = authService.verifyToken(token);
      if (!user) {
        reply.code(401);
        return { error: 'Invalid token' };
      }

      return { user };
    } catch (error) {
      reply.code(401);
      return { error: 'Authentication failed' };
    }
  });
}

