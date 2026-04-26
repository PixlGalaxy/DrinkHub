import { useEffect, useRef, useState } from 'react';
import type { PyramidHandCard } from '../../shared/types';
import { useLanguage } from '../../shared/i18n/useLanguage';

const PEEK_DURATION_MS = 10_000;

interface HandCardProps {
  card: PyramidHandCard;
  index: number;
  peeked: boolean;
  onClick: () => void;
  lang: 'en' | 'es';
}

function HandCard({ card, index, peeked, onClick, lang }: HandCardProps) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        role="button"
        aria-label={
          peeked && !card.used
            ? `${lang === 'es' ? 'Carta' : 'Card'} ${index + 1}: ${card.rank}${card.suit}`
            : `${lang === 'es' ? 'Carta' : 'Card'} ${index + 1}`
        }
        className={`w-16 h-24 sm:w-20 sm:h-28 rounded-xl overflow-hidden border-2 select-none
                    transition-all duration-200 active:scale-95
                    ${card.used
                      ? 'border-gray-700/40 opacity-35 cursor-default'
                      : peeked
                        ? 'border-purple-400 shadow-lg shadow-purple-500/30 cursor-pointer'
                        : 'border-purple-700/50 hover:border-purple-500/70 cursor-pointer'
                    }`}
        onClick={() => { if (!card.used) onClick(); }}
      >
        {peeked && !card.used ? (
          <img
            src={`/Cards/${card.image}@1x.png`}
            srcSet={`/Cards/${card.image}@2x.png 2x, /Cards/${card.image}@3x.png 3x`}
            alt={`${card.rank} ${card.suit}`}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-[#160f2a] flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute inset-2 border border-purple-500/40 rounded-lg" />
              <div className="absolute inset-3.5 border border-purple-500/20 rounded-lg" />
            </div>
            {card.used
              ? <span className="text-gray-500/60 text-[10px] font-bold text-center px-1 relative z-10">
                  {lang === 'es' ? 'USADA' : 'USED'}
                </span>
              : <span className="text-purple-400/50 text-xl font-black relative z-10">P</span>
            }
          </div>
        )}
      </div>

      <p className="text-white/25 text-[10px] font-medium">
        {peeked && !card.used
          ? `${card.rank}${card.suit}`
          : `${lang === 'es' ? 'Carta' : 'Card'} ${index + 1}`}
      </p>
    </div>
  );
}

interface PlayerHandProps {
  hand: PyramidHandCard[];
}

export function PlayerHand({ hand }: PlayerHandProps) {
  const [lang] = useLanguage();
  const [peeking, setPeeking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleToggle = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (peeking) {
      setPeeking(false);
    } else {
      setPeeking(true);
      timerRef.current = setTimeout(() => {
        setPeeking(false);
        timerRef.current = null;
      }, PEEK_DURATION_MS);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-white/30 text-xs font-bold uppercase tracking-widest text-center">
        {lang === 'es' ? 'Tu mano · solo tú la ves' : 'Your hand · only you see this'}
      </p>
      <div className="flex gap-3 justify-center">
        {hand.map((card, i) => (
          <HandCard
            key={i}
            card={card}
            index={i}
            peeked={peeking}
            onClick={handleToggle}
            lang={lang}
          />
        ))}
      </div>
      <p className="text-white/15 text-[10px] text-center">
        {peeking
          ? lang === 'es' ? 'Toca para ocultar' : 'Tap to hide'
          : lang === 'es' ? 'Toca para ver · se ocultan en 10s' : 'Tap to peek · hides in 10s'}
      </p>
    </div>
  );
}
