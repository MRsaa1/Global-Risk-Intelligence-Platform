/**
 * Stress Testing Workflow routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import prisma from '../db/client';

const CreateWorkflowSchema = z.object({
  name: z.string(),
  description: z.string(),
  workflow_type: z.enum(['ccar', 'dfast', 'eba', 'custom']),
  steps: z.array(z.object({
    name: z.string(),
    type: z.string(),
    approvers: z.array(z.string()),
  })),
});

const ApproveStepSchema = z.object({
  step_id: z.string(),
  comments: z.string().optional(),
});

export async function workflowRoutes(fastify: FastifyInstance) {
  // Create workflow
  fastify.post('/workflows', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = CreateWorkflowSchema.parse(request.body);
    const user = (request as any).user;

    // In production, would create workflow in workflow engine
    const workflowId = `workflow_${Date.now()}`;

    return {
      workflow_id: workflowId,
      name: body.name,
      status: 'draft',
      created_by: user?.user_id || 'system',
    };
  });

  // Get workflow status
  fastify.get('/workflows/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    // In production, would fetch from workflow engine
    return {
      workflow_id: id,
      name: 'CCAR Stress Test 2024',
      status: 'pending_approval',
      steps: [
        {
          step_id: 'step_1',
          step_name: 'Scenario Review',
          status: 'approved',
        },
        {
          step_id: 'step_2',
          step_name: 'Calculation Execution',
          status: 'in_progress',
        },
      ],
    };
  });

  // Submit for approval
  fastify.post('/workflows/:id/submit', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    // In production, would submit workflow
    return {
      message: 'Workflow submitted for approval',
      workflow_id: id,
      status: 'pending_approval',
    };
  });

  // Approve step
  fastify.post('/workflows/:id/approve', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const body = ApproveStepSchema.parse(request.body);
    const user = (request as any).user;

    // In production, would approve step in workflow engine
    return {
      message: 'Step approved',
      workflow_id: id,
      step_id: body.step_id,
      approver: user?.user_id || 'system',
    };
  });

  // Get pending approvals
  fastify.get('/workflows/pending', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;

    // In production, would fetch from workflow engine
    return {
      pending_approvals: [
        {
          workflow_id: 'workflow_1',
          workflow_name: 'CCAR Stress Test 2024',
          step_id: 'step_2',
          step_name: 'Calculation Execution',
        },
      ],
    };
  });
}

