import random
from datetime import datetime, timedelta
from typing import Optional

from models.room import Room, Player, GameState, ActiveRule
from games.registry import get_game

ROOM_TTL_HOURS = 24
DISCONNECT_GRACE_SECONDS = 120  # 2 minutes to reconnect before being fully removed
_rooms: dict[str, Room] = {}


def _generate_code() -> str:
    chars = "ABCDEFGHJKMNPQRSTVWXYZ"
    while True:
        code = "".join(random.choices(chars, k=4))
        if code not in _rooms:
            return code


def _build_deck(game_id: str) -> list[dict]:
    game = get_game(game_id)
    if not game:
        return []
    return game["build_deck"]()


def hydrate_rooms(loaded: dict[str, Room]):
    _rooms.clear()
    _rooms.update(loaded)


def create_room(game_id: str, host_id: str, host_name: str) -> Room:
    code = _generate_code()
    now = datetime.utcnow()
    host = Player(id=host_id, name=host_name, is_host=True)
    room = Room(
        code=code,
        game_id=game_id,
        created_at=now,
        expires_at=now + timedelta(hours=ROOM_TTL_HOURS),
        players=[host],
        game_state=GameState(),
    )
    _rooms[code] = room
    return room


def get_room(code: str) -> Optional[Room]:
    return _rooms.get(code.upper())


def get_all_rooms() -> dict[str, Room]:
    return _rooms


def delete_room(code: str):
    _rooms.pop(code, None)


def add_player(room: Room, player_id: str, player_name: str) -> Optional[Player]:
    if any(p.name.lower() == player_name.lower() and p.id != player_id for p in room.players):
        return None
    existing = room.get_player_by_id(player_id)
    if existing:
        existing.is_connected = True
        existing.disconnected_at = None
        return existing
    player = Player(id=player_id, name=player_name, is_host=False)
    room.players.append(player)
    return player


def mark_disconnected(room: Room, player_id: str):
    player = room.get_player_by_id(player_id)
    if not player:
        return
    player.is_connected = False
    player.disconnected_at = datetime.utcnow()


def mark_reconnected(room: Room, player_id: str):
    player = room.get_player_by_id(player_id)
    if not player:
        return
    player.is_connected = True
    player.disconnected_at = None


def remove_player(room: Room, player_id: str):
    player = room.get_player_by_id(player_id)
    if not player:
        return
    was_host = player.is_host
    room.players = [p for p in room.players if p.id != player_id]
    if was_host:
        connected = [p for p in room.players if p.is_connected]
        if connected:
            connected[0].is_host = True


def start_game(room: Room):
    gs = room.game_state
    gs.status = "playing"
    gs.deck = _build_deck(room.game_id)
    gs.discard_pile = []
    gs.current_card = None
    gs.card_drawn = False
    gs.active_rules = []
    gs.round_number = 1
    connected = [p for p in room.players if p.is_connected]
    gs.current_player_index = 0
    random.shuffle(connected)
    order = {p.id: i for i, p in enumerate(connected)}
    room.players.sort(key=lambda p: order.get(p.id, 999))


def draw_card(room: Room) -> Optional[dict]:
    gs = room.game_state
    if gs.card_drawn:
        return gs.current_card
    if not gs.deck:
        gs.deck = list(gs.discard_pile)
        gs.discard_pile = []
        random.shuffle(gs.deck)
    if not gs.deck:
        return None
    card = gs.deck.pop(0)
    gs.current_card = card
    gs.card_drawn = True
    return card


def next_turn(room: Room):
    gs = room.game_state
    if gs.current_card:
        if gs.current_card["type"] == "rule" and gs.current_card.get("rounds"):
            gs.active_rules.append(ActiveRule(
                card_id=gs.current_card["id"],
                title=gs.current_card["title"],
                description=gs.current_card["description"],
                rounds_remaining=gs.current_card["rounds"],
            ))
        gs.discard_pile.append(gs.current_card)
    gs.current_card = None
    gs.card_drawn = False
    connected = [p for p in room.players if p.is_connected]
    if connected:
        gs.current_player_index = (gs.current_player_index + 1) % len(connected)
    gs.round_number += 1
    gs.active_rules = [r for r in gs.active_rules if r.rounds_remaining > 0]
    for rule in gs.active_rules:
        rule.rounds_remaining -= 1


def cleanup_expired_rooms():
    now = datetime.utcnow()
    expired = [code for code, room in _rooms.items() if room.expires_at < now]
    for code in expired:
        delete_room(code)
    return expired


def cleanup_disconnected_players():
    now = datetime.utcnow()
    grace = timedelta(seconds=DISCONNECT_GRACE_SECONDS)
    rooms_to_delete = []

    for code, room in _rooms.items():
        expired_players = [
            p for p in room.players
            if not p.is_connected
            and p.disconnected_at is not None
            and (now - p.disconnected_at) > grace
        ]

        for player in expired_players:
            was_host = player.is_host
            room.players = [p for p in room.players if p.id != player.id]
            if was_host:
                remaining_connected = [p for p in room.players if p.is_connected]
                if remaining_connected:
                    remaining_connected[0].is_host = True

        if not room.players:
            rooms_to_delete.append(code)

    for code in rooms_to_delete:
        delete_room(code)

    return rooms_to_delete
