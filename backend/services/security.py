import hashlib
import hmac
import os
import re
import secrets
import unicodedata
from collections import deque
from time import monotonic
from typing import Optional


_secret_env = os.getenv("SESSION_SECRET")
if _secret_env:
    _SESSION_SECRET = _secret_env.encode("utf-8")
else:
    _SESSION_SECRET = secrets.token_bytes(32)
    print("[security] SESSION_SECRET not set; using ephemeral key (tokens reset on restart)")


_NAME_RE = re.compile(r"^[\w \-'.]{1,20}$", re.UNICODE)
_ROOM_CODE_RE = re.compile(r"^[A-Z0-9]{4,8}$")
_GAME_ID_RE = re.compile(r"^[a-z0-9_\-]{1,40}$")
_TOKEN_RE = re.compile(r"^[A-Za-z0-9_\-]{1,64}\.[a-f0-9]{64}$")


def issue_token() -> tuple[str, str]:
    player_id = secrets.token_urlsafe(16)
    signature = hmac.new(_SESSION_SECRET, player_id.encode("utf-8"), hashlib.sha256).hexdigest()
    return player_id, f"{player_id}.{signature}"


def verify_token(token) -> Optional[str]:
    if not isinstance(token, str) or not _TOKEN_RE.match(token):
        return None
    player_id, signature = token.split(".", 1)
    expected = hmac.new(_SESSION_SECRET, player_id.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        return None
    return player_id


def sanitize_name(raw) -> Optional[str]:
    if not isinstance(raw, str):
        return None
    normalized = unicodedata.normalize("NFKC", raw)
    cleaned = "".join(c for c in normalized if not unicodedata.category(c).startswith("C"))
    cleaned = cleaned.strip()[:20]
    if not cleaned or not _NAME_RE.match(cleaned):
        return None
    return cleaned


def sanitize_room_code(raw) -> Optional[str]:
    if not isinstance(raw, str):
        return None
    code = raw.strip().upper()
    if not _ROOM_CODE_RE.match(code):
        return None
    return code


def sanitize_game_id(raw) -> Optional[str]:
    if not isinstance(raw, str):
        return None
    gid = raw.strip().lower()
    if not _GAME_ID_RE.match(gid):
        return None
    return gid


class RateLimiter:
    def __init__(self):
        self._buckets: dict[str, deque] = {}
        self._limits = {
            "default": (20, 1.0),
            "connect": (15, 60.0),
            "join_room": (8, 60.0),
            "create_room": (5, 60.0),
        }

    def check(self, scope: str, key: str) -> bool:
        max_count, window = self._limits.get(scope, self._limits["default"])
        bucket_key = f"{scope}:{key}"
        now = monotonic()
        bucket = self._buckets.setdefault(bucket_key, deque())
        cutoff = now - window
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= max_count:
            return False
        bucket.append(now)
        return True

    def cleanup(self):
        now = monotonic()
        for key in list(self._buckets.keys()):
            scope = key.split(":", 1)[0]
            _, window = self._limits.get(scope, self._limits["default"])
            cutoff = now - window
            bucket = self._buckets[key]
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if not bucket:
                self._buckets.pop(key, None)


rate_limiter = RateLimiter()
