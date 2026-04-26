import { useCallback, useRef, useState } from 'react';
import type { WsStatus } from '../types';

const TOKEN_COOKIE = 'drinkhub_session';

function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

function readTokenFromCookie(): string | null {
  const row = document.cookie
    .split('; ')
    .find(r => r.startsWith(TOKEN_COOKIE + '='));
  if (!row) return null;
  const value = row.split('=')[1];
  if (!value) return null;
  try {
    return decodeURIComponent(value) || null;
  } catch {
    return null;
  }
}

function persistToken(token: string) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=2592000; SameSite=Lax${secure}`;
}

type Handler = (data: Record<string, unknown>) => void;

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<WsStatus>('idle');
  const handlers = useRef<Map<string, Handler>>(new Map());
  const pendingMessages = useRef<object[]>([]);
  const sessionToken = useRef<string | null>(readTokenFromCookie());
  const reconnectAttempts = useRef<number>(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalClose = useRef<boolean>(false);

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
    if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) {
      return;
    }
    intentionalClose.current = false;
    setStatus('connecting');
    const socket = new WebSocket(getWsUrl());
    ws.current = socket;

    socket.onopen = () => {
      if (ws.current !== socket) return;
      reconnectAttempts.current = 0;
      setStatus('connected');
      const identifyMsg: Record<string, unknown> = { type: 'identify' };
      if (sessionToken.current) identifyMsg.token = sessionToken.current;
      socket.send(JSON.stringify(identifyMsg));
      pendingMessages.current.forEach(msg => socket.send(JSON.stringify(msg)));
      pendingMessages.current = [];
    };

    socket.onclose = () => {
      if (ws.current !== socket) return;
      ws.current = null;
      if (intentionalClose.current) {
        setStatus('idle');
        return;
      }

      setStatus('disconnected');
      const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts.current), 10000);
      reconnectAttempts.current++;
      reconnectTimer.current = setTimeout(() => {
        connect();
      }, delay);
    };

    socket.onerror = () => {
      if (ws.current !== socket) return;
      setStatus('error');
    };

    socket.onmessage = (event: MessageEvent) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.data);
      } catch (err) {
        console.error('[ws] failed to parse incoming message', err);
        return;
      }
      const type = msg.type as string;
      if (type === 'session' && typeof msg.token === 'string') {
        sessionToken.current = msg.token;
        persistToken(msg.token);
        return;
      }
      const typeHandler = handlers.current.get(type);
      if (typeHandler) typeHandler(msg);
      const wildcard = handlers.current.get('*');
      if (wildcard) wildcard(msg);
    };
  }, []);

  const disconnect = useCallback(() => {
    intentionalClose.current = true;
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    reconnectAttempts.current = 0;
    if (ws.current) {
      const socket = ws.current;
      ws.current = null;
      socket.close();
    }
    pendingMessages.current = [];
    setStatus('idle');
  }, []);

  return { connect, disconnect, send, on, off, status };
}
