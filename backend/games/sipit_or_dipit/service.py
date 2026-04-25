import random
from .cards import ALL_CARDS

GAME_ID = "sipit-or-dipit"
GAME_NAME = "SipIt Or DipIt"


def build_deck() -> list[dict]:
    """Build a fresh, shuffled deck for a new game."""
    deck = list(ALL_CARDS)
    random.shuffle(deck)
    return deck
