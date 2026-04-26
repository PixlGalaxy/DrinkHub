import { useEffect, useRef, useState } from 'react';
import { Zap, MessageSquare, Shield, Skull, Wine, GlassWater } from 'lucide-react';
import type { Card, CardType } from '../../shared/types';

const CARD_CONFIG: Record<CardType, {
  gradient: string;
  border: string;
  icon: React.ElementType;
  label: string;
  iconBg: string;
  textMuted: string;
  drinkIcon: React.ElementType;
}> = {
  challenge: {
    gradient: 'from-amber-500 via-orange-500 to-amber-600',
    border: 'border-amber-400/40',
    icon: Zap,
    label: 'Challenge',
    iconBg: 'bg-amber-400/25',
    textMuted: 'text-amber-100/80',
    drinkIcon: GlassWater,
  },
  truth: {
    gradient: 'from-violet-600 via-purple-600 to-violet-700',
    border: 'border-violet-400/40',
    icon: MessageSquare,
    label: 'Truth',
    iconBg: 'bg-violet-400/25',
    textMuted: 'text-violet-100/80',
    drinkIcon: Wine,
  },
  rule: {
    gradient: 'from-blue-600 via-cyan-600 to-blue-700',
    border: 'border-blue-400/40',
    icon: Shield,
    label: 'Rule',
    iconBg: 'bg-blue-400/25',
    textMuted: 'text-blue-100/80',
    drinkIcon: GlassWater,
  },
  penalty: {
    gradient: 'from-rose-600 via-red-600 to-rose-700',
    border: 'border-rose-400/40',
    icon: Skull,
    label: 'Penalty',
    iconBg: 'bg-rose-400/25',
    textMuted: 'text-rose-100/80',
    drinkIcon: Wine,
  },
};

interface PlayingCardProps {
  card: Card;
}

