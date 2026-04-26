from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from websocket.manager import manager
import services.room_service as room_svc
from services.security import (
    issue_token,
    verify_token,
    sanitize_name,
    sanitize_room_code,
    sanitize_game_id,
    rate_limiter,
)

router = APIRouter()

ALLOWED_TYPES = {
    "identify",
    "create_room",
    "join_room",
    "start_game",
    "draw_card",
    "reveal_card",
    "next_turn",
    "delete_room",
    "leave_room",
    "pyramid_vote_next",
    "restart_game",
}


async def _broadcast_state(room_code: str):
    room = room_svc.get_room(room_code)
    if not room:
        return
    members = list(room.players)
    for player in members:
        try:
            state = room.to_dict(viewer_id=player.id)
            state["type"] = "room_state"
            await manager.send_to(player.id, state)
        except Exception as e:
            print(f"[ws] broadcast error for player {player.id}: {e}")


async def _resolve_pyramid_vote_if_complete(room, room_code: str):
    if room.game_id != "pyramid" or room.game_state.status != "playing":
        return
    gd = room.game_state.game_data
    if not gd:
        return
    connected = [p for p in room.players if p.is_connected]
    if not connected:
        return
    connected_ids = {p.id for p in connected}
    votes = [v for v in gd.get("next_votes", []) if v in connected_ids]
    gd["next_votes"] = votes
    if not votes:
        return
    if connected_ids.issubset(set(votes)):
        gd["next_votes"] = []
        gd["claims"] = []
        current = gd.get("current_pyramid_index", -1)
        cards = gd.get("pyramid_cards", [])
        if current >= len(cards) - 1:
            room.game_state.status = "finished"
        else:
            idx = current + 1
            cards[idx]["revealed"] = True
            gd["current_pyramid_index"] = idx
        await _broadcast_state(room_code)


