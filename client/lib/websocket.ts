import { useEffect, useRef, useCallback } from 'react';
import { getApiUrl } from './query-client';

interface BookingEvent {
  type: 'booking:created' | 'booking:submitted' | 'booking:approved' | 'booking:rejected';
  booking: {
    id: string;
    departmentId: string;
    candidateCount: number;
    bookingDate: string;
    status: string;
    userId: string;
  };
  timestamp: string;
}

type BookingEventHandler = (event: BookingEvent) => void;

export function useBookingWebSocket(onEvent: BookingEventHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(true);
  const onEventRef = useRef(onEvent);
  
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (!shouldReconnectRef.current) {
      return;
    }
    
    try {
      const apiUrl = getApiUrl();
      let wsUrl = apiUrl.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws';
      
      // In Replit environment, use the window location for WebSocket
      // since the proxy handles routing differently
      if (typeof window !== 'undefined' && window.location) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        // Check if we need to route to the API server
        const apiUrlObj = new URL(apiUrl);
        if (apiUrlObj.port) {
          // API has a specific port, construct WebSocket URL with that port
          wsUrl = `${protocol}//${apiUrlObj.hostname}:${apiUrlObj.port}/ws`;
        } else {
          // No port specified, use same host as page
          wsUrl = `${protocol}//${host}/ws`;
        }
      }
      
      console.log('[WebSocket] Connecting to:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
      };

      ws.onmessage = (event) => {
        if (!shouldReconnectRef.current) return;
        try {
          const data: BookingEvent = JSON.parse(event.data);
          console.log('[WebSocket] Received event:', data.type);
          onEventRef.current(data);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        wsRef.current = null;
        if (shouldReconnectRef.current) {
          console.log('[WebSocket] Reconnecting in 3s...');
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      if (shouldReconnectRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      }
    }
  }, []);

  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return wsRef;
}
