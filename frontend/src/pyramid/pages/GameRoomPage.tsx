import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Play, Trash2, Users, Loader, RotateCcw, ChevronRight, Hourglass, Trophy, Check,
} from 'lucide-react';
import { useWebSocket } from '../../shared/hooks/useWebSocket';
import { useClearSEO } from '../../shared/hooks/useClearSEO';
import type { PyramidRoomState } from '../../shared/types';
import { GameNavbar } from '../navbar/GameNavbar';
import { PyramidScroll } from '../components/PyramidScroll';
import { PlayerHand } from '../components/PlayerHand';
import { RoomCode } from '../../sipit-or-dipit/components/RoomCode';
import { PlayerList } from '../../sipit-or-dipit/components/PlayerList';
import { useLanguage } from '../../shared/i18n/useLanguage';
import { t } from '../../shared/i18n/translations';

const SESSION_KEY = 'dh_pyramid_session';

type LocationState = {
  action: 'create' | 'join';
  playerName: string;
  roomCode?: string;
  gameId: string;
};

type StoredSession = { roomCode: string; playerName: string; gameId: string };

function saveSession(s: StoredSession) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch {}
}
function loadSession(): StoredSession | null {
  try { const r = localStorage.getItem(SESSION_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

export function GameRoomPage() {
  useClearSEO();
  const navigate = useNavigate();
  const location = useLocation();
  const passedState = location.state as LocationState | null;
  const [lang] = useLanguage();

  const [initState] = useState<LocationState | null>(() => {
    if (passedState) return passedState;
    const stored = loadSession();
    if (stored) return { action: 'join', playerName: stored.playerName, roomCode: stored.roomCode, gameId: stored.gameId };
    return null;
  });

  const { connect, disconnect, send, on, status } = useWebSocket();
  const [room, setRoom] = useState<PyramidRoomState | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const actionSent = useRef(false);


  useEffect(() => {
    if (!initState) navigate('/pyramid', { replace: true });
  }, [initState, navigate]);

  const handleLeave = useCallback(() => {
    // Don't send leave_room — server marks player as disconnected (2-min timeout).
    // Keep session so they can reconnect from the lobby within that window.
    disconnect();
    navigate('/pyramid', { replace: true });
  }, [disconnect, navigate]);

  const handleRejoin = useCallback(() => {
    if (!initState) return;
    actionSent.current = false;
    setErrorMsg('');
    connect();
  }, [initState, connect]);

  const handleDelete = useCallback(() => send({ type: 'delete_room' }), [send]);
  const handleStartGame = useCallback(() => send({ type: 'start_game' }), [send]);

  const handleVoteNext = useCallback(() => {
    send({ type: 'pyramid_vote_next' });
  }, [send]);

  const handlePlayAgain = useCallback(() => {
    send({ type: 'restart_game' });
  }, [send]);


  useEffect(() => {
    on('room_state', (msg) => {
      const data = msg as unknown as PyramidRoomState & { type: string };
      setRoom(data);
      setErrorMsg('');
      if (initState) {
        saveSession({ roomCode: data.room_code, playerName: initState.playerName, gameId: data.game_id });
      }
    });
    on('error', (msg) => {
      const err = (msg.message as string) || t('game.error.generic', lang);
      if (err.includes('Room not found')) {
        clearSession();
        disconnect();
        navigate('/pyramid', { replace: true, state: { roomNotFound: err } });
      } else {
        setErrorMsg(err);
      }
    });
    on('room_deleted', () => {
      disconnect();
      clearSession();
      navigate('/pyramid', { replace: true, state: { deleted: true } });
    });
  }, [on, disconnect, navigate, initState, lang]);

  useEffect(() => {
    if (!initState) return;
    connect();
    return () => { disconnect(); };
  }, [initState, connect, disconnect]);

  useEffect(() => {
    if (status !== 'connected' || !initState || actionSent.current) return;
    actionSent.current = true;
    if (initState.action === 'create') {
      send({ type: 'create_room', player_name: initState.playerName, game_id: initState.gameId });
    } else {
      send({ type: 'join_room', room_code: initState.roomCode, player_name: initState.playerName, game_id: initState.gameId });
    }
  }, [status, initState, send]);

  if (!initState) return null;

  const isHost = room ? room.viewer_id === room.host_id : false;
  const connectedPlayers = room?.players.filter(p => p.is_connected) ?? [];
  const pd = room?.pyramid_data;
  const hand = room?.viewer_hand ?? [];

  // Pyramid derived state
  const currentIdx = pd?.current_pyramid_index ?? -1;
  const nextVotes = pd?.next_votes ?? [];
  const totalCards = pd?.total ?? 10;
  const currentCard = pd ? pd.pyramid_cards[currentIdx] : null;
  const gameFinished = room?.status === 'finished';
  const allRevealed = currentIdx >= totalCards - 1 && currentIdx >= 0;
  const hasVoted = room ? nextVotes.includes(room.viewer_id) : false;
  const canRevealMore = !gameFinished;


  /* ── Connecting / loading ───────────────────────────────── */
  if (!room || status === 'connecting' || status === 'idle') {
    return (
      <div className="min-h-svh flex flex-col bg-[#0a0a0f]">
        <GameNavbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          {errorMsg ? (
            <>
              <p className="text-red-400 text-center text-sm sm:text-base max-w-xs">{errorMsg}</p>
              <button
                onClick={() => { disconnect(); navigate('/pyramid', { replace: true }); }}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10
                           text-white/70 font-semibold px-6 py-3 rounded-xl transition-all active:scale-95 text-sm"
              >
                {t('game.back_to_lobby', lang)}
              </button>
            </>
          ) : (
            <>
              <Loader size={32} className="text-purple-400 animate-spin" strokeWidth={2} />
              <p className="text-white/50 text-sm sm:text-base">
                {status === 'connecting' ? t('game.connecting', lang) : t('game.loading', lang)}
              </p>
            </>
          )}
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
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3
                         rounded-xl transition-all active:scale-95"
            >
              <RotateCcw size={16} strokeWidth={2.5} />
              {t('game.rejoin', lang)}
            </button>
            <button
              onClick={() => { clearSession(); disconnect(); navigate('/pyramid', { replace: true }); }}
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

  /* ── Lobby (waiting room) ───────────────────────────────── */
  if (room.status === 'lobby') {
    return (
      <div className="min-h-svh flex flex-col bg-[#0a0a0f] bg-grid">
        <GameNavbar roomCode={room.room_code} onLeave={handleLeave} />

        <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex flex-col gap-6 sm:gap-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8 flex-1">

            {/* Room code */}
            <div className="lg:col-span-2 flex flex-col gap-6 fade-up">
              <div className="bg-[#13131a] border border-white/8 rounded-2xl sm:rounded-3xl p-6 sm:p-8 flex flex-col items-center">
                <RoomCode code={room.room_code} />
                <p className="text-center text-white/30 text-xs sm:text-sm mt-4 max-w-[240px]">
                  {t('game.share_code', lang)}
                </p>
              </div>
              <div className="hidden lg:flex bg-purple-500/10 border border-purple-500/20
                              rounded-2xl px-5 py-4 items-center gap-3">
                <Hourglass size={18} className="text-purple-400 shrink-0" strokeWidth={2} />
                <div>
                  <p className="text-purple-400 font-bold text-sm">{t('game.waiting_for_players', lang)}</p>
                  <p className="text-purple-400/60 text-xs mt-0.5">
                    {connectedPlayers.length < 2
                      ? t('game.need_more_to_start', lang, { count: 2 - connectedPlayers.length })
                      : t('game.ready_to_start', lang)}
                  </p>
                </div>
              </div>
            </div>

            {/* Players + actions */}
            <div className="lg:col-span-3 flex flex-col gap-4 fade-up">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-white/40" strokeWidth={2} />
                <span className="text-white/40 text-xs sm:text-sm font-bold uppercase tracking-widest">
                  {t('game.players', lang)} ({connectedPlayers.length})
                </span>
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
                      className="w-full flex items-center justify-center gap-2
                                 bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed
                                 active:scale-[0.98] text-white font-bold px-5 py-4 sm:py-5 rounded-xl
                                 text-base sm:text-lg transition-all shadow-lg shadow-purple-600/20"
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

  /* ── Game finished ──────────────────────────────────────── */
  if (gameFinished) {
    return (
      <div className="min-h-svh flex flex-col bg-[#0a0a0f] bg-grid">
        <GameNavbar roomCode={room.room_code} onLeave={handleLeave} />
        <main className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
          <div className="text-center fade-up">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-600 to-violet-800
                            mx-auto mb-5 flex items-center justify-center shadow-2xl shadow-purple-600/30">
              <Trophy size={36} className="text-white" strokeWidth={1.5} />
            </div>
            <h2 className="text-white font-black text-3xl sm:text-4xl mb-2">
              {lang === 'es' ? '¡Pirámide completada!' : 'Pyramid complete!'}
            </h2>
            <p className="text-white/50 text-sm sm:text-base max-w-sm mx-auto">
              {lang === 'es'
                ? 'Todas las cartas fueron reveladas. ¡Buen juego!'
                : 'All cards have been revealed. Good game!'}
            </p>
          </div>
          {pd && (
            <div className="w-full max-w-2xl">
              <PyramidScroll pyramidCards={pd.pyramid_cards} currentIndex={pd.current_pyramid_index} />
            </div>
          )}

          <div className="flex flex-col gap-3 w-full max-w-xs fade-up">
            <button
              onClick={handlePlayAgain}
              className="w-full flex items-center justify-center gap-2
                         bg-purple-600 hover:bg-purple-500 text-white font-bold
                         px-8 py-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-purple-600/20"
            >
              <RotateCcw size={16} strokeWidth={2.5} />
              {lang === 'es' ? 'Jugar de nuevo' : 'Play again'}
            </button>
            <button
              onClick={handleLeave}
              className="w-full flex items-center justify-center gap-2
                         bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 font-semibold
                         px-8 py-3 rounded-xl transition-all active:scale-95 text-sm"
            >
              {lang === 'es' ? 'Salir de la sala' : 'Leave room'}
            </button>
          </div>
        </main>
      </div>
    );
  }

  /* ── Playing ────────────────────────────────────────────── */
  return (
    <div className="min-h-svh flex flex-col bg-[#0a0a0f] bg-grid">
      <GameNavbar roomCode={room.room_code} onLeave={handleLeave} />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6
                       flex flex-col gap-4 sm:gap-5">

        {/* ── Pyramid scroll ── */}
        <section className="fade-up">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white/30 text-xs font-bold uppercase tracking-widest">
              {lang === 'es' ? 'Pirámide' : 'Pyramid'} · {Math.max(0, currentIdx + 1)}/{totalCards}
            </p>
            {currentCard?.revealed && currentCard.rank && (
              <span className="text-purple-300 text-xs font-bold bg-purple-500/15 border border-purple-500/25 rounded-full px-2.5 py-0.5">
                {lang === 'es' ? `Revelada: ${currentCard.rank}` : `Revealed: ${currentCard.rank}`}
              </span>
            )}
          </div>
          {pd && (
            <PyramidScroll
              pyramidCards={pd.pyramid_cards}
              currentIndex={currentIdx}
            />
          )}
        </section>

        {/* ── Vote + Claim action bar ── */}
        <section className="flex flex-col gap-3 fade-up">

          {/* Vote next */}
          {canRevealMore && (
            <div className="bg-[#12111e] border border-purple-900/30 rounded-xl px-4 py-3
                            flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white/70 text-sm font-bold">
                  {lang === 'es' ? 'Revelar siguiente carta' : 'Reveal next card'}
                </p>
                <p className="text-white/30 text-xs mt-0.5">
                  {nextVotes.length}/{connectedPlayers.length}{' '}
                  {lang === 'es' ? 'jugadores listos' : 'players ready'}
                </p>
              </div>
              <button
                onClick={handleVoteNext}
                disabled={hasVoted}
                className={`flex items-center gap-2 font-bold px-5 py-2.5 rounded-xl text-sm transition-all active:scale-95
                  ${hasVoted
                    ? 'bg-purple-600/30 text-purple-300/50 cursor-not-allowed border border-purple-600/20'
                    : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20'
                  }`}
              >
                {hasVoted
                  ? <><Check size={14} strokeWidth={2.5} />{lang === 'es' ? 'Listo' : 'Ready'}</>
                  : allRevealed
                    ? (lang === 'es' ? 'Terminar' : 'Finish')
                    : (lang === 'es' ? 'Siguiente' : 'Next')}
                {!hasVoted && <ChevronRight size={16} strokeWidth={2.5} />}
              </button>
            </div>
          )}

        </section>

        {/* ── Error ── */}
        {errorMsg && (
          <p className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20
                        rounded-xl px-4 py-3 fade-in">
            {errorMsg}
          </p>
        )}

        {/* ── Player hand ── */}
        {hand.length > 0 && (
          <section className="bg-[#0e0c1c] border border-purple-900/25 rounded-2xl p-4 fade-up">
            <PlayerHand hand={hand} />
          </section>
        )}

        {/* ── Players (mobile compact) ── */}
        <section className="lg:hidden fade-up">
          <div className="flex items-center gap-2 mb-2">
            <Users size={12} className="text-white/30" strokeWidth={2} />
            <span className="text-white/30 text-xs font-bold uppercase tracking-widest">
              {t('game.players', lang)} ({connectedPlayers.length})
            </span>
          </div>
          <PlayerList players={room.players} currentPlayerId="" viewerId={room.viewer_id} compact />
        </section>

      </main>
    </div>
  );
}
