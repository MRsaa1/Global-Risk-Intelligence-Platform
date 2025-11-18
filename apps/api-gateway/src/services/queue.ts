/**
 * Job queue for asynchronous calculations using Bull (Redis)
 */

import Queue from 'bull';
import prisma from '../db/client';

interface CalculationJob {
  calculationId: string;
  scenarioId: string;
  portfolioId: string;
}

// Create queue
const calculationQueue = new Queue<CalculationJob>('calculations', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
});

/**
 * Process calculation jobs
 */
calculationQueue.process(async (job) => {
  const { calculationId, scenarioId, portfolioId } = job.data;

  // Update status to RUNNING
  await prisma.calculation.update({
    where: { calculationId },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
    },
  });

  try {
    // Call reg-calculator service
    const { calculationService } = await import('./calculation-service');
    const result = await calculationService.executeCalculationDirect({
      scenario_id: scenarioId,
      portfolio_id: portfolioId,
    });

    if (result.status === 'success') {
      // Update with results
      await prisma.calculation.update({
        where: { calculationId },
        data: {
          status: 'COMPLETED',
          results: result.outputs,
          completedAt: new Date(),
        },
      });
    } else {
      // Update with error
      await prisma.calculation.update({
        where: { calculationId },
        data: {
          status: 'FAILED',
          errorMessage: result.error,
          completedAt: new Date(),
        },
      });
    }

    return result;
  } catch (error: any) {
    // Update with error
    await prisma.calculation.update({
      where: { calculationId },
      data: {
        status: 'FAILED',
        errorMessage: error.message || 'Unknown error',
        completedAt: new Date(),
      },
    });
    throw error;
  }
});

/**
 * Add calculation to queue
 */
export async function queueCalculation(
  calculationId: string,
  scenarioId: string,
  portfolioId: string
): Promise<void> {
  await calculationQueue.add(
    {
      calculationId,
      scenarioId,
      portfolioId,
    },
    {
      attempts: 3, // Retry 3 times on failure
      backoff: {
        type: 'exponential',
        delay: 2000, // Start with 2 second delay
      },
    }
  );
}

/**
 * Cancel calculation job
 */
export async function cancelCalculationJob(calculationId: string): Promise<boolean> {
  const jobs = await calculationQueue.getJobs(['waiting', 'active']);
  const job = jobs.find((j) => j.data.calculationId === calculationId);

  if (job) {
    await job.remove();
    return true;
  }

  return false;
}

/**
 * Get queue stats
 */
export async function getQueueStats() {
  const [waiting, active, completed, failed] = await Promise.all([
    calculationQueue.getWaitingCount(),
    calculationQueue.getActiveCount(),
    calculationQueue.getCompletedCount(),
    calculationQueue.getFailedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
  };
}

export { calculationQueue };

