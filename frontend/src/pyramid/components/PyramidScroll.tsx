import { useEffect, useRef, useState } from 'react';
import type { PyramidCard } from '../../shared/types';
import { useLanguage } from '../../shared/i18n/useLanguage';

function multiplierStyle(drinks: number): string {
  if (drinks === 1) return 'text-gray-400 bg-gray-400/10 border-gray-500/30';
  if (drinks === 2) return 'text-green-400 bg-green-400/10 border-green-500/30';
  if (drinks === 3) return 'text-yellow-400 bg-yellow-400/10 border-yellow-500/30';
  return 'text-red-400 bg-red-400/10 border-red-500/30';
}

interface PyramidCardViewProps {
  card: PyramidCard;
  isActive: boolean;
  isNew: boolean;
}

function PyramidCardView({ card, isActive, isNew }: PyramidCardViewProps) {
  const mult = `×${card.drinks}`;
  const multCls = multiplierStyle(card.drinks);

  return (
    <div className={`flex flex-col items-center gap-2 shrink-0 ${isNew ? 'card-enter' : ''}`}>
      <span className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${multCls}`}>
        {mult}
      </span>

      <div
        className={`w-16 h-24 sm:w-20 sm:h-28 rounded-xl overflow-hidden border-2 shadow-lg transition-all duration-300
          ${isActive
            ? 'border-purple-400 shadow-purple-500/40 scale-105'
            : 'border-purple-900/40 opacity-70'
          }`}
      >
        {card.revealed && card.image ? (
          <img
            src={`/Cards/${card.image}@1x.png`}
            srcSet={`/Cards/${card.image}@2x.png 2x, /Cards/${card.image}@3x.png 3x`}
            alt={`${card.rank} ${card.suit}`}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-[#160f2a] flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-15">
              <div className="absolute inset-2 border border-purple-500/40 rounded-lg" />
              <div className="absolute inset-3.5 border border-purple-500/20 rounded-lg" />
            </div>
            <span className="text-purple-400/40 text-2xl font-black select-none">?</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface PyramidScrollProps {
  pyramidCards: PyramidCard[];
  currentIndex: number;
}

export function PyramidScroll({ pyramidCards, currentIndex }: PyramidScrollProps) {
  const [lang] = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevIndex = useRef(-1);
  const [newCardIdx, setNewCardIdx] = useState(-1);

  useEffect(() => {
    if (currentIndex > prevIndex.current) {
      setNewCardIdx(currentIndex);
      setTimeout(() => setNewCardIdx(-1), 600);
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({ left: scrollRef.current.scrollWidth, behavior: 'smooth' });
        }
      }, 50);
    }
    prevIndex.current = currentIndex;
  }, [currentIndex]);

  if (currentIndex < 0) {
    return (
      <div className="w-full bg-[#0d0b1a] border border-purple-900/30 rounded-2xl p-6
                      flex flex-col items-center justify-center min-h-[148px] gap-2">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-12 h-16 sm:w-14 sm:h-20 bg-[#160f2a] rounded-lg border border-purple-900/40
                                    flex items-center justify-center opacity-40">
              <span className="text-purple-400/30 text-lg font-black">?</span>
            </div>
          ))}
        </div>
        <p className="text-white/25 text-xs mt-1">
          {lang === 'es' ? 'Voten "Siguiente" para revelar la primera carta' : 'Vote "Next" to reveal the first card'}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="w-full overflow-x-auto bg-[#0d0b1a] border border-purple-900/30 rounded-2xl
                 px-4 py-4 flex gap-3 min-h-[148px] items-end"
      style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.3) transparent' }}
    >
      {pyramidCards.slice(0, currentIndex + 1).map((card, i) => (
        <PyramidCardView
          key={card.position}
          card={card}
          isActive={i === currentIndex}
          isNew={i === newCardIdx}
        />
      ))}
    </div>
  );
}
