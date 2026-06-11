import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8000';

export const useSocket = (roomCode: string | null) => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!roomCode) return;

    const token = localStorage.getItem('think_type_token');
    if (!token) return;

    // Connect to socket.io server
    const socket = io(WS_URL, {
      transports: ['websocket'],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to socket server');
      // Automatically join room after connecting
      socket.emit('join_room', { room_code: roomCode.toUpperCase(), token });
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    socket.on('error', (errMsg) => {
      console.error('Socket business error:', errMsg);
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [roomCode]);

  const emit = useCallback((event: string, data: any) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('Socket not connected. Cannot emit:', event);
    }
  }, []);

  const on = useCallback((event: string, callback: (...args: any[]) => void) => {
    const socket = socketRef.current;
    if (socket) {
      socket.on(event, callback);
    }
    return () => {
      if (socket) {
        socket.off(event, callback);
      }
    };
  }, []);

  const off = useCallback((event: string, callback?: (...args: any[]) => void) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  }, []);

  return {
    socket: socketRef.current,
    emit,
    on,
    off,
    isConnected: !!socketRef.current?.connected,
  };
};
