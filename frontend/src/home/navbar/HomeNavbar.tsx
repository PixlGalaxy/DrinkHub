import { Wine } from 'lucide-react';
import { Link } from 'react-router-dom';

export function HomeNavbar() {
  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0f]/85 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 text-white font-bold text-lg md:text-2xl tracking-tight"
        >
          <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg bg-yellow-400 flex items-center justify-center
                          shadow-lg shadow-yellow-400/20">
            <Wine size={18} className="text-black md:w-8 md:h-8" strokeWidth={2.5} />
          </div>
          DrinkHub
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
