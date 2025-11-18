/**
 * Calculations API routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import prisma from '../db/client';

const CalculationRequestSchema = z.object({
  scenario_id: z.string(),
  portfolio_id: z.string(),
});

export async function calculationsRoutes(fastify: FastifyInstance) {
  // List calculations
  fastify.get('/calculations', async (request: FastifyRequest, reply: FastifyReply) => {
    const calculations = await prisma.calculation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { scenario: true },
    });
    return { calculations: calculations.map(c => ({
      calculation_id: c.calculationId,
      scenario_id: c.scenarioId,
      portfolio_id: c.portfolioId,
      status: c.status.toLowerCase(),
      results: c.results,
      error_message: c.errorMessage,
      created_at: c.createdAt.toISOString(),
      started_at: c.startedAt?.toISOString(),
      completed_at: c.completedAt?.toISOString(),
    })) };
  });

  // Get calculation by ID
  fastify.get('/calculations/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const calculation = await prisma.calculation.findUnique({
      where: { calculationId: id },
      include: { scenario: true },
    });

    if (!calculation) {
      reply.code(404);
      return { error: 'Calculation not found' };
    }

    return {
      calculation_id: calculation.calculationId,
      scenario_id: calculation.scenarioId,
      portfolio_id: calculation.portfolioId,
      status: calculation.status.toLowerCase(),
      results: calculation.results,
      error_message: calculation.errorMessage,
      created_at: calculation.createdAt.toISOString(),
      started_at: calculation.startedAt?.toISOString(),
      completed_at: calculation.completedAt?.toISOString(),
    };
  });

  // Create calculation (start calculation)
  fastify.post('/calculate', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = CalculationRequestSchema.parse(request.body);
    
    // Verify scenario exists
    const scenario = await prisma.scenario.findUnique({
      where: { scenarioId: body.scenario_id },
    });

    if (!scenario) {
      reply.code(404);
      return { error: 'Scenario not found' };
    }

    // Start calculation via service
    const { calculationService } = await import('../services/calculation-service');
    const calculationId = await calculationService.startCalculation(body);

    const calculation = await prisma.calculation.findUnique({
      where: { calculationId },
    });

    reply.code(202); // Accepted
    return {
      calculation_id: calculation!.calculationId,
      scenario_id: calculation!.scenarioId,
      portfolio_id: calculation!.portfolioId,
      status: calculation!.status.toLowerCase(),
      created_at: calculation!.createdAt.toISOString(),
    };
  });

  // Cancel calculation
  fastify.post('/calculations/:id/cancel', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { calculationService } = await import('../services/calculation-service');
    
    const cancelled = await calculationService.cancelCalculation(id);
    
    if (!cancelled) {
      reply.code(400);
      return { error: 'Calculation cannot be cancelled' };
    }

    const calculation = await prisma.calculation.findUnique({
      where: { calculationId: id },
    });

    return {
      calculation_id: calculation!.calculationId,
      status: calculation!.status.toLowerCase(),
    };
  });

  // Get calculation results
  fastify.get('/calculations/:id/results', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const calculation = await prisma.calculation.findUnique({
      where: { calculationId: id },
    });

    if (!calculation) {
      reply.code(404);
      return { error: 'Calculation not found' };
    }

    return {
      calculation_id: calculation.calculationId,
      results: calculation.results,
      status: calculation.status.toLowerCase(),
    };
  });
}
