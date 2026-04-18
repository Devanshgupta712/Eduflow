'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE } from '@/lib/api';

export const useSocket = (
    batchId: string | null, 
    userId: string | null = null,
    onViolation?: (data: any) => void, 
    onUnlock?: (data: any) => void,
    onNotification?: (data: any) => void
) => {
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!batchId && !userId) return;

        // Ensure we connect to the right base URL (remove /api if needed)
        const socketUrl = API_BASE.replace('/api', '');
        
        const socket = io(socketUrl, {
            path: '/socket.io',
            transports: ['websocket'],
        });

        socket.on('connect', () => {
            console.log('WS Connected');
            if (batchId) socket.emit('join_batch', batchId);
            if (userId) socket.emit('join_user_room', userId);
        });

        socket.on('violation_alert', (data) => {
            console.log('Violation Alert:', data);
            if (onViolation) onViolation(data);
        });

        socket.on('task_unlocked', (data) => {
            console.log('Task Unlocked:', data);
            if (onUnlock) onUnlock(data);
        });

        socket.on('new_notification', (data) => {
            console.log('Direct Notification:', data);
            if (onNotification) onNotification(data);
        });

        socketRef.current = socket;

        return () => {
            socket.disconnect();
        };
    }, [batchId, userId]);

    return socketRef.current;
};
