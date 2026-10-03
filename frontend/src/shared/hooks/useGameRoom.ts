import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { RoomState } from '../types';
import { useWebSocket } from './useWebSocket';
import { clearRoom, loadRoom, saveRoom } from '../session';

export type RoomEntry = {
  action: 'create' | 'join';
  playerName: string;
  roomCode?: string;
  gameId: string;
};

interface Options {
  /** Backend slug: the socket connects to /api/<slug>/ws. */
  slug: string;
  gameId: string;
  /** Where to send the player when the room is gone or they leave. */
  lobbyPath: string;
  /** Storage key for this game's "active room" (used by the lobby's reconnect banner). */
  sessionKey: string;
}

/**
 * Connection + room lifecycle shared by every game page.
 *
 * On every (re)connect the server says whether it already has us in a room
 * (`welcome.room_code`). If it does, it sends the state and we're done. If
 * not (server restarted with a new secret, token lost in a private tab...)
 * we re-send join_room with our name, which reclaims the same seat.
 */
export function useGameRoom<R extends RoomState>({ slug, gameId, lobbyPath, sessionKey }: Options) {
  const navigate = useNavigate();
  const location = useLocation();

  const [entry] = useState<RoomEntry | null>(() => {
    const passed = location.state as RoomEntry | null;
    if (passed?.action && passed.playerName) return passed;
    const stored = loadRoom(sessionKey);
    return stored ? { action: 'join', playerName: stored.playerName, roomCode: stored.roomCode, gameId } : null;
  });

  const { connect, disconnect, reconnectNow, send, on, status } = useWebSocket(slug);
  const [room, setRoom] = useState<R | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const roomCode = useRef<string | null>(entry?.action === 'join' ? (entry.roomCode ?? null) : null);
  const createSent = useRef(false);
  const lastVersion = useRef<{ code: string; version: number } | null>(null);
  const leaveAck = useRef<(() => void) | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinnedCode = useRef<string | null>(null);

  useEffect(() => {
    if (!entry) navigate(lobbyPath, { replace: true });
  }, [entry, navigate, lobbyPath]);

  const exitToLobby = useCallback((state?: Record<string, unknown>) => {
    clearRoom(sessionKey);
    disconnect();
    navigate(lobbyPath, { replace: true, state });
  }, [disconnect, navigate, lobbyPath, sessionKey]);

  /**
   * Leave the room for real: free the seat on the server, forget the stored
   * session and go back to the lobby. (Closing the tab or losing the
   * connection keeps the seat; that is what the lobby's reconnect banner is for.)
   */
  const leave = useCallback(() => {
    const done = () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
      leaveAck.current = null;
      exitToLobby();
    };
    if (status !== 'connected' || !roomCode.current) {
      done();
      return;
    }
    leaveAck.current = done;
    send({ type: 'leave_room' });
    leaveTimer.current = setTimeout(done, 1500);
  }, [status, send, exitToLobby]);

  useEffect(() => {
    if (!entry) return;

    on('welcome', (msg) => {
      const serverRoom = typeof msg.room_code === 'string' ? msg.room_code : null;
      if (entry.action === 'create' && !createSent.current) {
        createSent.current = true;
        send({ type: 'create_room', player_name: entry.playerName, game_id: gameId });
        return;
      }
      if (serverRoom && (!roomCode.current || serverRoom === roomCode.current)) {
        roomCode.current = serverRoom; // seat resumed, state is on its way
        return;
      }
      if (roomCode.current) {
        send({ type: 'join_room', room_code: roomCode.current, player_name: entry.playerName, game_id: gameId });
      }
    });

    on('room_state', (msg) => {
      const data = msg as unknown as R;
      const version = typeof data.version === 'number' ? data.version : 0;
      const last = lastVersion.current;
      if (last && last.code === data.room_code && version < last.version) return; // stale
      lastVersion.current = { code: data.room_code, version };
      roomCode.current = data.room_code;
      setRoom(data);
      setErrorMsg('');
      saveRoom(sessionKey, { roomCode: data.room_code, playerName: entry.playerName, gameId: data.game_id });
      if (pinnedCode.current !== data.room_code) {
        // The history entry still says "create" (or another code). Rewrite it
        // so a reload or back/forward rejoins this room instead of creating
        // a new one (which would also drop us from this room).
        pinnedCode.current = data.room_code;
        const pinned: RoomEntry = { action: 'join', playerName: entry.playerName, roomCode: data.room_code, gameId };
        navigate(location.pathname, { replace: true, state: pinned });
      }
    });

    on('left_room', () => leaveAck.current?.());

    on('error', (msg) => {
      const message = typeof msg.message === 'string' ? msg.message : '';
      if (msg.code === 'ROOM_NOT_FOUND' || message.includes('Room not found')) {
        exitToLobby({ roomNotFound: message || 'Room not found.' });
        return;
      }
      setErrorMsg(message);
    });

    on('room_deleted', () => exitToLobby({ deleted: true }));
  }, [entry, on, send, gameId, sessionKey, exitToLobby, navigate, location.pathname]);

  useEffect(() => {
    if (!entry) return;
    connect();
    return () => disconnect();
  }, [entry, connect, disconnect]);

  useEffect(() => () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }, []);

  return { entry, room, errorMsg, status, send, leave, exitToLobby, reconnectNow };
}
