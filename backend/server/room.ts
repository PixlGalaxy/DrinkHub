import { config } from './config.ts';
import type { Player, Presence, Room } from './types.ts';

// ── Presence ────────────────────────────────────────────────────────────────

export function presenceOf(player: Player, now: number): Presence {
  if (player.connected) return 'online';
  return now - player.lastSeenAt < config.awayAfterMs ? 'reconnecting' : 'away';
}

/** Online or only briefly disconnected: still counts for turns and votes. */
export function isPresent(player: Player, now: number): boolean {
  return presenceOf(player, now) !== 'away';
}

export function presentPlayers(room: Room, now: number): Player[] {
  return room.players.filter(p => isPresent(p, now));
}

export function findPlayer(room: Room, playerId: string): Player | undefined {
  return room.players.find(p => p.id === playerId);
}

export function hostOf(room: Room): Player | undefined {
  return room.players.find(p => p.isHost);
}

// ── Host ────────────────────────────────────────────────────────────────────

/**
 * Hands the host role to someone present when the host is away (or gone), so
 * a locked phone can't freeze the lobby. Returns true if it changed.
 */
export function ensureHost(room: Room, now: number): boolean {
  const host = hostOf(room);
  if (host && isPresent(host, now)) return false;
  const next = room.players.find(p => p.connected) ?? room.players.find(p => isPresent(p, now));
  if (!next) {
    // Nobody around: keep (or assign) a host so the room still has one.
    if (host || !room.players[0]) return false;
    room.players[0].isHost = true;
    return true;
  }
  if (host) host.isHost = false;
  next.isHost = true;
  return true;
}

// ── Turn order ──────────────────────────────────────────────────────────────
// Turns are tracked by player id against a fixed seating order. The old
// backend used an index into the list of *connected* players, so any
// disconnect shifted the turn onto someone else.

export interface TurnState {
  turnOrder: string[];
  currentTurn: string | null;
}

/**
 * Next seat after `fromId` (in seating order) whose player is present. If
 * everyone is away it still rotates to the next seated player, so the game is
 * never stuck.
 */
export function nextTurn(room: Room, turns: TurnState, fromId: string | null, now: number): string | null {
  const order = turns.turnOrder;
  const start = fromId ? order.indexOf(fromId) : -1;
  let fallback: string | null = null;
  for (let step = 1; step <= order.length; step++) {
    const id = order[(start + step) % order.length]!;
    const player = findPlayer(room, id);
    if (!player) continue;
    if (isPresent(player, now)) return id;
    fallback ??= id;
  }
  return fallback;
}

/**
 * Drops a seat from the order (call after removing the player from the room),
 * passing the turn on if it was theirs.
 */
export function removeFromTurns(room: Room, turns: TurnState, playerId: string, now: number) {
  if (turns.currentTurn === playerId) turns.currentTurn = nextTurn(room, turns, playerId, now);
  turns.turnOrder = turns.turnOrder.filter(id => id !== playerId);
}

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
