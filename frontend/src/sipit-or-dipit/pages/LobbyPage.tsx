import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Users, Plus, LogIn, Flame, ChevronRight, ArrowLeft } from 'lucide-react';
import { GameNavbar } from '../navbar/GameNavbar';
import { Footer } from '../../shared/components/Footer';
import { Toast } from '../../shared/components/Toast';
import { useClearSEO } from '../../shared/hooks/useClearSEO';
import { useLanguage } from '../../shared/i18n/useLanguage';
import { t } from '../../shared/i18n/translations';
import { FlagToggle } from '../../shared/i18n/FlagIcon';

type Mode = 'select' | 'create' | 'join';

export function LobbyPage() {
  useClearSEO();
  const navigate = useNavigate();
  const location = useLocation();
  const [lang, setLang] = useLanguage();
  const [mode, setMode] = useState<Mode>('select');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    const state = location.state as Record<string, unknown> | null;
    if (state?.roomNotFound) {
      setToastMsg(state.roomNotFound as string);
      navigate('/sipit-or-dipit', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  const handleCreate = () => {
    const name = playerName.trim();
    if (!name) { setError(t('lobby.error.name_required', lang)); return; }
    sessionStorage.setItem('dh_player_name', name);
    navigate('/sipit-or-dipit/room', {
      state: { action: 'create', playerName: name, gameId: 'sipit-or-dipit' }
    });
  };

  const handleJoin = () => {
    const name = playerName.trim();
    const code = roomCode.trim().toUpperCase();
    if (!name) { setError(t('lobby.error.name_required', lang)); return; }
    if (code.length !== 6) { setError(t('lobby.error.code_length', lang)); return; }
    sessionStorage.setItem('dh_player_name', name);
    navigate('/sipit-or-dipit/room', {
      state: { action: 'join', playerName: name, roomCode: code, gameId: 'sipit-or-dipit' }
    });
  };

  return (
    <div className="min-h-svh flex flex-col bg-[#0a0a0f] bg-grid">
      {toastMsg && (
        <Toast
          message={toastMsg}
          type="error"
          onClose={() => setToastMsg('')}
          autoCloseDuration={5000}
        />
      )}
      <GameNavbar />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12 lg:py-16
                       flex flex-col">

        {/* ─────────── Hero ─────────── */}
        <div className="text-center mb-6 sm:mb-10 lg:mb-12 fade-up">
          <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-3xl bg-amber-500
                         mx-auto mb-4 sm:mb-6 flex items-center justify-center
                         shadow-2xl shadow-amber-500/30 float">
            <Flame size={40} className="text-white sm:hidden" strokeWidth={1.5} />
            <Flame size={48} className="text-white hidden sm:block lg:hidden" strokeWidth={1.5} />
            <Flame size={56} className="text-white hidden lg:block" strokeWidth={1.5} />
          </div>
          <h1 className="text-white font-black tracking-tight mb-3 text-balance
                         text-3xl sm:text-4xl lg:text-5xl">
            SipIt Or DipIt
          </h1>
          <p className="text-white/50 text-sm sm:text-base lg:text-lg leading-relaxed
                       max-w-md mx-auto text-balance">
            {t('lobby.tagline', lang)}
          </p>
        </div>

        {/* ─────────── Action card ─────────── */}
        <div className="bg-[#13131a] border border-white/8 rounded-2xl sm:rounded-3xl
                       p-5 sm:p-7 lg:p-8 fade-up shadow-2xl shadow-black/30">

          {mode === 'select' && (
            <div className="flex flex-col gap-3">
              <p className="text-center text-white/40 text-sm mb-2">
                {t('lobby.subtitle', lang)}
              </p>

              <button
                onClick={() => setMode('create')}
                className="w-full flex items-center justify-between gap-3 bg-yellow-400 hover:bg-yellow-300
                          active:scale-[0.98] text-black font-bold px-5 sm:px-6 py-4 sm:py-5
                          rounded-xl sm:rounded-2xl transition-all
                          shadow-lg shadow-yellow-400/20"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-black/10 flex items-center justify-center">
                    <Plus size={20} strokeWidth={2.5} />
                  </div>
                  <div className="text-left">
                    <p className="text-base sm:text-lg">{t('lobby.create', lang)}</p>
                    <p className="text-xs sm:text-sm font-medium opacity-70">{t('lobby.create.subtitle', lang)}</p>
                  </div>
                </div>
                <ChevronRight size={20} strokeWidth={2.5} />
              </button>

              <button
                onClick={() => setMode('join')}
                className="w-full flex items-center justify-between gap-3 bg-white/8 hover:bg-white/12
                          active:scale-[0.98] text-white font-bold px-5 sm:px-6 py-4 sm:py-5
                          rounded-xl sm:rounded-2xl transition-all border border-white/10"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                    <LogIn size={20} strokeWidth={2} />
                  </div>
                  <div className="text-left">
                    <p className="text-base sm:text-lg">{t('lobby.join', lang)}</p>
                    <p className="text-xs sm:text-sm font-medium opacity-50">{t('lobby.join.subtitle', lang)}</p>
                  </div>
                </div>
                <ChevronRight size={20} strokeWidth={2} />
              </button>
            </div>
          )}

          {(mode === 'create' || mode === 'join') && (
            <div className="flex flex-col gap-4 sm:gap-5">
              <button
                onClick={() => { setMode('select'); setError(''); }}
                className="flex items-center gap-2 text-white/40 hover:text-white/80 text-sm
                          transition-colors -mb-1 self-start"
              >
                <ArrowLeft size={14} strokeWidth={2} />
                {t('common.back', lang)}
              </button>

              <div>
                <label className="text-white/50 text-xs font-bold uppercase tracking-widest block mb-2">
                  {t('lobby.your_name', lang)}
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={e => { setPlayerName(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && (mode === 'create' ? handleCreate() : handleJoin())}
                  placeholder={t('lobby.your_name.placeholder', lang)}
                  maxLength={20}
                  className="w-full bg-white/5 border-2 border-white/10 rounded-xl
                            px-4 py-3 sm:py-4 text-white text-base sm:text-lg
                            placeholder-white/20 focus:outline-none focus:border-yellow-400/60
                            focus:bg-white/8 transition-all"
                  autoFocus
                />
              </div>

              {mode === 'join' && (
                <div>
                  <label className="text-white/50 text-xs font-bold uppercase tracking-widest block mb-2">
                    {t('lobby.room_code', lang)}
                  </label>
                  <input
                    type="text"
                    value={roomCode}
                    onChange={e => { setRoomCode(e.target.value.toUpperCase().slice(0, 6)); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleJoin()}
                    placeholder="ABCDEF"
                    maxLength={6}
                    autoComplete="off"
                    className="w-full bg-white/5 border-2 border-white/10 rounded-xl
                              px-4 py-3 sm:py-4 text-white text-xl sm:text-2xl font-black font-mono
                              placeholder-white/15 focus:outline-none focus:border-yellow-400/60
                              focus:bg-white/8 transition-all
                              text-center tracking-[0.25em]"
                  />
                </div>
              )}

              <FlagToggle value={lang} onChange={setLang} label={t('lobby.language', lang)} />

              {error && (
                <p className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20
                             rounded-xl px-4 py-2.5 fade-in">
                  {error}
                </p>
              )}

              <button
                onClick={mode === 'create' ? handleCreate : handleJoin}
                className="w-full flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300
                          active:scale-[0.98] text-black font-bold
                          px-5 py-4 sm:py-5 rounded-xl text-base sm:text-lg
                          transition-all shadow-lg shadow-yellow-400/20 mt-1"
              >
                {mode === 'create'
                  ? <Plus size={18} strokeWidth={2.5} />
                  : <Users size={18} strokeWidth={2} />}
                {mode === 'create' ? t('lobby.create_room_btn', lang) : t('lobby.join_room_btn', lang)}
              </button>
            </div>
          )}
        </div>

        {/* ─────────── Stats footer ─────────── */}
        <div className="mt-6 sm:mt-10 fade-up">
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {[
              { count: 60, key: 'lobby.stats.challenges' as const, color: 'text-amber-400' },
              { count: 60, key: 'lobby.stats.truths' as const, color: 'text-violet-400' },
              { count: 40, key: 'lobby.stats.rules' as const, color: 'text-blue-400' },
              { count: 40, key: 'lobby.stats.penalties' as const, color: 'text-rose-400' },
            ].map(stat => (
              <div key={stat.key}
                   className="bg-white/4 border border-white/5 rounded-xl
                             px-2 sm:px-3 py-3 sm:py-4 text-center">
                <p className={`text-xl sm:text-2xl font-black ${stat.color}`}>{stat.count}</p>
                <p className="text-white/40 text-[10px] sm:text-xs font-medium mt-0.5">{t(stat.key, lang)}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
