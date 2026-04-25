from typing import Callable, Optional, TypedDict

from . import sipit_or_dipit


class GameInfo(TypedDict):
    id: str
    name: str
    build_deck: Callable[[], list[dict]]


GAMES: dict[str, GameInfo] = {
    sipit_or_dipit.GAME_ID: {
        "id": sipit_or_dipit.GAME_ID,
        "name": sipit_or_dipit.GAME_NAME,
        "build_deck": sipit_or_dipit.build_deck,
    },
}


def get_game(game_id: str) -> Optional[GameInfo]:
    return GAMES.get(game_id)


def list_games() -> list[dict]:
    return [{"id": g["id"], "name": g["name"]} for g in GAMES.values()]
