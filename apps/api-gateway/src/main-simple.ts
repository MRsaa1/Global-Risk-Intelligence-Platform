/**
 * Simplified API Gateway for demo
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from 'dotenv';

config();

const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
    },
  },
});

async function setup() {
  // CORS
  await fastify.register(cors, {
    origin: '*',
    credentials: true,
  });

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Favicon handler (to avoid 403 errors)
  fastify.get('/favicon.ico', async (request, reply) => {
    reply.code(204).send();
  });

  // Demo routes
  fastify.get('/api/v1/demo/data', async () => {
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

  // Demo metrics
  fastify.get('/api/v1/demo/metrics', async () => {
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

  // Demo login
  fastify.post('/api/v1/demo/login', async (request: any) => {
    const { username, password } = request.body || {};
    const token = Buffer.from(`${username || 'demo'}:${Date.now()}`).toString('base64');

    return {
      token,
      user: {
        user_id: 'demo_user',
        username: username || 'demo',
        email: `${username || 'demo'}@demo.com`,
      },
    };
  });

  // Scenarios endpoints
  fastify.get('/api/v1/scenarios', async () => {
    return [
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
    ];
  });

  fastify.post('/api/v1/scenarios', async (request: any) => {
    const body = request.body || {};
    return {
      scenario_id: `scenario_${Date.now()}`,
      name: body.name || 'New Scenario',
      description: body.description || '',
      status: 'active',
      created_at: new Date().toISOString(),
    };
  });

  fastify.get('/api/v1/scenarios/:id', async (request: any) => {
    return {
      scenario_id: request.params.id,
      name: 'CCAR Severely Adverse 2024',
      description: 'Federal Reserve severely adverse scenario',
      status: 'active',
      created_at: new Date().toISOString(),
    };
  });

  fastify.put('/api/v1/scenarios/:id', async (request: any) => {
    return {
      scenario_id: request.params.id,
      ...(request.body || {}),
      updated_at: new Date().toISOString(),
    };
  });

  fastify.delete('/api/v1/scenarios/:id', async () => {
    return { success: true };
  });

  // Portfolios endpoints
  fastify.get('/api/v1/portfolios', async () => {
    return [
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
    ];
  });

  fastify.get('/api/v1/portfolios/:id', async (request: any) => {
    return {
      portfolio_id: request.params.id,
      portfolio_name: 'Trading Portfolio',
      as_of_date: new Date().toISOString(),
      total_notional: 500000000,
      total_market_value: 510000000,
      total_rwa: 40000000,
      position_count: 150,
    };
  });

  // Calculations endpoints
  fastify.get('/api/v1/calculations', async () => {
    return [
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
    ];
  });

  fastify.get('/api/v1/calculations/:id', async (request: any) => {
    return {
      calculation_id: request.params.id,
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
    };
  });

  fastify.post('/api/v1/calculate', async (request: any) => {
    const body = request.body || {};
    return {
      calculation_id: `calc_${Date.now()}`,
      scenario_id: body.scenario_id || 'scenario_1',
      portfolio_id: body.portfolio_id || 'portfolio_1',
      status: 'running',
      created_at: new Date().toISOString(),
    };
  });

  fastify.post('/api/v1/calculations/:id/cancel', async () => {
    return { success: true };
  });

  // Simple WebSocket endpoint (returns 404 to disable WebSocket for now)
  fastify.get('/socket.io/*', async (request, reply) => {
    reply.code(404).send({ error: 'WebSocket not available in simple mode' });
  });

  const port = parseInt(process.env.PORT || '9002', 10);  // Changed to 9002 (9001 is occupied by MinIO)
  const host = process.env.HOST || '0.0.0.0';

  try {
    await fastify.listen({ port, host });
    console.log(`✅ API Gateway listening on ${host}:${port}`);
    console.log(`📊 Health: http://localhost:${port}/health`);
    console.log(`🎯 Demo: http://localhost:${port}/api/v1/demo/data`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

setup();

