import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface GameCardProps {
  title: string;
  description: string;
  route: string;
  icon: LucideIcon;
  accentColor: string;
  gradientColor?: string;
  badgeText: string;
  players: string;
  tags: string[];
  available?: boolean;
}

export function GameCard({
  title,
  description,
  route,
  icon: Icon,
  accentColor,
  gradientColor = 'from-amber-500 to-orange-600',
  badgeText,
  players,
  tags,
  available = true,
}: GameCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => available && navigate(route)}
      disabled={!available}
      className="group relative w-full text-left bg-[#13131a] border border-white/8
                 rounded-2xl overflow-hidden transition-all duration-300
                 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed
                 hover:border-white/20 hover:bg-[#16161f] hover:-translate-y-1
                 hover:shadow-2xl hover:shadow-black/40
                 focus:outline-none focus-visible:border-yellow-400/60
                 min-h-[260px] sm:min-h-[300px] flex flex-col"
    >
      {/* Top accent bar with gradient */}
      <div className={`h-1 sm:h-1.5 w-full bg-gradient-to-r ${gradientColor}`} />

      {/* Decorative blur orb */}
      <div className={`absolute -top-12 -right-12 w-40 h-40 rounded-full ${accentColor}
                       opacity-0 group-hover:opacity-10 blur-3xl transition-opacity duration-500`} />

      <div className="p-5 sm:p-6 flex-1 flex flex-col relative">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center
                          ${accentColor} shrink-0 shadow-lg
                          group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
            <Icon size={24} className="text-white sm:hidden" strokeWidth={2} />
            <Icon size={28} className="text-white hidden sm:block" strokeWidth={2} />
          </div>
          <span className="text-[10px] sm:text-xs font-bold text-white/40 uppercase tracking-widest pt-2">
            {badgeText}
          </span>
        </div>

        <h2 className="text-white font-black text-xl sm:text-2xl mb-2 leading-tight">{title}</h2>
        <p className="text-white/50 text-sm leading-relaxed mb-4 flex-1">{description}</p>

        {/* Tags */}
        <div className="flex items-center gap-1.5 flex-wrap mb-4">
          {tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-[10px] sm:text-xs bg-white/8 text-white/60
                                       px-2 py-1 rounded-full font-medium">
              {tag}
            </span>
          ))}
          {tags.length > 3 && (
            <span className="text-[10px] sm:text-xs text-white/30 font-medium">
              +{tags.length - 3}
            </span>
          )}
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between pt-3 border-t border-white/5">
          <div className="flex items-center gap-1.5 text-white/40">
            <Users size={12} strokeWidth={2} />
            <span className="text-xs font-medium">{players}</span>
          </div>

          <div className="flex items-center gap-1.5 text-yellow-400 font-semibold text-sm
                          group-hover:gap-2.5 transition-all">
            {available ? 'Play' : 'Soon'}
            <ArrowRight size={15} strokeWidth={2.5}
                        className="group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </button>
  );
}
