import { useCallback, useEffect, useRef, useState } from 'react';
import type { WsStatus } from '../types';
import { loadToken, saveToken } from '../session';

type Handler = (data: Record<string, unknown>) => void;

/** App-level ping interval (browsers can't see protocol pings from JS). */
const PING_EVERY_MS = 10_000;
/** No message for this long means the socket is a zombie. */
const DEAD_AFTER_MS = 25_000;
/** After the tab comes back, the socket must answer within this time. */
const RESUME_CHECK_MS = 3_500;
/** Actions queued while offline are dropped if older than this. */
const QUEUE_MAX_AGE_MS = 10_000;

const CLOSE_REPLACED = 4001;
const CLOSE_RATE_LIMITED = 4029;

function wsUrl(slug: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/${slug}/ws`;
}

function backoff(attempt: number): number {
  const base = Math.min(500 * Math.pow(1.6, attempt), 8000);
  return base / 2 + Math.random() * (base / 2);
}

/**
 * Resilient game socket.
 *
 * Mobile browsers freeze tabs when the phone locks, and the socket usually
 * dies without the page noticing. This hook:
 *  - identifies with a stored session token so the server resumes the seat,
 *  - pings every 10s and drops sockets that stop answering,
 *  - reconnects immediately when the page becomes visible / comes online,
 *  - backs off with jitter so a whole table reconnecting at once is fine,
 *  - stops fighting when another tab takes over the same session.
 */
export function useWebSocket(slug: string) {
  const ws = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<WsStatus>('idle');
  const handlers = useRef<Map<string, Handler>>(new Map());
  const queue = useRef<{ msg: object; at: number }[]>([]);
  const attempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMessageAt = useRef(0);
  const wanted = useRef(false);
  const connectRef = useRef<() => void>(() => {});

  const on = useCallback((type: string, handler: Handler) => {
    handlers.current.set(type, handler);
  }, []);

  const off = useCallback((type: string) => {
    handlers.current.delete(type);
  }, []);

  const clearTimers = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    if (pingTimer.current) clearInterval(pingTimer.current);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    reconnectTimer.current = pingTimer.current = resumeTimer.current = null;
  }, []);

  const send = useCallback((message: object) => {
    const socket = ws.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    } else {
      queue.current.push({ msg: message, at: Date.now() });
    }
  }, []);

  /** Drops the current socket (if any) and schedules a new one. */
  const scheduleReconnect = useCallback((delay: number) => {
    if (!wanted.current) return;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    reconnectTimer.current = setTimeout(() => connectRef.current(), delay);
  }, []);

  const forceReconnect = useCallback(() => {
    const socket = ws.current;
    ws.current = null;
    clearTimers();
    if (socket) {
      socket.onopen = socket.onclose = socket.onerror = socket.onmessage = null;
      try { socket.close(); } catch { /* already closed */ }
    }
    attempts.current = 0;
    setStatus('connecting');
    scheduleReconnect(0);
  }, [clearTimers, scheduleReconnect]);

  const connect = useCallback(() => {
    wanted.current = true;
    const current = ws.current;
    if (current && (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING)) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setStatus('disconnected');
      return; // the 'online' listener will retry
    }

    setStatus('connecting');
    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl(slug));
    } catch {
      setStatus('error');
      scheduleReconnect(backoff(attempts.current++));
      return;
    }
    ws.current = socket;

    socket.onopen = () => {
      if (ws.current !== socket) return;
      lastMessageAt.current = Date.now();
      const hello: Record<string, unknown> = { type: 'hello' };
      const token = loadToken();
      if (token) hello.token = token;
      socket.send(JSON.stringify(hello));

      const now = Date.now();
      for (const { msg, at } of queue.current) {
        if (now - at < QUEUE_MAX_AGE_MS) socket.send(JSON.stringify(msg));
      }
      queue.current = [];

      if (pingTimer.current) clearInterval(pingTimer.current);
      pingTimer.current = setInterval(() => {
        if (ws.current !== socket) return;
        if (Date.now() - lastMessageAt.current > DEAD_AFTER_MS) {
          forceReconnect();
          return;
        }
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping', t: Date.now() }));
      }, PING_EVERY_MS);
    };

    socket.onclose = (event: CloseEvent) => {
      if (ws.current !== socket) return;
      ws.current = null;
      clearTimers();
      if (!wanted.current) {
        setStatus('idle');
        return;
      }
      if (event.code === CLOSE_REPLACED) {
        // Same session opened in another tab/window. Don't fight over it;
        // we take it back when this tab becomes visible again.
        setStatus('replaced');
        return;
      }
      setStatus('disconnected');
      const delay = event.code === CLOSE_RATE_LIMITED ? 5000 + backoff(attempts.current) : backoff(attempts.current);
      attempts.current++;
      scheduleReconnect(delay);
    };

    socket.onerror = () => {
      // onclose follows and handles the retry.
    };

    socket.onmessage = (event: MessageEvent) => {
      if (ws.current !== socket) return;
      lastMessageAt.current = Date.now();
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      const type = msg.type as string;
      if (type === 'pong') return;
      if (type === 'session' && typeof msg.token === 'string') {
        saveToken(msg.token);
        return;
      }
      if (type === 'welcome') {
        attempts.current = 0;
        setStatus('connected');
      }
      handlers.current.get(type)?.(msg);
      handlers.current.get('*')?.(msg);
    };
  }, [slug, clearTimers, forceReconnect, scheduleReconnect]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    wanted.current = false;
    clearTimers();
    attempts.current = 0;
    const socket = ws.current;
    ws.current = null;
    if (socket) {
      socket.onopen = socket.onclose = socket.onerror = socket.onmessage = null;
      try { socket.close(); } catch { /* already closed */ }
    }
    queue.current = [];
    setStatus('idle');
  }, [clearTimers]);

  /** Reconnect right away (e.g. a "retry" button). */
  const reconnectNow = useCallback(() => {
    wanted.current = true;
    forceReconnect();
  }, [forceReconnect]);

  // Coming back from a locked phone / background tab / network change.
  useEffect(() => {
    const wake = () => {
      if (!wanted.current) return;
      if (document.visibilityState === 'hidden') return;
      const socket = ws.current;
      if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
        attempts.current = 0;
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        connectRef.current();
        return;
      }
      if (socket.readyState !== WebSocket.OPEN) return;
      // The socket claims to be open, but after a sleep it is often dead.
      // Ask for a pong + fresh state and reconnect if nothing comes back.
      const probeAt = Date.now();
      socket.send(JSON.stringify({ type: 'ping', t: probeAt }));
      socket.send(JSON.stringify({ type: 'sync' }));
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      resumeTimer.current = setTimeout(() => {
        if (ws.current === socket && lastMessageAt.current < probeAt) forceReconnect();
      }, RESUME_CHECK_MS);
    };
    const onOffline = () => {
      if (wanted.current) setStatus('disconnected');
    };

    document.addEventListener('visibilitychange', wake);
    window.addEventListener('pageshow', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
    window.addEventListener('offline', onOffline);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('pageshow', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('online', wake);
      window.removeEventListener('offline', onOffline);
    };
  }, [forceReconnect]);

  useEffect(() => () => disconnect(), [disconnect]);

  return { connect, disconnect, reconnectNow, send, on, off, status };
}
