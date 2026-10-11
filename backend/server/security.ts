import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IncomingMessage } from 'node:http';
import { config, dataDirFor } from './config.ts';
import { createLogger } from './log.ts';

const log = createLogger('security');

// ── Session tokens ──────────────────────────────────────────────────────────
// A token is `<playerId>.<hmac>`. The player id is the stable identity of a
// seat, so as long as the client keeps its token it can resume after the
// phone locks, the tab reloads or the server restarts.

function loadSecret(): Buffer {
  if (config.sessionSecret) return Buffer.from(config.sessionSecret, 'utf8');
  const file = join(dataDirFor('server'), 'session.secret');
  try {
    if (existsSync(file)) {
      const stored = readFileSync(file, 'utf8').trim();
      if (stored.length >= 32) return Buffer.from(stored, 'utf8');
    }
    const fresh = randomBytes(48).toString('base64url');
    writeFileSync(file, fresh, { mode: 0o600 });
    log.info(`generated session secret at ${file}`);
    return Buffer.from(fresh, 'utf8');
  } catch (err) {
    log.warn('could not persist session secret; sessions will reset on restart', err);
    return randomBytes(48);
  }
}

const SECRET = loadSecret();
const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}\.[a-f0-9]{64}$/;

function sign(playerId: string): string {
  return createHmac('sha256', SECRET).update(playerId).digest('hex');
}

export function tokenFor(playerId: string): string {
  return `${playerId}.${sign(playerId)}`;
}

export function issueToken(): { playerId: string; token: string } {
  const playerId = randomBytes(16).toString('base64url');
  return { playerId, token: tokenFor(playerId) };
}

export function verifyToken(token: unknown): string | null {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return null;
  const [playerId, signature] = token.split('.') as [string, string];
  const expected = Buffer.from(sign(playerId), 'hex');
  const given = Buffer.from(signature, 'hex');
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return playerId;
}

// ── Input sanitizing ────────────────────────────────────────────────────────

const NAME_RE = /^[\p{L}\p{M}\p{N}_ \-'.]{1,20}$/u;
const ROOM_CODE_RE = /^[A-Z0-9]{4,8}$/;
const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTVWXYZ';

export function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.normalize('NFKC').replace(/\p{C}/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  return cleaned && NAME_RE.test(cleaned) ? cleaned : null;
}

export function sanitizeRoomCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return ROOM_CODE_RE.test(code) ? code : null;
}

export function generateRoomCode(taken: (code: string) => boolean): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < 6; i++) code += ROOM_CODE_CHARS[randomInt(ROOM_CODE_CHARS.length)];
    if (!taken(code)) return code;
  }
}

// ── Client IP ───────────────────────────────────────────────────────────────
// Behind nginx every socket comes from 127.0.0.1, which used to make all
// players share one rate-limit bucket. Trust the proxy headers instead.

export function clientIp(req: IncomingMessage): string {
  if (config.trustProxy) {
    const real = req.headers['x-real-ip'];
    if (typeof real === 'string' && real) return real.trim();
    const fwd = req.headers['x-forwarded-for'];
    const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // non-browser clients
  if (config.allowedOrigins.includes('*')) return true;
  return config.allowedOrigins.includes(origin);
}

// ── Rate limiting ───────────────────────────────────────────────────────────

type Limit = { max: number; windowMs: number };

export const LIMITS = {
  connect: { max: 60, windowMs: 60_000 }, // per IP; many players can share one NAT
  message: { max: 30, windowMs: 1_000 }, // per socket
  create_room: { max: 10, windowMs: 60_000 }, // per player
  join_room: { max: 20, windowMs: 60_000 }, // per player
  http: { max: 120, windowMs: 60_000 }, // per IP
} satisfies Record<string, Limit>;

export class RateLimiter {
  private buckets = new Map<string, number[]>();

  check(scope: keyof typeof LIMITS, key: string): boolean {
    const { max, windowMs } = LIMITS[scope];
    const now = Date.now();
    const id = `${scope}:${key}`;
    const hits = (this.buckets.get(id) ?? []).filter(t => t > now - windowMs);
    if (hits.length >= max) {
      this.buckets.set(id, hits);
      return false;
    }
    hits.push(now);
    this.buckets.set(id, hits);
    return true;
  }

  cleanup() {
    const now = Date.now();
    const longest = Math.max(...Object.values(LIMITS).map(l => l.windowMs));
    for (const [id, hits] of this.buckets) {
      if (!hits.length || hits[hits.length - 1]! < now - longest) this.buckets.delete(id);
    }
  }
}

export const rateLimiter = new RateLimiter();
