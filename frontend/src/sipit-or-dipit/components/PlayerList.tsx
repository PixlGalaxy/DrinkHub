import { Crown, Wifi, WifiOff } from 'lucide-react';
import type { Player } from '../../shared/types';
import { useLanguage } from '../../shared/i18n/useLanguage';
import { t } from '../../shared/i18n/translations';

interface PlayerListProps {
  players: Player[];
  currentPlayerId?: string;
  viewerId?: string;
  compact?: boolean;
}

export function PlayerList({ players, currentPlayerId, viewerId, compact = false }: PlayerListProps) {
  const [lang] = useLanguage();

  return (
    <div className={compact ? 'flex flex-col gap-1.5' : 'flex flex-col gap-2'}>
      {players.map(player => {
        const isCurrentTurn = player.id === currentPlayerId;
        const isMe = player.id === viewerId;

        return (
          <div
            key={player.id}
            className={`flex items-center justify-between rounded-xl transition-all
              ${compact ? 'px-3 py-2' : 'px-4 py-3'}
              ${isCurrentTurn
                ? 'bg-yellow-400/15 border border-yellow-400/40 shadow-lg shadow-yellow-400/5'
                : 'bg-white/4 border border-white/5 hover:bg-white/6'}
              ${!player.is_connected ? 'opacity-40' : ''}
            `}
          >
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className={`shrink-0 rounded-full flex items-center justify-center font-bold
                ${compact ? 'w-7 h-7 text-xs' : 'w-8 h-8 sm:w-9 sm:h-9 text-sm'}
                ${isCurrentTurn
                  ? 'bg-yellow-400 text-black shadow-md shadow-yellow-400/40'
                  : 'bg-white/10 text-white/70'}`}
              >
                {player.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`font-semibold truncate
                    ${compact ? 'text-sm' : 'text-sm sm:text-base'}
                    ${isCurrentTurn ? 'text-yellow-400' : 'text-white/85'}`}
                  >
                    {player.name}
                  </span>
                  {isMe && (
                    <span className="text-xs text-white/30 shrink-0">{t('player.you', lang)}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2">
              {isCurrentTurn && (
                <span className="text-[10px] sm:text-xs font-bold text-yellow-400 bg-yellow-400/20
                                 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {t('player.turn', lang)}
                </span>
              )}
              {player.is_host && (
                <Crown size={14} className="text-yellow-400/70" strokeWidth={2} />
              )}
              {player.is_connected
                ? <Wifi size={11} className="text-emerald-400/60" strokeWidth={2} />
                : <WifiOff size={11} className="text-red-400/60" strokeWidth={2} />
              }
            </div>
          </div>
        );
      })}
    </div>
  );
}
