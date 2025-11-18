/**
 * Notification service for sending alerts and notifications
 */

import { emitNotification } from '../websocket/server';
import prisma from '../db/client';

interface NotificationData {
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  userId?: string;
  calculationId?: string;
  data?: any;
}

class NotificationService {
  private io: any;

  setIO(io: any) {
    this.io = io;
  }

  /**
   * Send notification to user
   */
  async sendNotification(notification: NotificationData): Promise<void> {
    if (!this.io) {
      return;
    }

    if (notification.userId) {
      // Send to specific user
      await emitNotification(this.io, notification.userId, {
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
      });
    } else if (notification.calculationId) {
      // Send to calculation creator
      const calculation = await prisma.calculation.findUnique({
        where: { calculationId: notification.calculationId },
      });

      if (calculation && calculation.createdBy) {
        await emitNotification(this.io, calculation.createdBy, {
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
        });
      }
    }
  }

  /**
   * Notify calculation completed
   */
  async notifyCalculationCompleted(calculationId: string): Promise<void> {
    await this.sendNotification({
      type: 'success',
      title: 'Calculation Completed',
      message: `Calculation ${calculationId.substring(0, 8)}... has completed successfully`,
      calculationId,
      data: { calculationId },
    });
  }

  /**
   * Notify calculation failed
   */
  async notifyCalculationFailed(calculationId: string, error: string): Promise<void> {
    await this.sendNotification({
      type: 'error',
      title: 'Calculation Failed',
      message: `Calculation ${calculationId.substring(0, 8)}... failed: ${error}`,
      calculationId,
      data: { calculationId, error },
    });
  }

  /**
   * Notify calculation started
   */
  async notifyCalculationStarted(calculationId: string): Promise<void> {
    await this.sendNotification({
      type: 'info',
      title: 'Calculation Started',
      message: `Calculation ${calculationId.substring(0, 8)}... has started`,
      calculationId,
      data: { calculationId },
    });
  }
}

export const notificationService = new NotificationService();

