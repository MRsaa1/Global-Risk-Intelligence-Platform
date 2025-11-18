/**
 * Early Warning Indicators routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const IndicatorUpdateSchema = z.object({
  indicator_name: z.string(),
  value: z.number(),
  timestamp: z.string().optional(),
});

export async function earlyWarningRoutes(fastify: FastifyInstance) {
  // Get composite score
  fastify.get('/early-warning/score', async (request: FastifyRequest, reply: FastifyReply) => {
    // In production, would call early-warning service
    const score = {
      composite_score: 45.5,
      stress_probability_30d: 0.15,
      timestamp: new Date().toISOString(),
    };

    return score;
  });

  // Update indicator
  fastify.post('/early-warning/indicators', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = IndicatorUpdateSchema.parse(request.body);

    // In production, would update indicator in early-warning service
    return {
      message: 'Indicator updated',
      indicator: body.indicator_name,
      value: body.value,
    };
  });

  // Get indicators
  fastify.get('/early-warning/indicators', async (request: FastifyRequest, reply: FastifyReply) => {
    // In production, would fetch from early-warning service
    const indicators = {
      market: {
        VIX: { value: 25.5, threshold: 30.0, trend: 'increasing', severity: 'low' },
        Yield_Curve_Inversion: { value: -0.2, threshold: -0.5, trend: 'neutral', severity: 'low' },
      },
      credit: {
        CDS_Spread: { value: 150.0, threshold: 200.0, trend: 'increasing', severity: 'low' },
      },
      liquidity: {
        Bid_Ask_Spread: { value: 0.03, threshold: 0.05, trend: 'neutral', severity: 'low' },
      },
    };

    return indicators;
  });

  // Get alerts
  fastify.get('/early-warning/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    // In production, would fetch from early-warning service
    const alerts = [
      {
        alert_id: 'ewi_1',
        indicator_name: 'VIX',
        indicator_type: 'market',
        current_value: 32.5,
        threshold: 30.0,
        severity: 'medium',
        timestamp: new Date().toISOString(),
      },
    ];

    return { alerts };
  });
}

