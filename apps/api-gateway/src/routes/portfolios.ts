/**
 * Portfolios API routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../db/client';

export async function portfoliosRoutes(fastify: FastifyInstance) {
  // List portfolios
  fastify.get('/portfolios', async (request: FastifyRequest, reply: FastifyReply) => {
    const portfolios = await prisma.portfolio.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { portfolios: portfolios.map(p => ({
      portfolio_id: p.portfolioId,
      portfolio_name: p.portfolioName,
      as_of_date: p.asOfDate.toISOString(),
      currency: p.currency,
      total_notional: p.totalNotional,
      total_market_value: p.totalMarketValue,
      total_rwa: p.totalRwa,
      position_count: p.positionCount,
    })) };
  });

  // Get portfolio by ID
  fastify.get('/portfolios/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const portfolio = await prisma.portfolio.findUnique({
      where: { portfolioId: id },
    });

    if (!portfolio) {
      reply.code(404);
      return { error: 'Portfolio not found' };
    }

    return {
      portfolio_id: portfolio.portfolioId,
      portfolio_name: portfolio.portfolioName,
      as_of_date: portfolio.asOfDate.toISOString(),
      currency: portfolio.currency,
      total_notional: portfolio.totalNotional,
      total_market_value: portfolio.totalMarketValue,
      total_rwa: portfolio.totalRwa,
      position_count: portfolio.positionCount,
      portfolio_data: portfolio.portfolioData,
    };
  });

  // Get portfolio positions
  fastify.get('/portfolios/:id/positions', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const portfolio = await prisma.portfolio.findUnique({
      where: { portfolioId: id },
    });

    if (!portfolio) {
      reply.code(404);
      return { error: 'Portfolio not found' };
    }

    // Positions are stored in portfolio_data JSON field
    const positions = (portfolio.portfolioData as any)?.positions || [];
    return { positions };
  });
}
