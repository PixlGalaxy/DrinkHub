import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BACKEND_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const envFile = join(BACKEND_ROOT, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function list(name: string, fallback: string): string[] {
  return (process.env[name] || fallback)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export const config = {
  host: process.env.HOST || '0.0.0.0',
  port: int('PORT', 8000),
  allowedOrigins: list('ALLOWED_ORIGINS', 'http://localhost:5173'),
  sessionSecret: process.env.SESSION_SECRET?.trim() || '',
  trustProxy: bool('TRUST_PROXY', true),
  logLevel: process.env.LOG_LEVEL || 'info',

  /** Server -> client WS ping interval. Sockets that miss two pings are dropped. */
  heartbeatMs: int('HEARTBEAT_SEC', 15) * 1000,
  /** How long a disconnected player shows as "reconnecting" before counting as away. */
  awayAfterMs: int('AWAY_AFTER_SEC', 30) * 1000,
  /** How long a disconnected player's seat (turn, hand, host role) is kept. */
  seatTtlMs: int('SEAT_TTL_SEC', 30 * 60) * 1000,
  /** Rooms with no activity for this long are deleted. */
  roomIdleTtlMs: int('ROOM_IDLE_TTL_SEC', 12 * 60 * 60) * 1000,
  /** Room housekeeping (presence, host handover, expiry) interval. */
  tickMs: int('TICK_MS', 5000),
  /** Max delay before a changed room is written to its game's DB. */
  persistDelayMs: int('PERSIST_DELAY_MS', 500),
  maxPayloadBytes: 16 * 1024,
};

/**
 * Where a module keeps its runtime data: `<storage>/<module>`, e.g.
 * storage/server, storage/sipitordipit, storage/pyramid. The storage root is
 * `backend/storage` unless `DATA_DIR` points elsewhere, so a single volume
 * holds everything.
 */
export function dataDirFor(module: string): string {
  const root = process.env.DATA_DIR?.trim() || join(BACKEND_ROOT, 'storage');
  const dir = join(resolve(root), module);
  mkdirSync(dir, { recursive: true });
  return dir;
}
