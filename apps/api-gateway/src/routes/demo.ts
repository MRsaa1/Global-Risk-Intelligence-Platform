/**
 * Demo routes for showcasing functionality
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function demoRoutes(fastify: FastifyInstance) {
  // Demo data endpoint
  fastify.get('/demo/data', async (request: FastifyRequest, reply: FastifyReply) => {
    return {
      dashboard: {
        active_scenarios: 5,
        running_calculations: 2,
        completed_calculations: 12,
        portfolios: 8,
        total_var: 15000000,
        total_capital: 100000000,
        capital_ratio: 0.125,
      },
      scenarios: [
        {
          scenario_id: 'scenario_1',
          name: 'CCAR Severely Adverse 2024',
          description: 'Federal Reserve severely adverse scenario',
          status: 'active',
          created_at: new Date().toISOString(),
        },
        {
          scenario_id: 'scenario_2',
          name: 'EBA Stress Test 2024',
          description: 'European Banking Authority stress test',
          status: 'active',
          created_at: new Date().toISOString(),
        },
      ],
      calculations: [
        {
          calculation_id: 'calc_1',
          scenario_id: 'scenario_1',
          portfolio_id: 'portfolio_1',
          status: 'completed',
          created_at: new Date(Date.now() - 3600000).toISOString(),
          completed_at: new Date().toISOString(),
          results: {
            basel_iv_calc: {
              cet1_ratio: 0.125,
              capital_requirement: 8000000,
              capital_surplus: 2000000,
              rwa: 80000000,
            },
            lcr_calc: {
              lcr: 1.15,
              hqla: 115000000,
              net_cash_outflows_30d: 100000000,
              meets_requirement: true,
            },
          },
        },
        {
          calculation_id: 'calc_2',
          scenario_id: 'scenario_2',
          portfolio_id: 'portfolio_2',
          status: 'running',
          created_at: new Date(Date.now() - 1800000).toISOString(),
        },
      ],
      portfolios: [
        {
          portfolio_id: 'portfolio_1',
          portfolio_name: 'Trading Portfolio',
          as_of_date: new Date().toISOString(),
          total_notional: 500000000,
          total_market_value: 510000000,
          total_rwa: 40000000,
          position_count: 150,
        },
        {
          portfolio_id: 'portfolio_2',
          portfolio_name: 'Investment Portfolio',
          as_of_date: new Date().toISOString(),
          total_notional: 1000000000,
          total_market_value: 1020000000,
          total_rwa: 80000000,
          position_count: 300,
        },
      ],
    };
  });

  // Demo metrics endpoint
  fastify.get('/demo/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    const now = Date.now();
    const days = 30;
    const metrics = [];

    for (let i = days; i >= 0; i--) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      metrics.push({
        date: date.toISOString().split('T')[0],
        var: 15000000 + Math.random() * 2000000,
        capital_ratio: 0.12 + Math.random() * 0.01,
        lcr: 1.1 + Math.random() * 0.1,
      });
    }

    return { metrics };
  });
}

