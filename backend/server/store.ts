import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { dataDirFor } from './config.ts';
import { createLogger } from './log.ts';
import type { Room } from './types.ts';

/**
 * One SQLite database per game (`<game>/data/<game>.db`). Rooms are stored as
 * JSON snapshots and written shortly after they change, so a restart or crash
 * loses at most `persistDelayMs` of play.
 */
export class RoomStore {
  readonly path: string;
  private db: DatabaseSync;
  private log;

  constructor(slug: string) {
    this.log = createLogger(`store:${slug}`);
    this.path = join(dataDirFor(slug), `${slug}.db`);
    this.db = new DatabaseSync(this.path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 3000;
      CREATE TABLE IF NOT EXISTS rooms (
        code       TEXT PRIMARY KEY,
        status     TEXT NOT NULL,
        data       TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS stats (
        key   TEXT PRIMARY KEY,
        value INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  loadRooms<S>(): Room<S>[] {
    const rows = this.db.prepare('SELECT code, data FROM rooms').all() as { code: string; data: string }[];
    const rooms: Room<S>[] = [];
    for (const row of rows) {
      try {
        rooms.push(JSON.parse(row.data) as Room<S>);
      } catch (err) {
        this.log.warn(`dropping unreadable room ${row.code}`, err);
        this.deleteRoom(row.code);
      }
    }
    return rooms;
  }

  saveRooms(rooms: Room[]) {
    if (!rooms.length) return;
    const stmt = this.db.prepare(
      `INSERT INTO rooms (code, status, data, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(code) DO UPDATE SET status = excluded.status, data = excluded.data, updated_at = excluded.updated_at`,
    );
    this.db.exec('BEGIN');
    try {
      for (const room of rooms) stmt.run(room.code, room.status, JSON.stringify(room), room.updatedAt);
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  deleteRoom(code: string) {
    this.db.prepare('DELETE FROM rooms WHERE code = ?').run(code);
  }

  increment(key: string, by = 1) {
    this.db
      .prepare('INSERT INTO stats (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = value + excluded.value')
      .run(key, by);
  }

  stats(): Record<string, number> {
    const rows = this.db.prepare('SELECT key, value FROM stats').all() as { key: string; value: number }[];
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }

  close() {
    this.db.close();
  }
}
