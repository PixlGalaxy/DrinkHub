import { Loader, MonitorSmartphone, RotateCcw, WifiOff } from 'lucide-react';
import type { WsStatus } from '../types';
import { useLanguage } from '../i18n/useLanguage';
import { t } from '../i18n/translations';

interface ConnectionBannerProps {
  status: WsStatus;
  onRetry: () => void;
}

/**
 * Small floating banner shown while the socket is down. The room stays on
 * screen with its last known state instead of being replaced by a
 * "connection lost" page every time a phone wakes up.
 */
export function ConnectionBanner({ status, onRetry }: ConnectionBannerProps) {
  const [lang] = useLanguage();
  if (status === 'connected' || status === 'idle') return null;

  if (status === 'replaced') {
    return (
      <div role="status" className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-md
                      bg-[#0f1a24]/95 border border-sky-400/40 rounded-2xl shadow-xl shadow-black/40 backdrop-blur
                      px-4 py-2.5 flex items-center justify-center gap-3 text-sm fade-in">
        <MonitorSmartphone size={16} className="text-sky-300 shrink-0" strokeWidth={2} />
        <span className="text-sky-100/90">{t('game.other_tab', lang)}</span>
        <button
          onClick={onRetry}
          className="shrink-0 bg-sky-400 hover:bg-sky-300 text-black font-bold px-3 py-1 rounded-lg text-xs
                     transition-all active:scale-95"
        >
          {t('game.use_here', lang)}
        </button>
      </div>
    );
  }

  const connecting = status === 'connecting';
  return (
    <div role="status" className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-md
                    bg-[#1f1a0f]/95 border border-amber-400/40 rounded-2xl shadow-xl shadow-black/40 backdrop-blur
                    px-4 py-2.5 flex items-center justify-center gap-3 text-sm fade-in">
      {connecting
        ? <Loader size={16} className="text-amber-300 animate-spin shrink-0" strokeWidth={2} />
        : <WifiOff size={16} className="text-amber-300 shrink-0" strokeWidth={2} />}
      <span className="text-amber-100/90">
        {connecting ? t('game.reconnecting_short', lang) : t('game.connection_lost', lang)}
      </span>
      {!connecting && (
        <button
          onClick={onRetry}
          className="shrink-0 flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-black font-bold
                     px-3 py-1 rounded-lg text-xs transition-all active:scale-95"
        >
          <RotateCcw size={12} strokeWidth={2.5} />
          {t('game.retry_now', lang)}
        </button>
      )}
    </div>
  );
}
