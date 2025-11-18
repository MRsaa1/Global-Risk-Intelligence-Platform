/**
 * Scenarios API routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import prisma from '../db/client';

const ScenarioSchema = z.object({
  scenario_id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  scenario_data: z.any().optional(),
});

export async function scenariosRoutes(fastify: FastifyInstance) {
  // List scenarios
  fastify.get('/scenarios', async (request: FastifyRequest, reply: FastifyReply) => {
    const scenarios = await prisma.scenario.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { scenarios: scenarios.map(s => ({
      scenario_id: s.scenarioId,
      name: s.name,
      description: s.description,
      status: s.status.toLowerCase(),
      created_at: s.createdAt.toISOString(),
      updated_at: s.updatedAt.toISOString(),
    })) };
  });

  // Get scenario by ID
  fastify.get('/scenarios/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const scenario = await prisma.scenario.findUnique({
      where: { scenarioId: id },
    });

    if (!scenario) {
      reply.code(404);
      return { error: 'Scenario not found' };
    }

    return {
      scenario_id: scenario.scenarioId,
      name: scenario.name,
      description: scenario.description,
      status: scenario.status.toLowerCase(),
      scenario_data: scenario.scenarioData,
      created_at: scenario.createdAt.toISOString(),
      updated_at: scenario.updatedAt.toISOString(),
    };
  });

  // Create scenario
  fastify.post('/scenarios', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = ScenarioSchema.parse(request.body);
    
    const scenario = await prisma.scenario.create({
      data: {
        name: body.name,
        description: body.description,
        status: (body.status?.toUpperCase() as any) || 'DRAFT',
        scenarioData: body.scenario_data,
      },
    });

    reply.code(201);
    return {
      scenario_id: scenario.scenarioId,
      name: scenario.name,
      description: scenario.description,
      status: scenario.status.toLowerCase(),
      created_at: scenario.createdAt.toISOString(),
    };
  });

  // Update scenario
  fastify.put('/scenarios/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const body = ScenarioSchema.partial().parse(request.body);
    
    const scenario = await prisma.scenario.update({
      where: { scenarioId: id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.status && { status: body.status.toUpperCase() as any }),
        ...(body.scenario_data && { scenarioData: body.scenario_data }),
      },
    });

    return {
      scenario_id: scenario.scenarioId,
      name: scenario.name,
      description: scenario.description,
      status: scenario.status.toLowerCase(),
      updated_at: scenario.updatedAt.toISOString(),
    };
  });

  // Delete scenario
  fastify.delete('/scenarios/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    await prisma.scenario.delete({
      where: { scenarioId: id },
    });
    reply.code(204);
    return;
  });
}
