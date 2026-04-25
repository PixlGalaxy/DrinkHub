import { useCallback, useRef, useState } from 'react';
import type { WsStatus } from '../types';

function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

type Handler = (data: Record<string, unknown>) => void;

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<WsStatus>('idle');
  const handlers = useRef<Map<string, Handler>>(new Map());
  const pendingMessages = useRef<object[]>([]);

  const on = useCallback((type: string, handler: Handler) => {
    handlers.current.set(type, handler);
  }, []);

  const off = useCallback((type: string) => {
    handlers.current.delete(type);
  }, []);

  const send = useCallback((message: object) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      pendingMessages.current.push(message);
    }
  }, []);

  const connect = useCallback(() => {
    // Idempotent: don't open a second socket if one is already open or connecting
    if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) {
      return;
    }
    setStatus('connecting');
    const socket = new WebSocket(getWsUrl());
    ws.current = socket;

    socket.onopen = () => {
      // Only update if this is still the current socket
      if (ws.current !== socket) return;
      setStatus('connected');
      pendingMessages.current.forEach(msg => socket.send(JSON.stringify(msg)));
      pendingMessages.current = [];
    };

    socket.onclose = () => {
      if (ws.current !== socket) return;
      setStatus('disconnected');
    };

    socket.onerror = () => {
      if (ws.current !== socket) return;
      setStatus('error');
    };

    socket.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data) as Record<string, unknown>;
        const type = msg.type as string;
        const typeHandler = handlers.current.get(type);
        if (typeHandler) typeHandler(msg);
        const wildcard = handlers.current.get('*');
        if (wildcard) wildcard(msg);
      } catch {
        // ignore malformed messages
      }
    };
  }, []);

  const disconnect = useCallback(() => {
    if (ws.current) {
      const socket = ws.current;
      ws.current = null;
      socket.close();
    }
    pendingMessages.current = [];
    setStatus('idle');
  }, []);

  // No automatic cleanup. The caller manages disconnect() explicitly to avoid
  // StrictMode double-mount killing a connection that hasn't finished its handshake.
  // The browser will GC any orphaned sockets when the tab closes.

  return { connect, disconnect, send, on, off, status };
}
