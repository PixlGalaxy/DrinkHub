import uuid
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from websocket.manager import manager
import services.room_service as room_svc

router = APIRouter()


async def _broadcast_state(room_code: str, viewer_id: str = ""):
    room = room_svc.get_room(room_code)
    if room:
        members = list(room.players)
        for player in members:
            state = room.to_dict(viewer_id=player.id)
            state["type"] = "room_state"
            await manager.send_to(player.id, state)


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    player_id: str = ""
    room_code: str = ""

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "")

            if msg_type == "identify":
                player_id = data.get("player_id", str(uuid.uuid4()))
                await manager.connect(player_id, websocket, accept=False)
                prev_room_code = manager.get_room_for_player(player_id)
                if prev_room_code:
                    room_code = prev_room_code
                    room = room_svc.get_room(room_code)
                    if room:
                        player = room.get_player_by_id(player_id)
                        if player:
                            player.is_connected = True
                            await _broadcast_state(room_code)
                continue

            if not player_id:
                continue

            if msg_type == "create_room":
                game_id = data.get("game_id", "sipit-or-dipit")
                player_name = data.get("player_name", "Player").strip()[:20]
                room = room_svc.create_room(game_id, player_id, player_name)
                room_code = room.code
                manager.join_room(room_code, player_id)
                state = room.to_dict(viewer_id=player_id)
                state["type"] = "room_state"
                await manager.send_to(player_id, state)

            elif msg_type == "join_room":
                code = data.get("room_code", "").strip().upper()
                player_name = data.get("player_name", "Player").strip()[:20]
                room = room_svc.get_room(code)
                if not room:
                    await manager.send_to(player_id, {"type": "error", "message": "Room not found."})
                    continue
                if room.game_state.status == "playing":
                    existing = room.get_player_by_id(player_id)
                    if not existing:
                        await manager.send_to(player_id, {"type": "error", "message": "Game already in progress."})
                        continue
                player = room_svc.add_player(room, player_id, player_name)
                if player is None:
                    await manager.send_to(player_id, {"type": "error", "message": "Name already taken in this room."})
                    continue
                room_code = code
                manager.join_room(room_code, player_id)
                await _broadcast_state(room_code)

            elif msg_type == "start_game":
                room = room_svc.get_room(room_code)
                if not room:
                    continue
                host = room.get_host()
                if not host or host.id != player_id:
                    await manager.send_to(player_id, {"type": "error", "message": "Only the host can start the game."})
                    continue
                connected = [p for p in room.players if p.is_connected]
                if len(connected) < 2:
                    await manager.send_to(player_id, {"type": "error", "message": "Need at least 2 players to start."})
                    continue
                room_svc.start_game(room)
                await _broadcast_state(room_code)

            elif msg_type == "draw_card":
                room = room_svc.get_room(room_code)
                if not room or room.game_state.status != "playing":
                    continue
                cur = room.current_player()
                if not cur or cur.id != player_id:
                    await manager.send_to(player_id, {"type": "error", "message": "It's not your turn."})
                    continue
                room_svc.draw_card(room)
                await _broadcast_state(room_code)

            elif msg_type == "next_turn":
                room = room_svc.get_room(room_code)
                if not room or room.game_state.status != "playing":
                    continue
                cur = room.current_player()
                if not cur or cur.id != player_id:
                    await manager.send_to(player_id, {"type": "error", "message": "It's not your turn."})
                    continue
                room_svc.next_turn(room)
                await _broadcast_state(room_code)

            elif msg_type == "delete_room":
                room = room_svc.get_room(room_code)
                if not room:
                    continue
                host = room.get_host()
                if not host or host.id != player_id:
                    await manager.send_to(player_id, {"type": "error", "message": "Only the host can delete the room."})
                    continue
                await manager.broadcast_to_room(room_code, {"type": "room_deleted"})
                room_svc.delete_room(room_code)
                manager.cleanup_room(room_code)
                room_code = ""

            elif msg_type == "leave_room":
                if room_code:
                    room = room_svc.get_room(room_code)
                    if room:
                        room_svc.remove_player(room, player_id)
                        manager.leave_room(room_code, player_id)
                        if not any(p.is_connected for p in room.players):
                            room_svc.delete_room(room_code)
                            manager.cleanup_room(room_code)
                        else:
                            await _broadcast_state(room_code)
                    room_code = ""

    except WebSocketDisconnect:
        manager.disconnect(player_id)
        if room_code:
            room = room_svc.get_room(room_code)
            if room:
                room_svc.remove_player(room, player_id)
                connected = [p for p in room.players if p.is_connected]
                if connected:
                    await _broadcast_state(room_code)
                else:
                    room_svc.delete_room(room_code)
                    manager.cleanup_room(room_code)
