/**
 * WebSocket hook for real-time updates
 */

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export function useWebSocket(
  url: string,
  token: string | null,
  onCalculationUpdate?: (data: any) => void,
  onNotification?: (notification: any) => void
) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    // Connect to WebSocket
    const socket = io(url || import.meta.env.VITE_WS_URL || 'http://localhost:9002', {
      auth: { token },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    // Listen for calculation updates
    if (onCalculationUpdate) {
      socket.on('calculation:update', onCalculationUpdate);
    }

    // Listen for notifications
    if (onNotification) {
      socket.on('notification', onNotification);
    }

    return () => {
      socket.disconnect();
    };
  }, [url, token, onCalculationUpdate, onNotification]);

  const subscribeToCalculation = (calculationId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('subscribe:calculation', calculationId);
    }
  };

  const unsubscribeFromCalculation = (calculationId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('unsubscribe:calculation', calculationId);
    }
  };

  return {
    subscribeToCalculation,
    unsubscribeFromCalculation,
    socket: socketRef.current,
  };
}

