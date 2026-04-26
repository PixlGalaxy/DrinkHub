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
    title: dict  # {"en": "...", "es": "..."}
    description: dict  # {"en": "...", "es": "..."}
    rounds_remaining: int


@dataclass
class GameState:
    status: str = "lobby"  # "lobby" | "playing" | "finished"
    current_player_index: int = 0
    deck: list = field(default_factory=list)
    discard_pile: list = field(default_factory=list)
    current_card: Optional[dict] = None
    card_drawn: bool = False
    card_revealed: bool = False
    active_rules: list = field(default_factory=list)
    round_number: int = 0
    game_data: dict = field(default_factory=dict)


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
        result = {
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
            "card_revealed": gs.card_revealed,
            "active_rules": [
                {"card_id": r.card_id, "title": r.title, "description": r.description, "rounds_remaining": r.rounds_remaining}
                for r in gs.active_rules
            ],
            "deck_remaining": len(gs.deck),
            "viewer_id": viewer_id,
        }

        if self.game_id == "pyramid" and gs.game_data:
            gd = gs.game_data
            public_pyramid_cards = []
            for c in gd.get("pyramid_cards", []):
                if c.get("revealed"):
                    public_pyramid_cards.append(dict(c))
                else:
                    public_pyramid_cards.append({
                        "revealed": False,
                        "row": c.get("row", 0),
                        "drinks": c.get("drinks", 1),
                        "position": c.get("position", 0),
                        "rank": None,
                        "suit": None,
                        "image": None,
                    })
            result["pyramid_data"] = {
                "pyramid_cards": public_pyramid_cards,
                "current_pyramid_index": gd.get("current_pyramid_index", -1),
                "next_votes": gd.get("next_votes", []),
                "claims": gd.get("claims", []),
                "total": PYRAMID_SIZE,
            }
            player_hands = gd.get("player_hands", {})
            result["viewer_hand"] = player_hands.get(viewer_id, [])

        return result


PYRAMID_SIZE = 10
