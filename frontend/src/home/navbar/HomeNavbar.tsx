import { Wine } from 'lucide-react';
import { Link } from 'react-router-dom';

export function HomeNavbar() {
  return (
    <header className="sticky top-0 z-50 glass border-b border-white/5">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 sm:gap-2.5 text-white font-bold text-sm sm:text-base tracking-tight min-w-0 transition-all hover:text-yellow-400 group"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shrink-0
                          glow-amber group-hover:scale-110 transition-transform duration-300">
            <Wine size={14} className="text-black sm:hidden" strokeWidth={2.5} />
            <Wine size={16} className="text-black hidden sm:block" strokeWidth={2.5} />
          </div>
          <span className="truncate">DrinkHub</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-6">
          <Link
            to="/"
            className="text-sm text-white/70 hover:text-white transition-colors font-medium"
          >
            Games
          </Link>
          <span className="text-xs text-white/30 font-medium uppercase tracking-widest">
            Free · No signup
          </span>
        </nav>

        {/* Mobile badge */}
        <span className="sm:hidden text-[10px] text-white/30 font-bold uppercase tracking-widest
                        bg-white/5 px-2.5 py-1 rounded-full">
          Games
        </span>
      </div>
    </header>
  );
}
