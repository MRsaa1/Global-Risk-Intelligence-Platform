/**
 * Report export routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import prisma from '../db/client';

const ExportRequestSchema = z.object({
  calculation_id: z.string(),
  format: z.enum(['pdf', 'excel']),
});

export async function reportsRoutes(fastify: FastifyInstance) {
  // Export calculation report
  fastify.post('/reports/export', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = ExportRequestSchema.parse(request.body);
    
    const calculation = await prisma.calculation.findUnique({
      where: { calculationId: body.calculation_id },
      include: { scenario: true },
    });

    if (!calculation) {
      reply.code(404);
      return { error: 'Calculation not found' };
    }

    if (calculation.status !== 'COMPLETED') {
      reply.code(400);
      return { error: 'Calculation not completed' };
    }

    // In production, would generate actual PDF/Excel
    // For now, return placeholder
    const reportData = {
      calculation_id: calculation.calculationId,
      scenario_id: calculation.scenarioId,
      portfolio_id: calculation.portfolioId,
      status: calculation.status.toLowerCase(),
      results: calculation.results,
      created_at: calculation.createdAt.toISOString(),
      completed_at: calculation.completedAt?.toISOString(),
    };

    if (body.format === 'pdf') {
      // Generate PDF (placeholder)
      return {
        format: 'pdf',
        download_url: `/api/v1/reports/${body.calculation_id}.pdf`,
        message: 'PDF report generated',
      };
    } else {
      // Generate Excel (placeholder)
      return {
        format: 'excel',
        download_url: `/api/v1/reports/${body.calculation_id}.xlsx`,
        message: 'Excel report generated',
      };
    }
  });

  // Download report
  fastify.get('/reports/:id.:format', async (request: FastifyRequest<{ Params: { id: string; format: string } }>, reply: FastifyReply) => {
    const { id, format } = request.params;

    if (!['pdf', 'xlsx'].includes(format)) {
      reply.code(400);
      return { error: 'Invalid format' };
    }

    // In production, would serve actual file
    reply.code(501);
    return { error: 'Report generation not yet implemented' };
  });
}

