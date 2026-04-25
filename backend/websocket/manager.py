from fastapi import WebSocket
from typing import Optional


class ConnectionManager:
    def __init__(self):
        # player_id -> WebSocket
        self._connections: dict[str, WebSocket] = {}
        # room_code -> set of player_ids
        self._room_members: dict[str, set[str]] = {}

    async def connect(self, player_id: str, websocket: WebSocket):
        await websocket.accept()
        self._connections[player_id] = websocket

    def disconnect(self, player_id: str):
        self._connections.pop(player_id, None)
        for members in self._room_members.values():
            members.discard(player_id)

    def join_room(self, room_code: str, player_id: str):
        if room_code not in self._room_members:
            self._room_members[room_code] = set()
        self._room_members[room_code].add(player_id)

    def leave_room(self, room_code: str, player_id: str):
        if room_code in self._room_members:
            self._room_members[room_code].discard(player_id)

    def get_room_for_player(self, player_id: str) -> Optional[str]:
        for code, members in self._room_members.items():
            if player_id in members:
                return code
        return None

    async def send_to(self, player_id: str, message: dict):
        ws = self._connections.get(player_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception:
                pass

    async def broadcast_to_room(self, room_code: str, message: dict):
        members = self._room_members.get(room_code, set())
        for player_id in list(members):
            await self.send_to(player_id, message)

    def cleanup_room(self, room_code: str):
        self._room_members.pop(room_code, None)

    def is_connected(self, player_id: str) -> bool:
        return player_id in self._connections


manager = ConnectionManager()
