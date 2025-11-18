/**
 * Calculation service - integrates with reg-calculator
 */

import prisma from '../db/client';
import { CalculationStatus } from '@prisma/client';
import { emitCalculationUpdate } from '../websocket/server';

interface CalculationRequest {
  scenario_id: string;
  portfolio_id: string;
}

interface CalculationResult {
  status: 'success' | 'error';
  outputs?: any;
  error?: string;
}

class CalculationService {
  private regCalculatorUrl: string;
  private io: any;

  constructor() {
    this.regCalculatorUrl = process.env.REG_CALCULATOR_URL || 'http://localhost:8080';
  }

  setIO(io: any) {
    this.io = io;
  }

  /**
   * Start calculation asynchronously
   */
  async startCalculation(request: CalculationRequest): Promise<string> {
    // Create calculation record
    const calculation = await prisma.calculation.create({
      data: {
        scenarioId: request.scenario_id,
        portfolioId: request.portfolio_id,
        status: 'PENDING',
      },
    });

    // Use queue if available, otherwise execute directly
    if (process.env.USE_QUEUE === 'true') {
      const { queueCalculation } = await import('./queue');
      await queueCalculation(
        calculation.calculationId,
        request.scenario_id,
        request.portfolio_id
      );
    } else {
      // Start calculation in background (non-blocking)
      this.executeCalculation(calculation.calculationId, request).catch((error) => {
        console.error('Calculation execution error:', error);
        this.updateCalculationStatus(calculation.calculationId, 'FAILED', {
          errorMessage: error.message,
        });
      });
    }

    return calculation.calculationId;
  }

  /**
   * Execute calculation (async)
   */
  private async executeCalculation(
    calculationId: string,
    request: CalculationRequest
  ): Promise<void> {
    // Update status to RUNNING
    await this.updateCalculationStatus(calculationId, 'RUNNING', {
      startedAt: new Date(),
    });

    try {
      // Call reg-calculator service
      const result = await this.callRegCalculator(request);

      if (result.status === 'success') {
        // Update with results
        await this.updateCalculationStatus(calculationId, 'COMPLETED', {
          results: result.outputs,
          completedAt: new Date(),
        });

        // Emit WebSocket update
        if (this.io) {
          await emitCalculationUpdate(this.io, calculationId, {
            status: 'completed',
            results: result.outputs,
          });

          // Send notification
          const { notificationService } = await import('./notification-service');
          await notificationService.notifyCalculationCompleted(calculationId);
        }
      } else {
        // Update with error
        await this.updateCalculationStatus(calculationId, 'FAILED', {
          errorMessage: result.error,
          completedAt: new Date(),
        });

        // Emit WebSocket update
        if (this.io) {
          await emitCalculationUpdate(this.io, calculationId, {
            status: 'failed',
            error: result.error,
          });

          // Send notification
          const { notificationService } = await import('./notification-service');
          await notificationService.notifyCalculationFailed(calculationId, result.error);
        }
      }
    } catch (error: any) {
      await this.updateCalculationStatus(calculationId, 'FAILED', {
        errorMessage: error.message || 'Unknown error',
        completedAt: new Date(),
      });

      // Emit WebSocket update
      if (this.io) {
        await emitCalculationUpdate(this.io, calculationId, {
          status: 'failed',
          error: error.message,
        });
      }

      throw error;
    }
  }

  /**
   * Call reg-calculator service
   */
  private async callRegCalculator(
    request: CalculationRequest
  ): Promise<CalculationResult> {
    // Option 1: HTTP call to reg-calculator service
    if (process.env.USE_HTTP === 'true') {
      return this.callRegCalculatorHTTP(request);
    }

    // Option 2: Direct Python subprocess call (for development)
    return this.callRegCalculatorDirect(request);
  }

  /**
   * Call reg-calculator via HTTP
   */
  private async callRegCalculatorHTTP(
    request: CalculationRequest
  ): Promise<CalculationResult> {
    const fetch = (await import('node-fetch')).default;
    
    try {
      const response = await fetch(`${this.regCalculatorUrl}/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario_id: request.scenario_id,
          portfolio_id: request.portfolio_id,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        status: data.status === 'success' ? 'success' : 'error',
        outputs: data.outputs,
        error: data.error,
      };
    } catch (error: any) {
      return {
        status: 'error',
        error: error.message,
      };
    }
  }

  /**
   * Execute calculation directly (exposed for queue)
   */
  async executeCalculationDirect(
    request: CalculationRequest
  ): Promise<CalculationResult> {
    return this.callRegCalculatorDirect(request);
  }

  /**
   * Call reg-calculator directly (Python subprocess)
   */
  private async callRegCalculatorDirect(
    request: CalculationRequest
  ): Promise<CalculationResult> {
    const { spawn } = await import('child_process');
    const { promisify } = await import('util');

    return new Promise((resolve) => {
      // Load scenario from database
      prisma.scenario
        .findUnique({
          where: { scenarioId: request.scenario_id },
        })
        .then((scenario) => {
          if (!scenario) {
            resolve({
              status: 'error',
              error: 'Scenario not found',
            });
            return;
          }

          // For now, return mock result
          // In production, would spawn Python process:
          // const python = spawn('python', [
          //   '-m', 'apps.reg_calculator',
          //   '--scenario', JSON.stringify(scenario.scenarioData),
          //   '--portfolio', request.portfolio_id,
          // ]);

          // Mock implementation
          setTimeout(() => {
            resolve({
              status: 'success',
              outputs: {
                basel_iv_calc: {
                  cet1_ratio: 0.12,
                  capital_requirement: 45000,
                  capital_surplus: 5000,
                },
                lcr_calc: {
                  lcr: 1.25,
                  hqla: 200000,
                  net_cash_outflows_30d: 160000,
                },
              },
            });
          }, 2000); // Simulate 2 second calculation
        });
    });
  }

  /**
   * Update calculation status
   */
  private async updateCalculationStatus(
    calculationId: string,
    status: CalculationStatus,
    data: {
      results?: any;
      errorMessage?: string;
      startedAt?: Date;
      completedAt?: Date;
    }
  ): Promise<void> {
    await prisma.calculation.update({
      where: { calculationId },
      data: {
        status,
        ...(data.results && { results: data.results }),
        ...(data.errorMessage && { errorMessage: data.errorMessage }),
        ...(data.startedAt && { startedAt: data.startedAt }),
        ...(data.completedAt && { completedAt: data.completedAt }),
      },
    });
  }

  /**
   * Cancel calculation
   */
  async cancelCalculation(calculationId: string): Promise<boolean> {
    const calculation = await prisma.calculation.findUnique({
      where: { calculationId },
    });

    if (!calculation) {
      return false;
    }

    if (calculation.status === 'PENDING' || calculation.status === 'RUNNING') {
      // Cancel job in queue if using queue
      if (process.env.USE_QUEUE === 'true') {
        const { cancelCalculationJob } = await import('./queue');
        await cancelCalculationJob(calculationId);
      }

      await prisma.calculation.update({
        where: { calculationId },
        data: {
          status: 'CANCELLED',
          completedAt: new Date(),
        },
      });
      return true;
    }

    return false;
  }

  /**
   * Get calculation status
   */
  async getCalculationStatus(calculationId: string) {
    return prisma.calculation.findUnique({
      where: { calculationId },
    });
  }
}

export const calculationService = new CalculationService();

