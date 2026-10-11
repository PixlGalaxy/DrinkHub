import type { Bilingual } from './i18n/translations';

export type CardType = 'challenge' | 'truth' | 'rule' | 'penalty';
export type DrinkAmount = 'shot' | 'half_glass' | 'full_glass' | 'none';

export interface Card {
  id: string;
  type: CardType;
  title: Bilingual;
  description: Bilingual;
  consequence?: Bilingual;
  drink_amount?: DrinkAmount;
  rounds?: number;
}

export interface Player {
  id: string;
  name: string;
  is_host: boolean;
  /** False only once the player has been gone long enough to count as away. */
  is_connected: boolean;
  presence?: Presence;
}

export type Presence = 'online' | 'reconnecting' | 'away';

export interface ActiveRule {
  card_id: string;
  title: Bilingual;
  description: Bilingual;
  rounds_remaining: number;
}

export interface RoomState {
  room_code: string;
  game_id: string;
  host_id: string;
  host_name: string;
  players: Player[];
  status: 'lobby' | 'playing' | 'finished';
  current_player_id: string;
  current_player_name: string;
  current_card: Card | null;
  card_drawn: boolean;
  card_revealed: boolean;
  active_rules: ActiveRule[];
  deck_remaining: number;
  viewer_id: string;
  version?: number;
  current_player_presence?: Presence | null;
  /** Whether the viewer may skip the current turn (current player is away, or viewer is host). */
  can_skip?: boolean;
}

export type WsStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error' | 'replaced';

// ── Pyramid ──────────────────────────────────────────────────────────────────

export interface PyramidCard {
  rank: string | null;
  suit: string | null;
  image: string | null;
  revealed: boolean;
  row: number;
  drinks: number;
  position: number;
}

export interface PyramidHandCard {
  rank: string;
  suit: string;
  image: string;
  used: boolean;
}

export interface PyramidClaim {
  claim_id: string;
  claimer_id: string;
  claimer_name: string;
  target_id: string;
  target_name: string;
  drinks: number;
  challenged: boolean;
  challenger_id: string | null;
  challenger_name: string | null;
  resolved: boolean;
  was_truth: boolean | null;
}

export interface PyramidData {
  pyramid_cards: PyramidCard[];
  current_pyramid_index: number;
  next_votes: string[];
  claims: PyramidClaim[];
  total: number;
}

export interface PyramidRoomState extends RoomState {
  pyramid_data?: PyramidData;
  viewer_hand?: PyramidHandCard[];
}
