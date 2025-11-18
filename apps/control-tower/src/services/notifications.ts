/**
 * Notification service
 */

import { io, Socket } from 'socket.io-client';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: any;
}

class NotificationService {
  private notifications: Notification[] = [];
  private listeners: ((notifications: Notification[]) => void)[] = [];
  private socket: Socket | null = null;

  constructor() {
    // Load from localStorage
    const stored = localStorage.getItem('notifications');
    if (stored) {
      this.notifications = JSON.parse(stored).map((n: any) => ({
        ...n,
        timestamp: new Date(n.timestamp),
      }));
    }
  }

  connect(token: string, wsUrl: string) {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(wsUrl, {
      auth: { token },
      transports: ['websocket'],
    });

    this.socket.on('notification', (notification: any) => {
      this.addNotification({
        id: `notif_${Date.now()}`,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        timestamp: new Date(),
        read: false,
        data: notification.data,
      });
    });
  }

  addNotification(notification: Notification) {
    this.notifications.unshift(notification);
    this.notifications = this.notifications.slice(0, 100); // Keep last 100
    this.save();
    this.notifyListeners();
  }

  markAsRead(id: string) {
    const notification = this.notifications.find((n) => n.id === id);
    if (notification) {
      notification.read = true;
      this.save();
      this.notifyListeners();
    }
  }

  markAllAsRead() {
    this.notifications.forEach((n) => (n.read = true));
    this.save();
    this.notifyListeners();
  }

  removeNotification(id: string) {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.save();
    this.notifyListeners();
  }

  getUnreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  getAll(): Notification[] {
    return this.notifications;
  }

  subscribe(listener: (notifications: Notification[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener([...this.notifications]));
  }

  private save() {
    localStorage.setItem('notifications', JSON.stringify(this.notifications));
  }
}

export const notificationService = new NotificationService();

