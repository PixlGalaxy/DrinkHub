import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { config } from './config.ts';
import { createLogger, type Logger } from './log.ts';
import { ensureHost, findPlayer, hostOf, presenceOf, presentPlayers } from './room.ts';
import {
  clientIp,
  generateRoomCode,
  issueToken,
  rateLimiter,
  sanitizeName,
  sanitizeRoomCode,
  tokenFor,
  verifyToken,
} from './security.ts';
import { RoomStore } from './store.ts';
import type { GameModule, Player, Room } from './types.ts';

/** How long a socket may stay open without identifying itself. */
const IDENTIFY_TIMEOUT_MS = 15_000;

/** Close codes the client understands. */
export const CloseCode = {
  replaced: 4001, // same player opened a newer socket (e.g. after unlocking)
  unidentified: 4002,
  rateLimited: 4029,
  restarting: 1012,
} as const;

export const ErrorCode = {
  invalidName: 'INVALID_NAME',
  invalidCode: 'INVALID_CODE',
  roomNotFound: 'ROOM_NOT_FOUND',
  nameTaken: 'NAME_TAKEN',
  inProgress: 'GAME_IN_PROGRESS',
  roomFull: 'ROOM_FULL',
  notHost: 'NOT_HOST',
  notInRoom: 'NOT_IN_ROOM',
  notEnoughPlayers: 'NOT_ENOUGH_PLAYERS',
  rateLimited: 'RATE_LIMITED',
  invalidAction: 'INVALID_ACTION',
  internal: 'INTERNAL',
} as const;

// Messages are kept in English: the frontend matches on some of them.
const MESSAGES: Record<string, string> = {
  INVALID_NAME: 'Invalid name.',
  INVALID_CODE: 'Invalid room code.',
  ROOM_NOT_FOUND: 'Room not found.',
  NAME_TAKEN: 'Name already taken in this room.',
  GAME_IN_PROGRESS: 'Game already in progress.',
  ROOM_FULL: 'Room is full.',
  NOT_HOST: 'Only the host can do that.',
  NOT_IN_ROOM: 'You are not in a room.',
  RATE_LIMITED: 'Too many requests. Slow down.',
  INTERNAL: 'Something went wrong.',
};

interface Conn {
  ws: WebSocket;
  ip: string;
  playerId: string;
  alive: boolean;
  msgWindowStart: number;
  msgCount: number;
}

type Msg = Record<string, unknown> & { type: string };

class ClientError extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? MESSAGES[code] ?? code);
    this.code = code;
  }
}

/**
 * Realtime server for one game. Every game gets its own hub, WebSocket
 * endpoint (/api/<slug>/ws) and database; the hub owns the generic room
 * lifecycle (sessions, seats, presence, host, persistence) and delegates the
 * rules to the game module.
 */
export class GameHub<S> {
  readonly game: GameModule<S>;
  readonly store: RoomStore;
  private log: Logger;
  private wss: WebSocketServer;
  private rooms = new Map<string, Room<S>>();
  private playerRoom = new Map<string, string>();
  private sockets = new Map<string, Conn>();
  private conns = new Set<Conn>();
  private dirty = new Set<string>();
  private presenceSig = new Map<string, string>();
  private timers: NodeJS.Timeout[] = [];

  constructor(game: GameModule<S>, store?: RoomStore) {
    this.game = game;
    this.log = createLogger(game.slug);
    this.store = store ?? new RoomStore(game.slug);
    this.wss = new WebSocketServer({ noServer: true, maxPayload: config.maxPayloadBytes });
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => this.onConnection(ws, req));
    this.hydrate();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  private hydrate() {
    const now = Date.now();
    for (const room of this.store.loadRooms<S>()) {
      // Nobody has a socket right after a restart: start everyone's grace
      // period now so they can resume with their token.
      for (const p of room.players) {
        p.connected = false;
        p.lastSeenAt = Math.max(p.lastSeenAt, now);
      }
      this.rooms.set(room.code, room);
      for (const p of room.players) this.playerRoom.set(p.id, room.code);
    }
    if (this.rooms.size) this.log.info(`restored ${this.rooms.size} room(s) from ${this.store.path}`);
  }

  start() {
    this.timers.push(
      setInterval(() => this.heartbeat(), config.heartbeatMs),
      setInterval(() => this.tick(), config.tickMs),
      setInterval(() => this.flush(), config.persistDelayMs),
    );
  }

