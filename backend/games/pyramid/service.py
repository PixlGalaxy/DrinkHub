import random

GAME_ID = "pyramid"
GAME_NAME = "Pyramid"

SUITS = ["H", "D", "C", "S"]
RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]

PYRAMID_SIZE = 10
HAND_SIZE = 3

# Pyramid layout:
# Row 0 (bottom): positions 0-3 → 1 drink
# Row 1: positions 4-6           → 2 drinks
# Row 2: positions 7-8           → 3 drinks
# Row 3 (top): position 9        → 4 drinks
_POSITION_MAP = {i: (0, 1) for i in range(4)}
_POSITION_MAP.update({i: (1, 2) for i in range(4, 7)})
_POSITION_MAP.update({7: (2, 3), 8: (2, 3)})
_POSITION_MAP[9] = (3, 4)


def _get_row_drinks(position: int) -> tuple:
    return _POSITION_MAP.get(position, (0, 1))


def _rank_to_image(rank: str) -> str:
    return "T" if rank == "10" else rank


def _build_playing_deck() -> list:
    deck = [{"rank": r, "suit": s, "image": f"{_rank_to_image(r)}{s}"} for s in SUITS for r in RANKS]
    random.shuffle(deck)
    return deck


def build_deck() -> list:
    return _build_playing_deck()


def build_pyramid_state(connected_players: list) -> dict:
    deck = _build_playing_deck()

    pyramid_cards = []
    for i in range(PYRAMID_SIZE):
        card = deck.pop(0)
        row, drinks = _get_row_drinks(i)
        pyramid_cards.append({
            **card,
            "revealed": False,
            "row": row,
            "drinks": drinks,
            "position": i,
        })

    player_hands = {}
    for player in connected_players:
        hand = []
        for _ in range(HAND_SIZE):
            if deck:
                c = deck.pop(0)
                hand.append({**c, "used": False})
        player_hands[player.id] = hand

    seen: set = set()
    for c in pyramid_cards:
        assert c["image"] not in seen, f"Duplicate card detected: {c['image']}"
        seen.add(c["image"])
    for hand in player_hands.values():
        for c in hand:
            assert c["image"] not in seen, f"Duplicate card detected: {c['image']}"
            seen.add(c["image"])

    return {
        "pyramid_cards": pyramid_cards,
        "current_pyramid_index": -1,
        "player_hands": player_hands,
        "next_votes": [],
        "claims": [],
    }
