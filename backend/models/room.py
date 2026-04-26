from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class Player:
    id: str
    name: str
    is_host: bool
    is_connected: bool = True
    disconnected_at: Optional[datetime] = None


@dataclass
class ActiveRule:
    card_id: str
    title: str
    description: str
    rounds_remaining: int


@dataclass
class GameState:
    status: str = "lobby"  # "lobby" | "playing"
    current_player_index: int = 0
    deck: list = field(default_factory=list)
    discard_pile: list = field(default_factory=list)
    current_card: Optional[dict] = None
    card_drawn: bool = False
    active_rules: list = field(default_factory=list)
    round_number: int = 0


@dataclass
class Room:
    code: str
    game_id: str
    created_at: datetime
    expires_at: datetime
    players: list = field(default_factory=list)
    game_state: GameState = field(default_factory=GameState)

    def get_player_by_id(self, player_id: str) -> Optional[Player]:
        return next((p for p in self.players if p.id == player_id), None)

    def get_host(self) -> Optional[Player]:
        return next((p for p in self.players if p.is_host), None)

    def current_player(self) -> Optional[Player]:
        connected = [p for p in self.players if p.is_connected]
        if not connected:
            return None
        idx = self.game_state.current_player_index % len(connected)
        return connected[idx]

    def to_dict(self, viewer_id: str = "") -> dict:
        host = self.get_host()
        cur = self.current_player()
        gs = self.game_state
        return {
            "room_code": self.code,
            "game_id": self.game_id,
            "host_id": host.id if host else "",
            "host_name": host.name if host else "",
            "players": [
                {"id": p.id, "name": p.name, "is_host": p.is_host, "is_connected": p.is_connected}
                for p in self.players
            ],
            "status": gs.status,
            "current_player_id": cur.id if cur else "",
            "current_player_name": cur.name if cur else "",
            "current_card": gs.current_card,
            "card_drawn": gs.card_drawn,
            "active_rules": [
                {"card_id": r.card_id, "title": r.title, "description": r.description, "rounds_remaining": r.rounds_remaining}
                for r in gs.active_rules
            ],
            "deck_remaining": len(gs.deck),
            "viewer_id": viewer_id,
        }
