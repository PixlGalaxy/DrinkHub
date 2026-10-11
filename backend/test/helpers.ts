import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';

// Must run before any server module is imported (config is read at load).
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'drinkhub-test-'));
process.env.AWAY_AFTER_SEC ??= '1';
process.env.LOG_LEVEL = 'error';
process.env.ALLOWED_ORIGINS = '*';
process.env.TICK_MS = '100000'; // tests call hub.tick() explicitly

const { WebSocket } = await import('ws');
const { createHttpServer } = await import('../server/http.ts');
const { GameHub } = await import('../server/hub.ts');
const { sipitordipit } = await import('../sipitordipit/index.ts');
const { pyramid } = await import('../pyramid/index.ts');

export { GameHub, sipitordipit, pyramid };

type Msg = Record<string, any>;

export async function startServer(hubs: InstanceType<typeof GameHub<any>>[]) {
  const server = createHttpServer(hubs);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  return {
    port,
    url: (path: string) => `http://127.0.0.1:${port}${path}`,
    async close() {
      for (const h of hubs) h.shutdown();
      await new Promise<void>(r => server.close(() => r()));
    },
  };
}

export class Client {
  ws!: InstanceType<typeof WebSocket>;
  messages: Msg[] = [];
  token: string | null = null;
  playerId = '';
  closeCode: number | null = null;
  private cursor = 0;
  private waiters: { match: (m: Msg) => boolean; resolve: (m: Msg) => void }[] = [];

  static async connect(port: number, slug: string, token?: string | null): Promise<Client> {
    const c = new Client();
    await c.open(port, slug, token);
    return c;
  }

  async open(port: number, slug: string, token?: string | null) {
    this.closeCode = null;
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/api/${slug}/ws`);
    this.ws.on('message', raw => {
      const msg = JSON.parse(raw.toString()) as Msg;
      if (msg.type === 'session') {
        this.token = msg.token;
        this.playerId = msg.player_id;
      }
      this.messages.push(msg);
      this.waiters = this.waiters.filter(w => (w.match(msg) ? (w.resolve(msg), false) : true));
    });
    this.ws.on('close', code => (this.closeCode = code));
    await new Promise((resolve, reject) => {
      this.ws.once('open', resolve);
      this.ws.once('error', reject);
    });
    this.send({ type: 'hello', token: token ?? this.token ?? undefined });
    await this.next(m => m.type === 'welcome');
  }

  send(msg: Msg) {
    this.ws.send(JSON.stringify(msg));
  }

  /** Resolves with the first matching message received after `since` (default: any not yet consumed). */
  next(match: (m: Msg) => boolean, since = this.cursor, timeoutMs = 2000): Promise<Msg> {
    const idx = this.messages.findIndex((m, i) => i >= since && match(m));
    if (idx !== -1) {
      this.cursor = idx + 1;
      return Promise.resolve(this.messages[idx]!);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out waiting for message')), timeoutMs);
      this.waiters.push({
        match,
        resolve: m => {
          clearTimeout(timer);
          this.cursor = this.messages.indexOf(m) + 1;
          resolve(m);
        },
      });
    });
  }

  /** Sends and waits for the resulting room_state (or error). */
  async act(msg: Msg): Promise<Msg> {
    await sleep(20); // let earlier broadcasts land first
    const reply = this.next(m => m.type === 'room_state' || m.type === 'error', this.messages.length);
    this.send(msg);
    return reply;
  }

  lastState(): Msg | undefined {
    return this.messages.filter(m => m.type === 'room_state').at(-1);
  }

  async close() {
    if (this.ws.readyState === WebSocket.CLOSED) return;
    await new Promise(r => {
      this.ws.once('close', r);
      this.ws.close();
    });
  }

  /** Simulates a phone going to sleep: the TCP socket dies without a close frame. */
  kill() {
    this.ws.terminate();
  }
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function waitFor(cond: () => boolean, timeoutMs = 2000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('condition not met in time');
    await sleep(10);
  }
}
