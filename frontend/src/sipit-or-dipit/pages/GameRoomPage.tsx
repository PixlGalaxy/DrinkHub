import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Play, Trash2, Users, ChevronRight, Loader, Hourglass, RotateCcw } from 'lucide-react';
import { useWebSocket } from '../../shared/hooks/useWebSocket';
import { useClearSEO } from '../../shared/hooks/useClearSEO';
import type { RoomState } from '../../shared/types';
import { GameNavbar } from '../navbar/GameNavbar';
import { RoomCode } from '../components/RoomCode';
import { PlayerList } from '../components/PlayerList';
import { PlayingCard, CardDeck } from '../components/PlayingCard';
import { ActiveRules } from '../components/ActiveRules';
import { useLanguage } from '../../shared/i18n/useLanguage';
import { t } from '../../shared/i18n/translations';

const SESSION_KEY = 'dh_active_session';

type LocationState = {
  action: 'create' | 'join';
  playerName: string;
  roomCode?: string;
  gameId: string;
};

type StoredSession = {
  roomCode: string;
  playerName: string;
  gameId: string;
};

function saveSession(session: StoredSession) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {}
}

function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) as StoredSession : null;
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {}
}

export function GameRoomPage() {
  useClearSEO();
  const navigate = useNavigate();
  const location = useLocation();
  const passedState = location.state as LocationState | null;
  const [lang] = useLanguage();

  const [state] = useState<LocationState | null>(() => {
    if (passedState) return passedState;
    const stored = loadSession();
    if (stored) {
      return {
        action: 'join',
        playerName: stored.playerName,
        roomCode: stored.roomCode,
        gameId: stored.gameId,
      };
    }
    return null;
  });

  const { connect, disconnect, send, on, status } = useWebSocket();
  const [room, setRoom] = useState<RoomState | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const actionSent = useRef(false);

  useEffect(() => {
    if (!state) navigate('/sipit-or-dipit', { replace: true });
  }, [state, navigate]);

  const handleLeave = useCallback(() => {
    send({ type: 'leave_room' });
    disconnect();
    clearSession();
    navigate('/sipit-or-dipit', { replace: true });
  }, [send, disconnect, navigate]);

  const handleRejoin = useCallback(() => {
    if (!state) return;
    actionSent.current = false;
    setErrorMsg('');
    connect();
  }, [state, connect]);

  const handleDelete = useCallback(() => send({ type: 'delete_room' }), [send]);
  const handleStartGame = useCallback(() => send({ type: 'start_game' }), [send]);
  const handleDrawCard = useCallback(() => send({ type: 'draw_card' }), [send]);
  const handleRevealCard = useCallback(() => send({ type: 'reveal_card' }), [send]);
  const handleNextTurn = useCallback(() => send({ type: 'next_turn' }), [send]);

  useEffect(() => {
    on('room_state', (msg) => {
      const data = msg as unknown as RoomState & { type: string };
      setRoom(data);
      setErrorMsg('');

      if (state) {
        saveSession({
          roomCode: data.room_code,
          playerName: state.playerName,
          gameId: data.game_id,
        });
      }
    });
    on('error', (msg) => {
      const errorMessage = (msg.message as string) || t('game.error.generic', lang);
      if (errorMessage.includes('Room not found')) {
        clearSession();
        disconnect();
        navigate('/sipit-or-dipit', { replace: true, state: { roomNotFound: errorMessage } });
      } else {
        setErrorMsg(errorMessage);
      }
    });
    on('room_deleted', () => {
      disconnect();
      clearSession();
      navigate('/sipit-or-dipit', { replace: true, state: { deleted: true } });
    });
  }, [on, disconnect, navigate, state, lang]);

  useEffect(() => {
    if (!state) return;
    connect();
  }, [state, connect]);

  useEffect(() => {
    if (status !== 'connected' || !state || actionSent.current) return;
    actionSent.current = true;
    if (state.action === 'create') {
      send({ type: 'create_room', player_name: state.playerName, game_id: state.gameId });
    } else {
      send({ type: 'join_room', room_code: state.roomCode, player_name: state.playerName, game_id: state.gameId });
    }
  }, [status, state, send]);

  if (!state) return null;

  const isMyTurn = room ? room.viewer_id === room.current_player_id : false;
  const isHost = room ? room.viewer_id === room.host_id : false;
  const connectedPlayers = room?.players.filter(p => p.is_connected) ?? [];

  /* ─────────────── Connecting / loading ─────────────── */
  if (!room || status === 'connecting' || status === 'idle') {
    return (
      <div className="min-h-svh flex flex-col bg-[#0a0a0f]">
        <GameNavbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <Loader size={32} className="text-yellow-400 animate-spin" strokeWidth={2} />
          <p className="text-white/50 text-sm sm:text-base">
            {status === 'connecting' ? t('game.connecting', lang) : t('game.loading', lang)}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'disconnected' || status === 'error') {
    return (
      <div className="min-h-svh flex flex-col bg-[#0a0a0f]">
        <GameNavbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <p className="text-white/60 text-center text-base sm:text-lg">{t('game.connection_lost', lang)}</p>
          <p className="text-white/40 text-center text-sm">{t('game.reconnecting', lang)}</p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={handleRejoin}
              className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-6 py-3
                         rounded-xl transition-all active:scale-95"
            >
              <RotateCcw size={16} strokeWidth={2.5} />
              {t('game.rejoin', lang)}
            </button>
            <button
              onClick={() => {
                clearSession();
                disconnect();
                navigate('/sipit-or-dipit', { replace: true });
              }}
              className="bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 font-semibold px-6 py-3
                         rounded-xl transition-all active:scale-95"
            >
              {t('game.back_to_lobby', lang)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────── Waiting Room (lobby) ─────────────── */
  if (room.status === 'lobby') {
    return (
      <div className="min-h-svh flex flex-col bg-[#0a0a0f] bg-grid">
        <GameNavbar roomCode={room.room_code} onLeave={handleLeave} />

        <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10
                        flex flex-col gap-6 sm:gap-8">

          {/* Desktop: 2-column layout. Mobile: stacked */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8 flex-1">

            {/* LEFT — Room code (lg: 2 cols) */}
            <div className="lg:col-span-2 flex flex-col gap-6 fade-up">
              <div className="bg-[#13131a] border border-white/8 rounded-2xl sm:rounded-3xl
                             p-6 sm:p-8 flex flex-col items-center">
                <RoomCode code={room.room_code} />
                <p className="text-center text-white/30 text-xs sm:text-sm mt-4 max-w-[240px]">
                  {t('game.share_code', lang)}
                </p>
              </div>

              {/* Status badge */}
              <div className="hidden lg:flex bg-yellow-400/10 border border-yellow-400/20
                             rounded-2xl px-5 py-4 items-center gap-3">
                <Hourglass size={18} className="text-yellow-400 shrink-0" strokeWidth={2} />
                <div>
                  <p className="text-yellow-400 font-bold text-sm">{t('game.waiting_for_players', lang)}</p>
                  <p className="text-yellow-400/60 text-xs mt-0.5">
                    {connectedPlayers.length < 2
                      ? t('game.need_more_to_start', lang, { count: 2 - connectedPlayers.length })
                      : t('game.ready_to_start', lang)}
                  </p>
                </div>
              </div>
            </div>

            {/* RIGHT — Players + actions (lg: 3 cols) */}
            <div className="lg:col-span-3 flex flex-col gap-4 fade-up">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-white/40" strokeWidth={2} />
                  <span className="text-white/40 text-xs sm:text-sm font-bold uppercase tracking-widest">
                    {t('game.players', lang)} ({connectedPlayers.length})
                  </span>
                </div>
              </div>

              <PlayerList players={room.players} viewerId={room.viewer_id} />

              {errorMsg && (
                <p className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20
                             rounded-xl px-4 py-3 fade-in">
                  {errorMsg}
                </p>
              )}

              <div className="flex flex-col gap-3 mt-2 lg:mt-auto">
                {isHost ? (
                  <>
                    <button
                      onClick={handleStartGame}
                      disabled={connectedPlayers.length < 2}
                      className="w-full flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300
                                disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]
                                text-black font-bold px-5 py-4 sm:py-5 rounded-xl text-base sm:text-lg
                                transition-all shadow-lg shadow-yellow-400/20"
                    >
                      <Play size={18} strokeWidth={2.5} />
                      {connectedPlayers.length < 2 ? t('game.waiting_for_more', lang) : t('game.start_game', lang)}
                    </button>

                    <button
                      onClick={handleDelete}
                      className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20
                                active:scale-[0.98] text-red-400 font-semibold px-5 py-3 rounded-xl
                                transition-all border border-red-500/20 text-sm"
                    >
                      <Trash2 size={15} strokeWidth={2} />
                      {t('game.delete_room', lang)}
                    </button>
                  </>
                ) : (
                  <div className="bg-white/4 border border-white/5 rounded-xl px-4 py-4 text-center">
                    <p className="text-white/60 text-sm">
                      {(() => {
                        const text = t('game.waiting_for_host', lang, { host: '__HOST__' });
                        const [before, after] = text.split('__HOST__');
                        return (<>{before}<span className="text-white font-bold">{room.host_name}</span>{after}</>);
                      })()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* ─────────────── Game Playing ─────────────── */
  return (
    <div className="min-h-svh flex flex-col bg-[#0a0a0f] bg-grid">
      <GameNavbar roomCode={room.room_code} onLeave={handleLeave} />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6
                      flex flex-col gap-4 sm:gap-5">

        {/* Desktop: 3-column layout. Mobile: stacked */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 flex-1">

          {/* LEFT SIDEBAR (desktop only) — Players */}
          <aside className="hidden lg:flex lg:col-span-3 flex-col gap-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users size={13} className="text-white/40" strokeWidth={2} />
                <span className="text-white/40 text-xs font-bold uppercase tracking-widest">
                  {t('game.players', lang)} ({connectedPlayers.length})
                </span>
              </div>
              <PlayerList
                players={room.players}
                currentPlayerId={room.current_player_id}
                viewerId={room.viewer_id}
                compact
              />
            </div>
          </aside>

          {/* CENTER — Card area */}
          <section className="lg:col-span-6 flex flex-col gap-4">

            {/* Turn indicator */}
            <div className="flex items-center justify-between fade-up">
              <div className="min-w-0">
                {isMyTurn ? (
                  <p className="text-yellow-400 font-black text-xl sm:text-2xl">{t('game.your_turn', lang)}</p>
                ) : (
                  <p className="text-white/60 text-base sm:text-lg truncate">
                    {(() => {
                      const text = t('game.current_turn', lang, { name: '__NAME__' });
                      const [before, after] = text.split('__NAME__');
                      return (<>{before}<span className="text-white font-bold">{room.current_player_name}</span>{after}</>);
                    })()}
                  </p>
                )}
                <p className="text-white/30 text-xs sm:text-sm mt-0.5">
                  {t('game.active_rules_count', lang, { count: room.active_rules.length })}
                </p>
              </div>

              {/* Compact player avatars (mobile only) */}
              <div className="flex -space-x-2 lg:hidden">
                {room.players.filter(p => p.is_connected).slice(0, 5).map(p => (
                  <div
                    key={p.id}
                    title={p.name}
                    className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-bold
                      ${p.id === room.current_player_id
                        ? 'border-yellow-400 bg-yellow-400 text-black z-10 shadow-lg shadow-yellow-400/30'
                        : 'border-[#0a0a0f] bg-white/10 text-white/70'
                      }`}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                ))}
                {room.players.filter(p => p.is_connected).length > 5 && (
                  <div className="w-9 h-9 rounded-full border-2 border-[#0a0a0f] bg-white/10
                                  flex items-center justify-center text-xs font-bold text-white/70">
                    +{room.players.filter(p => p.is_connected).length - 5}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile: Active rules above card */}
            {room.active_rules.length > 0 && (
              <div className="lg:hidden fade-up">
                <ActiveRules rules={room.active_rules} />
              </div>
            )}

            {/* Card / deck */}
            <div className="flex-1 flex flex-col justify-center py-2 sm:py-4">
              {room.current_card && room.card_drawn ? (
                <div key={room.current_card.id}>
                  <PlayingCard
                    card={room.current_card}
                    revealed={room.card_revealed}
                    canReveal={isMyTurn && !room.card_revealed}
                    onReveal={handleRevealCard}
                  />
                </div>
              ) : (
                <CardDeck
                  isMyTurn={isMyTurn && !room.card_drawn}
                  onDraw={handleDrawCard}
                />
              )}
            </div>

            {/* Error */}
            {errorMsg && (
              <p className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20
                           rounded-xl px-4 py-3 fade-in">
                {errorMsg}
              </p>
            )}

            {/* Bottom actions */}
            <div className="fade-up">
              {isMyTurn && room.card_drawn && room.card_revealed && (
                <button
                  onClick={handleNextTurn}
                  className="w-full flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300
                            active:scale-[0.98] text-black font-bold px-5 py-4 sm:py-5
                            rounded-xl text-base sm:text-lg transition-all shadow-lg shadow-yellow-400/20"
                >
                  {t('game.next_turn', lang)}
                  <ChevronRight size={18} strokeWidth={2.5} />
                </button>
              )}

              {isMyTurn && room.card_drawn && !room.card_revealed && (
                <p className="text-center text-white/30 text-sm py-2">
                  {t('game.tap_to_reveal', lang)}
                </p>
              )}

              {isMyTurn && !room.card_drawn && (
                <p className="text-center text-white/30 text-sm py-2">
                  {t('game.tap_to_draw', lang)}
                </p>
              )}

              {!isMyTurn && (
                <div className="bg-white/4 border border-white/5 rounded-xl px-4 py-3 sm:py-4 text-center">
                  <p className="text-white/40 text-sm">
                    {(() => {
                      const key = (room.card_drawn && !room.card_revealed)
                        ? 'game.waiting_to_reveal'
                        : 'game.waiting_for_player';
                      const text = t(key, lang, { name: '__NAME__' });
                      const [before, after] = text.split('__NAME__');
                      return (<>{before}<span className="text-white/80 font-bold">{room.current_player_name}</span>{after}</>);
                    })()}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* RIGHT SIDEBAR (desktop only) — Active rules */}
          <aside className="hidden lg:flex lg:col-span-3 flex-col gap-4">
            {room.active_rules.length > 0 ? (
              <ActiveRules rules={room.active_rules} />
            ) : (
              <div className="bg-white/4 border border-white/5 border-dashed rounded-xl
                             p-6 text-center">
                <p className="text-white/30 text-sm">{t('game.no_active_rules', lang)}</p>
                <p className="text-white/20 text-xs mt-1">{t('game.rules_appear_here', lang)}</p>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
