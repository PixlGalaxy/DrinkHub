import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import { config } from './config.ts';
import type { GameHub } from './hub.ts';
import { createLogger } from './log.ts';
import { clientIp, isOriginAllowed, rateLimiter, verifyToken } from './security.ts';

const log = createLogger('http');
const startedAt = Date.now();

type Params = Record<string, string>;
type Handler = (req: IncomingMessage, params: Params) => unknown;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

/** Minimal path router: `/api/:slug/rooms/:code`. */
export class Router {
  private routes: Route[] = [];

  get(path: string, handler: Handler) {
    const keys: string[] = [];
    const source = path.replace(/:(\w+)/g, (_, key: string) => {
      keys.push(key);
      return '([^/]+)';
    });
    this.routes.push({ method: 'GET', pattern: new RegExp(`^${source}/?$`), keys, handler });
  }

  match(method: string, path: string): { handler: Handler; params: Params } | null {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const m = route.pattern.exec(path);
      if (!m) continue;
      const params: Params = {};
      route.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1] ?? '')));
      return { handler: route.handler, params };
    }
    return null;
  }
}

/** Player id from `Authorization: Bearer <session token>`, if valid. */
function bearerPlayer(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return token ? verifyToken(token) : null;
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function applyCors(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  if (!origin || !isOriginAllowed(origin)) return;
  res.setHeader('Access-Control-Allow-Origin', config.allowedOrigins.includes('*') ? '*' : origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * Routes:
 *   GET /api/health               status of every game
 *   GET /api/games                list of games
 *   GET /api/<slug>               game info (+ game-specific data)
 *   GET /api/<slug>/stats         counters from the game's DB
 *   GET /api/<slug>/rooms/:code   whether a room exists / can be joined / caller has a seat
 *   WS  /api/<slug>/ws            realtime endpoint for that game
 */
export function createHttpServer(hubs: GameHub<any>[]): Server {
  const bySlug = new Map(hubs.map(h => [h.game.slug, h]));
  const router = new Router();

  router.get('/api/health', () => ({
    status: 'ok',
    uptime_sec: Math.round((Date.now() - startedAt) / 1000),
    games: Object.fromEntries(hubs.map(h => [h.game.slug, h.summary()])),
  }));

  router.get('/api/games', () => ({
    games: hubs.map(h => ({ id: h.game.id, slug: h.game.slug, name: h.game.name, path: `/api/${h.game.slug}` })),
  }));

  for (const hub of hubs) {
    const { game } = hub;
    const base = `/api/${game.slug}`;
    router.get(base, () => ({
      id: game.id,
      slug: game.slug,
      name: game.name,
      min_players: game.minPlayers,
      max_players: game.maxPlayers,
      ws: `${base}/ws`,
      ...hub.summary(),
      ...game.info?.(),
    }));
    router.get(`${base}/stats`, () => ({ ...hub.store.stats(), ...hub.summary() }));
    router.get(`${base}/rooms/:code`, (req, params) => hub.roomSummary(params.code ?? '', bearerPlayer(req)));
  }

  const server = createServer((req, res) => {
    applyCors(req, res);
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }
    if (!rateLimiter.check('http', clientIp(req))) {
      sendJson(res, 429, { error: 'Too many requests' });
      return;
    }
    const match = router.match(req.method ?? 'GET', url.pathname);
    if (!match) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }
    try {
      sendJson(res, 200, match.handler(req, match.params));
    } catch (err) {
      log.error(`${req.method} ${url.pathname} failed`, err);
      sendJson(res, 500, { error: 'Internal error' });
    }
  });

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const m = /^\/api\/([^/]+)\/ws\/?$/.exec(url.pathname);
    const hub = m ? bySlug.get(m[1]!) : undefined;
    if (!hub || !isOriginAllowed(req.headers.origin)) {
      socket.write(`HTTP/1.1 ${hub ? '403 Forbidden' : '404 Not Found'}\r\nConnection: close\r\n\r\n`);
      socket.destroy();
      return;
    }
    hub.handleUpgrade(req, socket, head);
  });

  // Keep-alive a bit longer than typical proxies so they don't hit closed sockets.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  return server;
}
