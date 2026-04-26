import { Layers, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../shared/i18n/useLanguage';
import { t } from '../../shared/i18n/translations';
import { FlagToggle } from '../../shared/i18n/FlagIcon';

interface GameNavbarProps {
  roomCode?: string;
  onLeave?: () => void;
}

export function GameNavbar({ roomCode, onLeave }: GameNavbarProps) {
  const [lang, setLang] = useLanguage();

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/5">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">

        <Link
          to="/"
          className="flex items-center gap-2 sm:gap-2.5 text-white font-bold text-sm sm:text-base tracking-tight min-w-0 transition-all hover:text-purple-400 group"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-purple-500 to-violet-700 flex items-center justify-center shrink-0
                          group-hover:scale-110 transition-transform duration-300">
            <Layers size={14} className="text-white sm:hidden" strokeWidth={2} />
            <Layers size={16} className="text-white hidden sm:block" strokeWidth={2} />
          </div>
          <span className="truncate">Pyramid</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <FlagToggle value={lang} onChange={setLang} variant="pill" size="sm" />

          {roomCode && (
            <div className="flex items-center gap-1.5 glass hover:glass-strong transition-all
                            rounded-lg px-2.5 sm:px-3 py-1.5">
              <span className="text-[10px] sm:text-xs text-white/40 font-medium hidden sm:inline">
                {t('nav.room', lang)}
              </span>
              <span className="text-xs sm:text-sm font-mono font-black text-purple-400 hover:text-violet-300 tracking-[0.1em] transition-colors">
                {roomCode}
              </span>
            </div>
          )}

          {onLeave && (
            <button
              onClick={onLeave}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg glass hover:glass-strong hover:bg-red-500/20
                         flex items-center justify-center text-white/50 hover:text-red-400 transition-all
                         active:scale-95"
              aria-label={t('nav.leave', lang)}
              title={t('nav.leave', lang)}
            >
              <LogOut size={15} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