async def _send_error(player_id: str, message: str):
    await manager.send_to(player_id, {"type": "error", "message": message})


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    client_ip = websocket.client.host if websocket.client else "unknown"

    if not rate_limiter.check("connect", client_ip):
        await websocket.close(code=4029, reason="Too many connections")
        return

    player_id: str = ""
    room_code: str = ""

    try:
        while True:
            try:
                data = await websocket.receive_json()
            except WebSocketDisconnect:
                raise
            except Exception as parse_err:
                print(f"[ws] parse error: {parse_err}")

                continue

            if not isinstance(data, dict):
                continue

            msg_type = data.get("type")
            if not isinstance(msg_type, str) or msg_type not in ALLOWED_TYPES:
                continue

            scope_key = player_id or client_ip
            if not rate_limiter.check("default", scope_key):
                continue

            if msg_type == "identify":
                token = data.get("token")
                verified = verify_token(token) if isinstance(token, str) else None
                if verified:
                    player_id = verified
                else:
                    player_id, new_token = issue_token()
                    await websocket.send_json({"type": "session", "token": new_token})
                await manager.connect(player_id, websocket, accept=False)
                for code, room in room_svc.get_all_rooms().items():
                    if room.get_player_by_id(player_id):
                        room_code = code
                        manager.join_room(room_code, player_id)
                        room_svc.mark_reconnected(room, player_id)
                        await _broadcast_state(room_code)
                        break
                continue

            if not player_id:
                continue

            if msg_type == "create_room":
                if not rate_limiter.check("create_room", player_id):
                    await _send_error(player_id, "Too many room creations. Slow down.")
                    continue
                game_id = sanitize_game_id(data.get("game_id", "sipit-or-dipit")) or "sipit-or-dipit"
                player_name = sanitize_name(data.get("player_name"))
                if not player_name:
                    await _send_error(player_id, "Invalid name.")
                    continue
                room = room_svc.create_room(game_id, player_id, player_name)
                room_code = room.code
                manager.join_room(room_code, player_id)
                state = room.to_dict(viewer_id=player_id)
                state["type"] = "room_state"
                await manager.send_to(player_id, state)

            elif msg_type == "join_room":
                if not rate_limiter.check("join_room", player_id):
                    await _send_error(player_id, "Too many join attempts. Slow down.")
                    continue
                code = sanitize_room_code(data.get("room_code"))
                player_name = sanitize_name(data.get("player_name"))
                if not code:
                    await _send_error(player_id, "Invalid room code.")
                    continue
                if not player_name:
                    await _send_error(player_id, "Invalid name.")
                    continue
                requested_game_id = sanitize_game_id(data.get("game_id", "")) or ""
                room = room_svc.get_room(code)
                if not room:
                    await _send_error(player_id, "Room not found.")
                    continue
                if requested_game_id and room.game_id != requested_game_id:
                    await _send_error(player_id, "Room not found.")
                    continue
                if room.game_state.status == "playing":
                    existing = room.get_player_by_id(player_id)
                    if not existing:
                        await _send_error(player_id, "Game already in progress.")
                        continue
                player = room_svc.add_player(room, player_id, player_name)
                if player is None:
                    await _send_error(player_id, "Name already taken in this room.")
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
                    await _send_error(player_id, "Only the host can start the game.")
                    continue
                connected = [p for p in room.players if p.is_connected]
                if len(connected) < 2:
                    await _send_error(player_id, "Need at least 2 players to start.")
                    continue
                room_svc.start_game(room)
                await _broadcast_state(room_code)

            elif msg_type == "draw_card":
                room = room_svc.get_room(room_code)
                if not room or room.game_state.status != "playing":
                    continue
                cur = room.current_player()
                if not cur or cur.id != player_id:
                    await _send_error(player_id, "It's not your turn.")
                    continue
                room_svc.draw_card(room)
                await _broadcast_state(room_code)

            elif msg_type == "reveal_card":
                room = room_svc.get_room(room_code)
                if not room or room.game_state.status != "playing":
                    continue
                cur = room.current_player()
                if not cur or cur.id != player_id:
                    await _send_error(player_id, "It's not your turn.")
                    continue
                if room_svc.reveal_card(room):
                    await _broadcast_state(room_code)

            elif msg_type == "next_turn":
                room = room_svc.get_room(room_code)
                if not room or room.game_state.status != "playing":
                    continue
                cur = room.current_player()
                if not cur or cur.id != player_id:
                    await _send_error(player_id, "It's not your turn.")
                    continue
                room_svc.next_turn(room)
                await _broadcast_state(room_code)

            elif msg_type == "delete_room":
                room = room_svc.get_room(room_code)
                if not room:
                    continue
                host = room.get_host()
                if not host or host.id != player_id:
                    await _send_error(player_id, "Only the host can delete the room.")
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
                        if not room.players:
                            room_svc.delete_room(room_code)
                            manager.cleanup_room(room_code)
                        else:
                            await _broadcast_state(room_code)
                            await _resolve_pyramid_vote_if_complete(room, room_code)
                    room_code = ""

            # ── Pyramid-specific handlers ──────────────────────────────────────

            elif msg_type == "pyramid_vote_next":
                room = room_svc.get_room(room_code)
                if not room or room.game_state.status != "playing" or room.game_id != "pyramid":
                    continue
                gd = room.game_state.game_data
                connected = [p for p in room.players if p.is_connected]
                connected_ids = {p.id for p in connected}

                votes = [v for v in gd.get("next_votes", []) if v in connected_ids]
                if player_id not in votes:
                    votes.append(player_id)
                gd["next_votes"] = votes

                if connected_ids and connected_ids.issubset(set(votes)):
                    gd["next_votes"] = []
                    gd["claims"] = []
                    current = gd.get("current_pyramid_index", -1)
                    cards = gd.get("pyramid_cards", [])
                    if current >= len(cards) - 1:
                       room.game_state.status = "finished"
                    else:
                        idx = current + 1
                        cards[idx]["revealed"] = True
                        gd["current_pyramid_index"] = idx

                await _broadcast_state(room_code)

            elif msg_type == "restart_game":
                room = room_svc.get_room(room_code)
                if not room or room.game_id != "pyramid":
                    continue
                if room.game_state.status != "finished":
                    continue
                gs = room.game_state
                gs.status = "lobby"
                gs.game_data = {}
                gs.deck = []
                gs.current_card = None
                gs.card_drawn = False
                gs.card_revealed = False
                gs.active_rules = []
                gs.round_number = 0
                await _broadcast_state(room_code)

    except WebSocketDisconnect:
        pass
    except Exception as err:
        print(f"[ws] unhandled error (player={player_id}): {err}")
    finally:
        if player_id:
            manager.disconnect(player_id)
            if room_code:
                room = room_svc.get_room(room_code)
                if room:
                    room_svc.mark_disconnected(room, player_id)
                    still_connected = [p for p in room.players if p.is_connected]
                    if still_connected:
                        await _broadcast_state(room_code)
                        await _resolve_pyramid_vote_if_complete(room, room_code)
                    else:
                        room_svc.delete_room(room_code)
                        manager.cleanup_room(room_code)
