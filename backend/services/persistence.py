import json
import os
import tempfile
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING

from models.room import Room, Player, GameState, ActiveRule

if TYPE_CHECKING:
    from typing import Dict

STORAGE_DIR = Path(__file__).resolve().parent.parent / "storage"
STORAGE_DIR.mkdir(exist_ok=True)
ROOMS_FILE = STORAGE_DIR / "rooms.json"


def _datetime_default(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj).__name__} not JSON serializable")


def save_rooms(rooms: dict) -> bool:
    """Atomically write the rooms dict to disk. Returns True on success."""
    try:
        serializable = {code: asdict(room) for code, room in rooms.items()}
        # Write to temp file then rename (atomic on POSIX, near-atomic on Windows)
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", dir=STORAGE_DIR, prefix=".rooms_", suffix=".tmp", delete=False
        ) as tmp:
            json.dump(serializable, tmp, default=_datetime_default, indent=2)
            tmp_path = tmp.name
        os.replace(tmp_path, ROOMS_FILE)
        return True
    except Exception as e:
        print(f"[persistence] save_rooms failed: {e}")
        return False


def load_rooms() -> dict:
    """Load rooms from disk. Returns empty dict if no file exists or load fails."""
    if not ROOMS_FILE.exists():
        return {}
    try:
        with open(ROOMS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"[persistence] load_rooms read failed: {e}")
        return {}

    rooms: dict = {}
    now = datetime.utcnow()

    for code, raw in data.items():
        try:
            created_at = datetime.fromisoformat(raw["created_at"])
            expires_at = datetime.fromisoformat(raw["expires_at"])
            if expires_at < now:
                continue

            players = []
            for p in raw.get("players", []):
                player = Player(
                    id=p["id"],
                    name=p["name"],
                    is_host=p.get("is_host", False),
                    is_connected=False,  # Always reset on restart
                )
                players.append(player)

            gs_raw = raw.get("game_state", {})
            active_rules = [
                ActiveRule(
                    card_id=r["card_id"],
                    title=r["title"],
                    description=r["description"],
                    rounds_remaining=r["rounds_remaining"],
                )
                for r in gs_raw.get("active_rules", [])
            ]
            game_state = GameState(
                status=gs_raw.get("status", "lobby"),
                current_player_index=gs_raw.get("current_player_index", 0),
                deck=gs_raw.get("deck", []),
                discard_pile=gs_raw.get("discard_pile", []),
                current_card=gs_raw.get("current_card"),
                card_drawn=gs_raw.get("card_drawn", False),
                active_rules=active_rules,
                round_number=gs_raw.get("round_number", 0),
            )

            room = Room(
                code=code,
                game_id=raw["game_id"],
                created_at=created_at,
                expires_at=expires_at,
                players=players,
                game_state=game_state,
            )
            rooms[code] = room
        except Exception as e:
            print(f"[persistence] skipping malformed room {code}: {e}")
            continue

    print(f"[persistence] loaded {len(rooms)} room(s) from disk")
    return rooms
