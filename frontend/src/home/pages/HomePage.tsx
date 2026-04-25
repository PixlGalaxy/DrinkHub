import { Layers, Flame, Sparkles } from 'lucide-react';
import { HomeNavbar } from '../navbar/HomeNavbar';
import { GameCard } from '../components/GameCard';
import { Footer } from '../../shared/components/Footer';

const GAMES = [
  {
    title: 'SipIt Or DipIt',
    description: 'Draw cards, face challenges, answer truths, and follow wild rules — or take a sip. The ultimate party card game.',
    route: '/sipit-or-dipit',
    icon: Flame,
    accentColor: 'bg-amber-500',
    gradientColor: 'from-amber-500 to-orange-600',
    badgeText: 'Card Game',
    players: '2–10 players',
    tags: ['Challenges', 'Truth', 'Rules', 'Penalties'],
    available: true,
  },
];

export function HomePage() {
  return (
    <div className="min-h-svh flex flex-col bg-[#0a0a0f] bg-grid">
      <HomeNavbar />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 lg:py-14">

        {/* ─────────── Hero ─────────── */}
        <div className="mb-8 sm:mb-12 lg:mb-16 fade-up max-w-3xl">
          <div className="flex items-center gap-2 mb-3">
            <Layers size={14} className="text-yellow-400" />
            <span className="text-yellow-400 text-xs sm:text-sm font-semibold uppercase tracking-widest">
              Game Library
            </span>
          </div>
          <h1 className="text-white font-black tracking-tight leading-[1.05] text-balance
                         text-4xl sm:text-5xl lg:text-6xl xl:text-7xl">
            Pick a game,<br />
            <span className="text-yellow-400">start the fun.</span>
          </h1>
          <p className="text-white/50 text-sm sm:text-base lg:text-lg mt-4 sm:mt-6 max-w-xl text-balance">
            Multiplayer party games for game nights, pregames, and any hangout that needs a spark.
          </p>
        </div>

        {/* ─────────── Games grid ─────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
          {GAMES.map((game, i) => (
            <div
              key={game.route}
              className="fade-up"
              style={{ animationDelay: `${i * 75}ms` }}
            >
              <GameCard {...game} />
            </div>
          ))}

          {/* Coming soon placeholder cards */}
          {[0, 1].map(i => (
            <div
              key={`soon-${i}`}
              className="fade-up bg-[#0f0f17] border border-white/5 border-dashed
                         rounded-2xl p-6 sm:p-7 flex flex-col items-center justify-center
                         min-h-[260px] sm:min-h-[300px]"
              style={{ animationDelay: `${(GAMES.length + i) * 75}ms` }}
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-3">
                <Sparkles size={20} className="text-white/30" strokeWidth={1.5} />
              </div>
              <p className="text-white/30 text-sm font-medium text-center">More games<br />coming soon</p>
            </div>
          ))}
        </div>

        {/* ─────────── Stats (desktop only) ─────────── */}
        <div className="mt-12 sm:mt-16 lg:mt-20 hidden sm:block fade-up">
          <div className="border-t border-white/5 pt-8">
            <div className="grid grid-cols-3 gap-6 max-w-2xl">
              <div>
                <p className="text-yellow-400 text-2xl lg:text-3xl font-black">100+</p>
                <p className="text-white/40 text-xs lg:text-sm mt-1">Cards in SipIt Or DipIt</p>
              </div>
              <div>
                <p className="text-yellow-400 text-2xl lg:text-3xl font-black">2-10</p>
                <p className="text-white/40 text-xs lg:text-sm mt-1">Players per room</p>
              </div>
              <div>
                <p className="text-yellow-400 text-2xl lg:text-3xl font-black">∞</p>
                <p className="text-white/40 text-xs lg:text-sm mt-1">Unique sessions</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
