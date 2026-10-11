/**
 * Storage that never throws.
 *
 * Private/incognito modes (old iOS Safari in particular) throw on
 * localStorage/sessionStorage writes, and some block cookies. The old code
 * called sessionStorage.setItem unguarded, so creating or joining a room
 * crashed in private tabs. Every read/write here falls back through
 * localStorage → sessionStorage → cookie → memory.
 */

const memory = new Map<string, string>();

function tryStorage(kind: 'localStorage' | 'sessionStorage'): Storage | null {
  try {
    const s = window[kind];
    const probe = '__dh_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

const stores = [tryStorage('localStorage'), tryStorage('sessionStorage')].filter((s): s is Storage => !!s);

function readCookie(key: string): string | null {
  try {
    const row = document.cookie.split('; ').find(r => r.startsWith(`${key}=`));
    return row ? decodeURIComponent(row.slice(key.length + 1)) || null : null;
  } catch {
    return null;
  }
}

function writeCookie(key: string, value: string | null) {
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = value === null
      ? `${key}=; path=/; max-age=0; SameSite=Lax${secure}`
      : `${key}=${encodeURIComponent(value)}; path=/; max-age=2592000; SameSite=Lax${secure}`;
  } catch { /* cookies blocked */ }
}

export const safeStorage = {
  get(key: string): string | null {
    for (const s of stores) {
      try {
        const v = s.getItem(key);
        if (v !== null) return v;
      } catch { /* ignore */ }
    }
    return readCookie(key) ?? memory.get(key) ?? null;
  },
  set(key: string, value: string) {
    memory.set(key, value);
    for (const s of stores) {
      try { s.setItem(key, value); } catch { /* ignore */ }
    }
  },
  remove(key: string) {
    memory.delete(key);
    for (const s of stores) {
      try { s.removeItem(key); } catch { /* ignore */ }
    }
  },
  getJson<T>(key: string): T | null {
    const raw = this.get(key);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  },
  setJson(key: string, value: unknown) {
    this.set(key, JSON.stringify(value));
  },
};

// ── Session token ───────────────────────────────────────────────────────────
// Kept in storage *and* a cookie so it survives whichever one the browser
// clears; the server re-issues it if it's lost, and a player can still take
// their seat back by joining with the same name.

const TOKEN_KEY = 'drinkhub_session';

export function loadToken(): string | null {
  return safeStorage.get(TOKEN_KEY);
}

export function saveToken(token: string) {
  safeStorage.set(TOKEN_KEY, token);
  writeCookie(TOKEN_KEY, token);
}

// ── Active room per game (for "reconnect" banners and reloads) ──────────────

export type StoredRoom = { roomCode: string; playerName: string; gameId: string };

export function loadRoom(key: string): StoredRoom | null {
  const s = safeStorage.getJson<StoredRoom>(key);
  return s && typeof s.roomCode === 'string' && typeof s.playerName === 'string' ? s : null;
}

export function saveRoom(key: string, room: StoredRoom) {
  safeStorage.setJson(key, room);
}

export function clearRoom(key: string) {
  safeStorage.remove(key);
}
