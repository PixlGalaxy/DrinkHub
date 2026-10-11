export type RoomStatus = 'lobby' | 'playing' | 'finished';

/**
 * - online:       has an open socket
 * - reconnecting: socket dropped less than AWAY_AFTER_SEC ago (locked phone,
 *                 app switch, network blip). Still counts as present.
 * - away:         disconnected for longer; skipped for turns and votes, but
 *                 the seat is kept until SEAT_TTL_SEC so they can come back.
 */
export type Presence = 'online' | 'reconnecting' | 'away';

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  /** Last time the player had an open socket (ms epoch). */
  lastSeenAt: number;
  joinedAt: number;
}

export interface Room<S = unknown> {
  code: string;
  gameId: string;
  status: RoomStatus;
  players: Player[];
  createdAt: number;
  updatedAt: number;
  /** Bumped on every change; clients drop states older than what they have. */
  version: number;
  state: S;
}

export type ActionResult = void | { error: string };

export interface ActionContext<S> {
  room: Room<S>;
  player: Player;
  data: Record<string, unknown>;
  now: number;
}

export interface GameModule<S = unknown> {
  /** Protocol id stored in rooms and sent to clients (e.g. "sipit-or-dipit"). */
  id: string;
  /** URL segment: /api/<slug>, /api/<slug>/ws, and the module's folder name. */
  slug: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;

  initialState(): S;
  /** Called when the host starts the game. Return an error to refuse. */
  start(room: Room<S>, now: number): ActionResult;
  /** Back to the lobby after a game (keeps players). */
  reset(room: Room<S>): void;

  /** Whether a new player can take a seat while status is "playing". */
  canJoinMidGame(room: Room<S>): boolean;
  onPlayerJoined?(room: Room<S>, player: Player, now: number): void;
  onPlayerRemoved?(room: Room<S>, playerId: string, now: number): void;
  /**
   * Called after presence changes and on every housekeeping tick. Lets a game
   * resolve things that were waiting on someone who went away. Return true if
   * the state changed.
   */
  onTick?(room: Room<S>, now: number): boolean;

  actions: Record<string, (ctx: ActionContext<S>) => ActionResult>;

  /** Game-specific fields merged into the room_state sent to `viewerId`. */
  view(room: Room<S>, viewerId: string, now: number): Record<string, unknown>;
  /** Extra data for GET /api/<slug>. */
  info?(): Record<string, unknown>;
}
