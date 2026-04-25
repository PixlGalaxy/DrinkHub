export type CardType = 'challenge' | 'truth' | 'rule' | 'penalty';
export type DrinkAmount = 'shot' | 'half_glass' | 'full_glass' | 'none';

export interface Card {
  id: string;
  type: CardType;
  title: string;
  description: string;
  consequence?: string;
  drink_amount?: DrinkAmount;
  rounds?: number;
}

export interface Player {
  id: string;
  name: string;
  is_host: boolean;
  is_connected: boolean;
}

export interface ActiveRule {
  card_id: string;
  title: string;
  description: string;
  rounds_remaining: number;
}

export interface RoomState {
  room_code: string;
  game_id: string;
  host_id: string;
  host_name: string;
  players: Player[];
  status: 'lobby' | 'playing';
  current_player_id: string;
  current_player_name: string;
  current_card: Card | null;
  card_drawn: boolean;
  active_rules: ActiveRule[];
  deck_remaining: number;
  viewer_id: string;
}

export type WsStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