  /** Flushes to disk and asks every client to reconnect (they will resume). */
  shutdown() {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    for (const conn of this.conns) conn.ws.close(CloseCode.restarting, 'Server restarting');
    this.wss.close();
    this.flush();
    this.store.close();
  }

  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    this.wss.handleUpgrade(req, socket, head, ws => this.wss.emit('connection', ws, req));
  }

  // ── Connections ───────────────────────────────────────────────────────────

  private onConnection(ws: WebSocket, req: IncomingMessage) {
    const ip = clientIp(req);
    if (!rateLimiter.check('connect', ip)) {
      ws.close(CloseCode.rateLimited, 'Too many connections');
      return;
    }
    const conn: Conn = { ws, ip, playerId: '', alive: true, msgWindowStart: Date.now(), msgCount: 0 };
    this.conns.add(conn);

    const identifyTimer = setTimeout(() => {
      if (!conn.playerId) ws.close(CloseCode.unidentified, 'Identify first');
    }, IDENTIFY_TIMEOUT_MS);

    ws.on('pong', () => (conn.alive = true));
    ws.on('message', (raw: RawData) => {
      conn.alive = true;
      this.onMessage(conn, raw);
    });
    ws.on('error', err => this.log.debug(`socket error (${conn.playerId || ip})`, err));
    ws.on('close', () => {
      clearTimeout(identifyTimer);
      this.conns.delete(conn);
      this.onDisconnect(conn);
    });
  }

  /**
   * Browsers can't answer WS pings from JS, but they do reply at the protocol
   * level. A socket that misses two rounds is a zombie (typical after a phone
   * sleeps): terminate it so the player's presence is accurate.
   */
  private heartbeat() {
    for (const conn of this.conns) {
      if (!conn.alive) {
        conn.ws.terminate();
        continue;
      }
      conn.alive = false;
      try {
        conn.ws.ping();
      } catch {
        conn.ws.terminate();
      }
    }
  }

  private onDisconnect(conn: Conn) {
    const { playerId } = conn;
    // A newer socket for this player may already be active (the phone
    // reconnected before the old socket timed out). Only the current socket
    // is allowed to mark the player as disconnected.
    if (!playerId || this.sockets.get(playerId) !== conn) return;
    this.sockets.delete(playerId);
    const room = this.roomOf(playerId);
    const player = room && findPlayer(room, playerId);
    if (!room || !player) return;
    player.connected = false;
    player.lastSeenAt = Date.now();
    this.game.onTick?.(room, Date.now());
    this.commit(room, false);
  }

  private bindSocket(conn: Conn, playerId: string) {
    const previous = this.sockets.get(playerId);
    if (conn.playerId && conn.playerId !== playerId && this.sockets.get(conn.playerId) === conn) {
      this.sockets.delete(conn.playerId);
    }
    conn.playerId = playerId;
    this.sockets.set(playerId, conn);
    if (previous && previous !== conn) {
      previous.playerId = '';
      previous.ws.close(CloseCode.replaced, 'Replaced by a newer connection');
    }
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  private onMessage(conn: Conn, raw: RawData) {
    const now = Date.now();
    if (now - conn.msgWindowStart > 1000) {
      conn.msgWindowStart = now;
      conn.msgCount = 0;
    }
    if (++conn.msgCount > 30) return;

    let msg: Msg;
    try {
      const parsed: unknown = JSON.parse(raw.toString());
      if (!parsed || typeof parsed !== 'object' || typeof (parsed as Msg).type !== 'string') return;
      msg = parsed as Msg;
    } catch {
      return;
    }

    try {
      this.dispatch(conn, msg, now);
    } catch (err) {
      if (err instanceof ClientError) {
        this.send(conn, { type: 'error', code: err.code, message: err.message, request: msg.type });
      } else {
        this.log.error(`handler "${msg.type}" failed (player=${conn.playerId})`, err);
        this.send(conn, { type: 'error', code: ErrorCode.internal, message: MESSAGES.INTERNAL, request: msg.type });
      }
    }
  }

  private dispatch(conn: Conn, msg: Msg, now: number) {
    switch (msg.type) {
      case 'ping':
        this.send(conn, { type: 'pong', t: msg.t ?? null, server_time: now });
        return;
      case 'hello':
      case 'identify':
        this.identify(conn, msg, now);
        return;
    }

    if (!conn.playerId) throw new ClientError(ErrorCode.notInRoom, 'Identify first.');

    switch (msg.type) {
      case 'sync':
        this.sendState(conn.playerId);
        return;
      case 'create_room':
        this.createRoom(conn, msg, now);
        return;
      case 'join_room':
        this.joinRoom(conn, msg, now);
        return;
      case 'leave_room':
        this.leaveRoom(conn, now);
        return;
      case 'delete_room':
        this.deleteRoomByHost(conn);
        return;
      case 'start_game':
        this.startGame(conn, now);
        return;
      case 'restart_game':
        this.restartGame(conn);
        return;
    }

    const handler = this.game.actions[msg.type];
    if (!handler) return;
    const room = this.roomOf(conn.playerId);
    const player = room && findPlayer(room, conn.playerId);
    if (!room || !player) throw new ClientError(ErrorCode.notInRoom);
    const result = handler({ room, player, data: msg, now });
    if (result && 'error' in result) throw new ClientError(ErrorCode.invalidAction, result.error);
    this.commit(room);
  }

  private identify(conn: Conn, msg: Msg, now: number) {
    if (conn.playerId) return;
    let playerId = verifyToken(msg.token);
    let token = typeof msg.token === 'string' ? msg.token : '';
    if (!playerId) ({ playerId, token } = issueToken());
    this.bindSocket(conn, playerId);
    this.send(conn, { type: 'session', token, player_id: playerId });

    const room = this.roomOf(playerId);
    const player = room && findPlayer(room, playerId);
    if (room && player) {
      player.connected = true;
      player.lastSeenAt = now;
      ensureHost(room, now);
      this.game.onTick?.(room, now);
      this.send(conn, { type: 'welcome', player_id: playerId, room_code: room.code });
      this.commit(room, false);
    } else {
      this.send(conn, { type: 'welcome', player_id: playerId, room_code: null });
    }
  }

  private createRoom(conn: Conn, msg: Msg, now: number) {
    if (!rateLimiter.check('create_room', conn.playerId)) throw new ClientError(ErrorCode.rateLimited);
    const name = sanitizeName(msg.player_name);
    if (!name) throw new ClientError(ErrorCode.invalidName);

    this.detachFromCurrentRoom(conn.playerId, now);
    const code = generateRoomCode(c => this.rooms.has(c));
    const host: Player = { id: conn.playerId, name, isHost: true, connected: true, lastSeenAt: now, joinedAt: now };
    const room: Room<S> = {
      code,
      gameId: this.game.id,
      status: 'lobby',
      players: [host],
      createdAt: now,
      updatedAt: now,
      version: 0,
      state: this.game.initialState(),
    };
    this.rooms.set(code, room);
    this.playerRoom.set(conn.playerId, code);
    this.store.increment('rooms_created');
    this.log.info(`room ${code} created`);
    this.commit(room);
  }

  private joinRoom(conn: Conn, msg: Msg, now: number) {
    if (!rateLimiter.check('join_room', conn.playerId)) throw new ClientError(ErrorCode.rateLimited);
    const code = sanitizeRoomCode(msg.room_code);
    if (!code) throw new ClientError(ErrorCode.invalidCode);
    const name = sanitizeName(msg.player_name);
    if (!name) throw new ClientError(ErrorCode.invalidName);
    const room = this.rooms.get(code);
    if (!room || (typeof msg.game_id === 'string' && msg.game_id && msg.game_id !== this.game.id)) {
      throw new ClientError(ErrorCode.roomNotFound);
    }

    let player = findPlayer(room, conn.playerId);
    if (!player) {
      const sameName = room.players.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (sameName) {
        if (sameName.connected) throw new ClientError(ErrorCode.nameTaken);
        // The seat's owner lost their session (private tab closed, cleared
        // storage, new device). Let them take it back by name: re-issue the
        // seat's token to this socket so turns, hand and host role carry over.
        this.detachFromCurrentRoom(conn.playerId, now);
        this.bindSocket(conn, sameName.id);
        this.send(conn, { type: 'session', token: tokenFor(sameName.id), player_id: sameName.id });
        player = sameName;
        this.log.info(`room ${code}: "${name}" reclaimed their seat`);
      } else {
        if (room.status !== 'lobby' && !this.game.canJoinMidGame(room)) throw new ClientError(ErrorCode.inProgress);
        if (room.players.length >= this.game.maxPlayers) throw new ClientError(ErrorCode.roomFull);
        this.detachFromCurrentRoom(conn.playerId, now);
        player = { id: conn.playerId, name, isHost: false, connected: true, lastSeenAt: now, joinedAt: now };
        room.players.push(player);
        this.game.onPlayerJoined?.(room, player, now);
      }
    }

    player.connected = true;
    player.lastSeenAt = now;
    this.playerRoom.set(player.id, room.code);
    ensureHost(room, now);
    this.game.onTick?.(room, now);
    this.commit(room);
  }

  private leaveRoom(conn: Conn, now: number) {
    const room = this.roomOf(conn.playerId);
    if (room) this.removeSeat(room, conn.playerId, now);
    this.playerRoom.delete(conn.playerId);
    this.send(conn, { type: 'left_room' });
  }

  private deleteRoomByHost(conn: Conn) {
    const room = this.requireRoom(conn.playerId);
    if (hostOf(room)?.id !== conn.playerId) throw new ClientError(ErrorCode.notHost);
    this.deleteRoom(room, 'deleted_by_host');
  }

  private startGame(conn: Conn, now: number) {
    const room = this.requireRoom(conn.playerId);
    if (hostOf(room)?.id !== conn.playerId) throw new ClientError(ErrorCode.notHost, 'Only the host can start the game.');
    if (room.status === 'playing') return;
    const needed = this.game.minPlayers;
    if (presentPlayers(room, now).length < needed) {
      throw new ClientError(ErrorCode.notEnoughPlayers, `Need at least ${needed} players to start.`);
    }
    const result = this.game.start(room, now);
    if (result && 'error' in result) throw new ClientError(ErrorCode.invalidAction, result.error);
    room.status = 'playing';
    this.store.increment('games_started');
    this.commit(room);
  }

  private restartGame(conn: Conn) {
    const room = this.requireRoom(conn.playerId);
    if (room.status !== 'finished') return;
    this.game.reset(room);
    room.status = 'lobby';
    this.commit(room);
  }

  // ── Rooms ─────────────────────────────────────────────────────────────────

  private roomOf(playerId: string): Room<S> | undefined {
    const code = this.playerRoom.get(playerId);
    return code ? this.rooms.get(code) : undefined;
  }

  private requireRoom(playerId: string): Room<S> {
    const room = this.roomOf(playerId);
    if (!room) throw new ClientError(ErrorCode.notInRoom);
    return room;
  }

  /** A player is in at most one room per game; joining another frees the old seat. */
  private detachFromCurrentRoom(playerId: string, now: number) {
    const room = this.roomOf(playerId);
    if (room) this.removeSeat(room, playerId, now);
    this.playerRoom.delete(playerId);
  }

  private removeSeat(room: Room<S>, playerId: string, now: number) {
    if (!findPlayer(room, playerId)) return;
    room.players = room.players.filter(p => p.id !== playerId);
    if (this.playerRoom.get(playerId) === room.code) this.playerRoom.delete(playerId);
    if (!room.players.length) {
      this.deleteRoom(room, 'empty');
      return;
    }
    this.game.onPlayerRemoved?.(room, playerId, now);
    ensureHost(room, now);
    this.game.onTick?.(room, now);
    this.commit(room);
  }

  private deleteRoom(room: Room<S>, reason: string) {
    for (const p of room.players) {
      const conn = this.sockets.get(p.id);
      if (conn) this.send(conn, { type: 'room_deleted', reason });
      if (this.playerRoom.get(p.id) === room.code) this.playerRoom.delete(p.id);
    }
    this.rooms.delete(room.code);
    this.dirty.delete(room.code);
    this.presenceSig.delete(room.code);
    this.store.deleteRoom(room.code);
    this.log.info(`room ${room.code} deleted (${reason})`);
  }

  /** Records a change: bumps the version, schedules a save and broadcasts. */
  private commit(room: Room<S>, activity = true) {
    const now = Date.now();
    room.version++;
    if (activity) room.updatedAt = now;
    this.presenceSig.set(room.code, this.signature(room, now));
    this.dirty.add(room.code);
    this.broadcast(room);
  }

  private signature(room: Room<S>, now: number): string {
    return room.players.map(p => `${p.id}:${presenceOf(p, now)}:${p.isHost ? 1 : 0}`).join('|');
  }

  /**
   * Housekeeping: presence transitions (reconnecting → away), host handover,
   * releasing abandoned seats, expiring idle rooms and letting the game
   * resolve anything that was waiting on an absent player.
   */
  tick(now = Date.now()) {
    for (const room of [...this.rooms.values()]) {
      if (now - room.updatedAt > config.roomIdleTtlMs) {
        this.deleteRoom(room, 'expired');
        continue;
      }
      const abandoned = room.players.filter(p => !p.connected && now - p.lastSeenAt > config.seatTtlMs);
      for (const p of abandoned) this.removeSeat(room, p.id, now);
      if (!this.rooms.has(room.code)) continue;

      let changed = ensureHost(room, now);
      changed = (this.game.onTick?.(room, now) ?? false) || changed;
      if (changed || this.signature(room, now) !== this.presenceSig.get(room.code)) this.commit(room, changed);
    }
    rateLimiter.cleanup();
  }

  flush() {
    if (!this.dirty.size) return;
    const rooms = [...this.dirty].map(code => this.rooms.get(code)).filter((r): r is Room<S> => !!r);
    this.dirty.clear();
    try {
      this.store.saveRooms(rooms);
    } catch (err) {
      this.log.error('failed to persist rooms', err);
      for (const r of rooms) this.dirty.add(r.code);
    }
  }

  // ── Output ────────────────────────────────────────────────────────────────

  private send(conn: Conn, msg: Record<string, unknown>) {
    if (conn.ws.readyState !== WebSocket.OPEN) return;
    try {
      conn.ws.send(JSON.stringify(msg));
    } catch (err) {
      this.log.debug(`send failed (${conn.playerId})`, err);
    }
  }

  private sendState(playerId: string) {
    const conn = this.sockets.get(playerId);
    const room = this.roomOf(playerId);
    if (!conn) return;
    if (!room) {
      this.send(conn, { type: 'welcome', player_id: playerId, room_code: null });
      return;
    }
    this.send(conn, this.stateFor(room, playerId, Date.now()));
  }

  private broadcast(room: Room<S>) {
    const now = Date.now();
    for (const p of room.players) {
      const conn = this.sockets.get(p.id);
      if (conn) this.send(conn, this.stateFor(room, p.id, now));
    }
  }

  stateFor(room: Room<S>, viewerId: string, now: number): Record<string, unknown> {
    const host = hostOf(room);
    return {
      type: 'room_state',
      version: room.version,
      server_time: now,
      room_code: room.code,
      game_id: room.gameId,
      status: room.status,
      host_id: host?.id ?? '',
      host_name: host?.name ?? '',
      viewer_id: viewerId,
      players: room.players.map(p => {
        const presence = presenceOf(p, now);
        return { id: p.id, name: p.name, is_host: p.isHost, is_connected: presence !== 'away', presence };
      }),
      // Defaults for fields every client type expects; games override them.
      current_player_id: '',
      current_player_name: '',
      current_card: null,
      card_drawn: false,
      card_revealed: false,
      active_rules: [],
      deck_remaining: 0,
      ...this.game.view(room, viewerId, now),
    };
  }

  // ── Introspection (REST) ──────────────────────────────────────────────────

  summary() {
    let online = 0;
    for (const room of this.rooms.values()) online += room.players.filter(p => p.connected).length;
    return { rooms: this.rooms.size, players_online: online };
  }

  /**
   * Public room info. With the caller's player id it also says whether they
   * still hold a seat there, so the lobby only offers "reconnect" when it
   * will actually work.
   */
  roomSummary(rawCode: string, playerId?: string | null) {
    const code = sanitizeRoomCode(rawCode);
    const room = code ? this.rooms.get(code) : undefined;
    if (!room) return { exists: false, seat: false };
    return {
      exists: true,
      seat: playerId ? !!findPlayer(room, playerId) : null,
      status: room.status,
      players: room.players.length,
      max_players: this.game.maxPlayers,
      joinable:
        room.players.length < this.game.maxPlayers && (room.status === 'lobby' || this.game.canJoinMidGame(room)),
    };
  }

  /** For tests. */
  getRoom(code: string) {
    return this.rooms.get(code);
  }
}
