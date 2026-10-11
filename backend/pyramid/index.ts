import { findPlayer, presentPlayers, shuffle } from '../server/room.ts';
import type { GameModule, Room } from '../server/types.ts';

const SUITS = ['H', 'D', 'C', 'S'] as const;
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;

export const PYRAMID_SIZE = 10;
export const HAND_SIZE = 3;

export interface PlayingCard {
  rank: string;
  suit: string;
  image: string;
}

export interface PyramidCard extends PlayingCard {
  revealed: boolean;
  row: number;
  drinks: number;
  position: number;
}

export interface HandCard extends PlayingCard {
  used: boolean;
}

export interface PyramidState {
  pyramid: PyramidCard[];
  currentIndex: number;
  hands: Record<string, HandCard[]>;
  /** Cards not dealt yet; used to deal a hand to players who join mid-game. */
  deck: PlayingCard[];
  votes: string[];
}

type PyramidRoom = Room<PyramidState>;

/**
 * Layout (bottom → top): positions 0-3 = 1 drink, 4-6 = 2, 7-8 = 3, 9 = 4.
 */
function rowAndDrinks(position: number): [row: number, drinks: number] {
  if (position < 4) return [0, 1];
  if (position < 7) return [1, 2];
  if (position < 9) return [2, 3];
  return [3, 4];
}

function buildDeck(): PlayingCard[] {
  const deck = SUITS.flatMap(suit =>
    RANKS.map(rank => ({ rank, suit, image: `${rank === '10' ? 'T' : rank}${suit}` })),
  );
  return shuffle(deck);
}

function dealHand(state: PyramidState, playerId: string) {
  if (state.hands[playerId]) return;
  state.hands[playerId] = state.deck.splice(0, HAND_SIZE).map(c => ({ ...c, used: false }));
}

function initialState(): PyramidState {
  return { pyramid: [], currentIndex: -1, hands: {}, deck: [], votes: [] };
}

/**
 * Advances once every present player has voted. Players who are away (phone
 * locked for a while, left) don't block the table; someone who is only
 * briefly reconnecting still does.
 */
function resolveVotes(room: PyramidRoom, now: number): boolean {
  if (room.status !== 'playing') return false;
  const s = room.state;
  const present = new Set(presentPlayers(room, now).map(p => p.id));
  const before = s.votes.length;
  s.votes = s.votes.filter(id => findPlayer(room, id));
  const counted = s.votes.filter(id => present.has(id));
  if (!counted.length || ![...present].every(id => counted.includes(id))) return s.votes.length !== before;

  s.votes = [];
  if (s.currentIndex >= s.pyramid.length - 1) {
    room.status = 'finished';
  } else {
    s.currentIndex++;
    s.pyramid[s.currentIndex]!.revealed = true;
  }
  return true;
}

export const pyramid: GameModule<PyramidState> = {
  id: 'pyramid',
  slug: 'pyramid',
  name: 'Pyramid',
  minPlayers: 2,
  // 52 cards − 10 in the pyramid = 42 → 14 hands of 3.
  maxPlayers: 14,

  initialState,

  start(room) {
    const deck = buildDeck();
    const state: PyramidState = { ...initialState(), deck };
    state.pyramid = deck.splice(0, PYRAMID_SIZE).map((card, position) => {
      const [row, drinks] = rowAndDrinks(position);
      return { ...card, revealed: false, row, drinks, position };
    });
    for (const p of room.players) dealHand(state, p.id);
    room.state = state;
  },

  reset(room) {
    room.state = initialState();
  },

  canJoinMidGame: room => room.status === 'playing' && room.state.deck.length >= HAND_SIZE,

  onPlayerJoined(room, player) {
    if (room.status === 'playing') dealHand(room.state, player.id);
  },

  onPlayerRemoved(room, playerId, now) {
    const s = room.state;
    const hand = s.hands[playerId];
    if (hand) {
      s.deck.push(...hand.map(({ rank, suit, image }) => ({ rank, suit, image })));
      delete s.hands[playerId];
    }
    s.votes = s.votes.filter(id => id !== playerId);
    resolveVotes(room, now);
  },

  onTick: (room, now) => resolveVotes(room, now),

  actions: {
    pyramid_vote_next({ room, player, now }) {
      if (room.status !== 'playing') return;
      if (!room.state.votes.includes(player.id)) room.state.votes.push(player.id);
      resolveVotes(room, now);
    },
  },

  view(room, viewerId) {
    const s = room.state;
    if (room.status === 'lobby' || !s.pyramid.length) return {};
    return {
      pyramid_data: {
        pyramid_cards: s.pyramid.map(c =>
          c.revealed
            ? c
            : { revealed: false, row: c.row, drinks: c.drinks, position: c.position, rank: null, suit: null, image: null },
        ),
        current_pyramid_index: s.currentIndex,
        next_votes: s.votes,
        claims: [],
        total: PYRAMID_SIZE,
      },
      viewer_hand: s.hands[viewerId] ?? [],
    };
  },
};
