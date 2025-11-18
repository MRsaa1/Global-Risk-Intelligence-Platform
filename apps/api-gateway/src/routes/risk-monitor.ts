/**
 * Real-Time Risk Monitor routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const MetricsRequestSchema = z.object({
  portfolio_id: z.string(),
});

const LimitSchema = z.object({
  metric_type: z.enum(['var', 'cvar', 'stress_var', 'capital_ratio', 'lcr', 'nsfr']),
  warning_threshold: z.number(),
  breach_threshold: z.number(),
});

export async function riskMonitorRoutes(fastify: FastifyInstance) {
  // Get live risk metrics
  fastify.get('/risk-monitor/metrics/:portfolioId', async (
    request: FastifyRequest<{ Params: { portfolioId: string } }>,
    reply: FastifyReply
  ) => {
    const { portfolioId } = request.params;

    // In production, would call risk-monitor service
    const metrics = {
      portfolio_id: portfolioId,
      var: 1500000,
      cvar: 1950000,
      stress_var: 3000000,
      capital_ratio: 0.125,
      lcr: 1.15,
      timestamp: new Date().toISOString(),
    };

    return metrics;
  });

  // Get risk heatmap
  fastify.get('/risk-monitor/heatmap', async (request: FastifyRequest, reply: FastifyReply) => {
    // In production, would call risk-monitor service
    const heatmap = {
      portfolio_1: {
        var: 1500000,
        capital_ratio: 0.125,
        lcr: 1.15,
      },
      portfolio_2: {
        var: 2000000,
        capital_ratio: 0.110,
        lcr: 1.08,
      },
    };

    return heatmap;
  });

  // Set risk limits
  fastify.post('/risk-monitor/limits', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = LimitSchema.parse(request.body);

    // In production, would update limits in risk-monitor service
    return {
      message: 'Limits updated',
      limit: body,
    };
  });

  // Get alerts
  fastify.get('/risk-monitor/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    // In production, would fetch from risk-monitor service
    const alerts = [
      {
        alert_id: 'alert_1',
        portfolio_id: 'portfolio_1',
        metric: 'capital_ratio',
        value: 0.110,
        threshold: 0.120,
        severity: 'warning',
        timestamp: new Date().toISOString(),
      },
    ];

    return { alerts };
  });
}