export function PlayingCard({ card }: PlayingCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isEntering, setIsEntering] = useState(true);
  const prevCardId = useRef<string | null>(null);

  useEffect(() => {
    if (card.id !== prevCardId.current) {
      prevCardId.current = card.id;
      setIsFlipped(false);
      setIsEntering(true);
      const enterTimer = setTimeout(() => setIsEntering(false), 550);
      const flipTimer = setTimeout(() => setIsFlipped(true), 700);
      return () => {
        clearTimeout(enterTimer);
        clearTimeout(flipTimer);
      };
    }
  }, [card.id]);

  const cfg = CARD_CONFIG[card.type];
  const Icon = cfg.icon;
  const DrinkIcon = cfg.drinkIcon;

  return (
    <div
      className={`w-full max-w-[340px] sm:max-w-sm md:max-w-md mx-auto
                  h-[440px] sm:h-[500px] md:h-[560px]
                  card-flip-container cursor-pointer select-none
                  ${isEntering ? 'card-enter' : ''}`}
      onClick={() => !isFlipped && setIsFlipped(true)}
      aria-label={isFlipped ? `${card.type} card: ${card.title}` : 'Card face down — tap to reveal'}
    >
      <div className={`card-flip-inner ${isFlipped ? 'flipped' : ''}`}>

        {/* ── Card Back (face-down) ── */}
        <div className="card-face bg-[#12121c] border-2 border-yellow-400/40 shadow-2xl shadow-black/60">
          <div className="h-full flex flex-col items-center justify-center gap-4 sm:gap-5 p-6 sm:p-8 relative">
            <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-2xl
                            bg-yellow-400/10 border-2 border-yellow-400/30
                            flex items-center justify-center pulse-glow">
              <Wine size={32} className="text-yellow-400 sm:hidden" strokeWidth={1.5} />
              <Wine size={40} className="text-yellow-400 hidden sm:block md:hidden" strokeWidth={1.5} />
              <Wine size={48} className="text-yellow-400 hidden md:block" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-white font-black text-xl sm:text-2xl md:text-3xl tracking-tight leading-none">SipIt</p>
              <p className="text-yellow-400 font-black text-xl sm:text-2xl md:text-3xl tracking-tight leading-none mt-1">Or DipIt</p>
            </div>
            <p className="text-white/30 text-xs sm:text-sm font-medium mt-2">Tap to reveal</p>

            {/* Decorative corner dots */}
            <div className="absolute top-4 sm:top-5 left-4 sm:left-5 flex gap-1">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-yellow-400/30" />
              ))}
            </div>
            <div className="absolute bottom-4 sm:bottom-5 right-4 sm:right-5 flex gap-1">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-yellow-400/30" />
              ))}
            </div>
          </div>
        </div>

        {/* ── Card Front (face-up) ── */}
        <div className={`card-face card-face-back bg-gradient-to-br ${cfg.gradient}
                         border-2 ${cfg.border} shadow-2xl shadow-black/60`}>
          <div className="h-full flex flex-col p-5 sm:p-6 md:p-7 relative overflow-hidden">

            {/* Background glows */}
            <div className="absolute inset-0 opacity-25 pointer-events-none">
              <div className="absolute top-0 right-0 w-48 h-48 sm:w-64 sm:h-64 rounded-full bg-white blur-3xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-black blur-2xl" />
            </div>

            {/* Top bar */}
            <div className="flex items-center justify-between mb-4 sm:mb-5 relative z-10">
              <div className={`flex items-center gap-2 ${cfg.iconBg} backdrop-blur-sm
                              rounded-xl px-3 py-1.5 sm:px-4 sm:py-2 border border-white/10`}>
                <Icon size={14} className="text-white sm:hidden" strokeWidth={2.5} />
                <Icon size={16} className="text-white hidden sm:block" strokeWidth={2.5} />
                <span className="text-white font-bold text-xs sm:text-sm uppercase tracking-widest">
                  {cfg.label}
                </span>
              </div>
              {card.rounds && (
                <div className="bg-white/20 backdrop-blur-sm rounded-xl px-3 py-1.5 sm:px-4 sm:py-2 border border-white/10">
                  <span className="text-white font-bold text-xs sm:text-sm">{card.rounds} rounds</span>
                </div>
              )}
            </div>

            {/* Main icon */}
            <div className="flex justify-center my-3 sm:my-4 relative z-10">
              <div className={`w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24
                              rounded-2xl ${cfg.iconBg} border-2 border-white/20
                              flex items-center justify-center backdrop-blur-sm
                              shadow-lg`}>
                <Icon size={32} className="text-white sm:hidden" strokeWidth={1.5} />
                <Icon size={40} className="text-white hidden sm:block md:hidden" strokeWidth={1.5} />
                <Icon size={48} className="text-white hidden md:block" strokeWidth={1.5} />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-white font-black text-2xl sm:text-3xl md:text-4xl text-center
                          leading-tight mb-3 sm:mb-4 relative z-10 text-balance">
              {card.title}
            </h2>

            {/* Description */}
            <p className="text-white/95 text-sm sm:text-base md:text-lg text-center
                         leading-relaxed flex-1 relative z-10 text-balance px-1">
              {card.description}
            </p>

            {/* Consequence */}
            {card.consequence && (
              <div className="mt-4 sm:mt-5 bg-black/30 backdrop-blur-sm rounded-xl
                             p-3 sm:p-4 relative z-10 border border-white/10">
                <div className="flex items-start gap-2 sm:gap-2.5">
                  <DrinkIcon size={15} className="text-white/70 shrink-0 mt-0.5" strokeWidth={2} />
                  <p className={`text-xs sm:text-sm ${cfg.textMuted} leading-relaxed`}>
                    {card.type === 'challenge' || card.type === 'truth'
                      ? <><span className="text-white/60 font-bold">Or skip it: </span>{card.consequence}</>
                      : card.consequence
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Corner dots */}
            <div className="absolute top-4 sm:top-5 right-4 sm:right-5 flex flex-col gap-1">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/30" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Deck placeholder (no card drawn yet) ── */
interface DeckProps {
  isMyTurn: boolean;
  onDraw: () => void;
}

export function CardDeck({ isMyTurn, onDraw }: DeckProps) {
  return (
    <div className="w-full max-w-[340px] sm:max-w-sm md:max-w-md mx-auto flex flex-col items-center gap-4">
      {/* Stacked deck visual */}
      <div className="relative w-full h-[440px] sm:h-[500px] md:h-[560px] flex items-center justify-center">
        {[2, 1, 0].map(offset => (
          <div
            key={offset}
            className="absolute w-[calc(100%-16px)] h-[calc(100%-20px)] rounded-3xl
                       bg-[#12121c] border-2 border-yellow-400/30 shadow-xl"
            style={{
              transform: `translateY(${offset * 6}px) rotate(${(offset - 1) * 1.5}deg)`,
              zIndex: 3 - offset,
            }}
          >
            {offset === 0 && (
              <div className="h-full flex flex-col items-center justify-center gap-4 sm:gap-5 p-6 sm:p-8 relative">
                <div className={`w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-2xl
                                bg-yellow-400/10 border-2 border-yellow-400/30
                                flex items-center justify-center
                                ${isMyTurn ? 'pulse-glow' : ''}`}>
                  <Wine size={32} className="text-yellow-400 sm:hidden" strokeWidth={1.5} />
                  <Wine size={40} className="text-yellow-400 hidden sm:block md:hidden" strokeWidth={1.5} />
                  <Wine size={48} className="text-yellow-400 hidden md:block" strokeWidth={1.5} />
                </div>
                <div className="text-center">
                  <p className="text-white font-black text-2xl sm:text-3xl md:text-4xl tracking-tight leading-none">SipIt</p>
                  <p className="text-yellow-400 font-black text-2xl sm:text-3xl md:text-4xl tracking-tight leading-none mt-1">Or DipIt</p>
                </div>

                {isMyTurn && (
                  <button
                    onClick={onDraw}
                    className="mt-2 bg-yellow-400 hover:bg-yellow-300 active:scale-95
                              text-black font-bold px-8 sm:px-10 py-3 sm:py-4
                              rounded-xl transition-all text-sm sm:text-base
                              shadow-lg shadow-yellow-400/30"
                  >
                    Draw Card
                  </button>
                )}

                <div className="absolute top-4 sm:top-5 left-4 sm:left-5 flex gap-1">
                  {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-yellow-400/30" />)}
                </div>
                <div className="absolute bottom-4 sm:bottom-5 right-4 sm:right-5 flex gap-1">
                  {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-yellow-400/30" />)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
