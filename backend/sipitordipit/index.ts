import { findPlayer, isPresent, nextTurn, presenceOf, removeFromTurns, shuffle, type TurnState } from '../server/room.ts';
import type { ActionContext, ActionResult, GameModule, Room } from '../server/types.ts';
import { ALL_CARDS, CHALLENGE_CARDS, PENALTY_CARDS, RULE_CARDS, TRUTH_CARDS, type Card } from './cards.ts';

const CARDS_BY_ID = new Map(ALL_CARDS.map(c => [c.id, c]));

export interface ActiveRule {
  cardId: string;
  roundsRemaining: number;
}

export interface SipState extends TurnState {
  /** Card ids; resolved against cards.ts when sent to clients. */
  deck: string[];
  discard: string[];
  currentCard: string | null;
  cardDrawn: boolean;
  cardRevealed: boolean;
  activeRules: ActiveRule[];
  round: number;
}

type Ctx = ActionContext<SipState>;
type SipRoom = Room<SipState>;

function initialState(): SipState {
  return {
    turnOrder: [],
    currentTurn: null,
    deck: [],
    discard: [],
    currentCard: null,
    cardDrawn: false,
    cardRevealed: false,
    activeRules: [],
    round: 0,
  };
}

function requireTurn({ room, player }: Ctx): ActionResult {
  if (room.status !== 'playing') return { error: 'The game has not started.' };
  if (room.state.currentTurn !== player.id) return { error: "It's not your turn." };
}

/** Ends the current turn. `apply` is false when the turn was skipped. */
function advance(room: SipRoom, now: number, apply: boolean) {
  const s = room.state;
  const card = s.currentCard ? CARDS_BY_ID.get(s.currentCard) : undefined;
  if (card && apply && card.type === 'rule' && card.rounds) {
    s.activeRules.push({ cardId: card.id, roundsRemaining: card.rounds });
  }
  if (s.currentCard) s.discard.push(s.currentCard);
  s.currentCard = null;
  s.cardDrawn = false;
  s.cardRevealed = false;
  s.currentTurn = nextTurn(room, s, s.currentTurn, now);
  s.round++;
  s.activeRules = s.activeRules.filter(r => r.roundsRemaining > 0);
  for (const rule of s.activeRules) rule.roundsRemaining--;
}

function canSkip(room: SipRoom, viewerId: string, now: number): boolean {
  if (room.status !== 'playing' || !room.state.currentTurn || room.state.currentTurn === viewerId) return false;
  const viewer = findPlayer(room, viewerId);
  if (viewer?.isHost) return true;
  const current = findPlayer(room, room.state.currentTurn);
  return !current || !isPresent(current, now);
}

export const sipitordipit: GameModule<SipState> = {
  id: 'sipit-or-dipit',
  slug: 'sipitordipit',
  name: 'SipIt Or DipIt',
  minPlayers: 2,
  maxPlayers: 16,

  initialState,

  start(room, now) {
    const s = room.state;
    Object.assign(s, initialState());
    s.turnOrder = shuffle(room.players.map(p => p.id));
    s.currentTurn = nextTurn(room, s, null, now);
    s.deck = shuffle(ALL_CARDS.map(c => c.id));
    s.round = 1;
  },

  reset(room) {
    room.state = initialState();
  },

  canJoinMidGame: () => true,

  onPlayerJoined(room, player) {
    if (room.status === 'playing' && !room.state.turnOrder.includes(player.id)) room.state.turnOrder.push(player.id);
  },

  onPlayerRemoved(room, playerId, now) {
    const s = room.state;
    const wasTurn = s.currentTurn === playerId;
    removeFromTurns(room, s, playerId, now);
    if (wasTurn && s.currentCard) {
      s.discard.push(s.currentCard);
      s.currentCard = null;
      s.cardDrawn = false;
      s.cardRevealed = false;
    }
  },

  onTick(room, now) {
    const s = room.state;
    if (room.status !== 'playing') return false;
    if (s.currentTurn && findPlayer(room, s.currentTurn)) return false;
    // Current seat no longer exists: hand the turn to the next present player.
    s.currentTurn = nextTurn(room, s, s.currentTurn, now);
    return true;
  },

  actions: {
    draw_card(ctx) {
      const denied = requireTurn(ctx);
      if (denied) return denied;
      const s = ctx.room.state;
      if (s.cardDrawn) return;
      if (!s.deck.length) {
        s.deck = shuffle(s.discard);
        s.discard = [];
      }
      const next = s.deck.shift();
      if (!next) return { error: 'No cards left.' };
      s.currentCard = next;
      s.cardDrawn = true;
      s.cardRevealed = false;
    },

    reveal_card(ctx) {
      const denied = requireTurn(ctx);
      if (denied) return denied;
      const s = ctx.room.state;
      if (s.cardDrawn) s.cardRevealed = true;
    },

    next_turn(ctx) {
      const denied = requireTurn(ctx);
      if (denied) return denied;
      advance(ctx.room, ctx.now, true);
    },

    /**
     * Lets the table move on when the current player's phone is locked or
     * they left (anyone can skip once they're away; the host can always skip).
     */
    skip_turn({ room, player, now }) {
      if (room.status !== 'playing') return;
      if (!canSkip(room, player.id, now)) return { error: 'You can only skip a player who is away.' };
      advance(room, now, false);
    },
  },

  view(room, viewerId, now) {
    const s = room.state;
    const current = s.currentTurn ? findPlayer(room, s.currentTurn) : undefined;
    const card: Card | null = s.currentCard ? (CARDS_BY_ID.get(s.currentCard) ?? null) : null;
    return {
      current_player_id: current?.id ?? '',
      current_player_name: current?.name ?? '',
      current_player_presence: current ? presenceOf(current, now) : null,
      can_skip: canSkip(room, viewerId, now),
      turn_order: s.turnOrder,
      current_card: card,
      card_drawn: s.cardDrawn,
      card_revealed: s.cardRevealed,
      round: s.round,
      active_rules: s.activeRules.flatMap(r => {
        const rule = CARDS_BY_ID.get(r.cardId);
        return rule
          ? [{ card_id: r.cardId, title: rule.title, description: rule.description, rounds_remaining: r.roundsRemaining }]
          : [];
      }),
      deck_remaining: s.deck.length,
    };
  },

  info: () => ({
    cards: {
      challenges: CHALLENGE_CARDS.length,
      truths: TRUTH_CARDS.length,
      rules: RULE_CARDS.length,
      penalties: PENALTY_CARDS.length,
      total: ALL_CARDS.length,
    },
  }),
};
