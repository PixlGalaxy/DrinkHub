import { Wine, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';

interface GameNavbarProps {
  roomCode?: string;
  onLeave?: () => void;
}

export function GameNavbar({ roomCode, onLeave }: GameNavbarProps) {
  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0f]/85 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">

        <Link
          to="/"
          className="flex items-center gap-2 sm:gap-2.5 text-white font-bold text-sm sm:text-base tracking-tight min-w-0"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-yellow-400 flex items-center justify-center shrink-0
                          shadow-lg shadow-yellow-400/20">
            <Wine size={14} className="text-black sm:hidden" strokeWidth={2.5} />
            <Wine size={16} className="text-black hidden sm:block" strokeWidth={2.5} />
          </div>
          <span className="truncate">SipIt Or DipIt</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {roomCode && (
            <div className="flex items-center gap-1.5 bg-white/5 hover:bg-white/8 transition-colors
                            border border-white/10 rounded-lg px-2.5 sm:px-3 py-1.5">
              <span className="text-[10px] sm:text-xs text-white/40 font-medium hidden sm:inline">Room</span>
              <span className="text-xs sm:text-sm font-mono font-black text-white tracking-[0.2em]">
                {roomCode}
              </span>
            </div>
          )}
          {onLeave && (
            <button
              onClick={onLeave}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white/5 hover:bg-red-500/15 hover:text-red-400
                         flex items-center justify-center text-white/50 transition-all
                         active:scale-95"
              aria-label="Leave room"
              title="Leave room"
            >
              <LogOut size={15} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
