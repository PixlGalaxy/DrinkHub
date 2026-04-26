import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '../../shared/i18n/useLanguage';
import { t } from '../../shared/i18n/translations';

interface RoomCodeProps {
  code: string;
}

export function RoomCode({ code }: RoomCodeProps) {
  const [lang] = useLanguage();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-white/40 text-xs sm:text-sm font-semibold uppercase tracking-[0.2em]">
        {t('room_code.label', lang)}
      </p>
      <button
        onClick={handleCopy}
        className="flex items-center gap-2 sm:gap-3 bg-white/5 hover:bg-white/10 active:scale-95
                   border-2 border-white/10 hover:border-yellow-400/40 rounded-2xl
                   px-4 sm:px-6 py-3 sm:py-4 transition-all group"
      >
        <span className="text-2xl sm:text-3xl lg:text-4xl font-black font-mono text-white
                         tracking-[0.15em]">
          {code}
        </span>
        <div className={`transition-colors ${copied ? 'text-emerald-400' : 'text-white/30 group-hover:text-yellow-400'}`}>
          {copied
            ? <Check size={20} strokeWidth={2.5} className="sm:hidden" />
            : <Copy size={20} strokeWidth={2} className="sm:hidden" />}
          {copied
            ? <Check size={24} strokeWidth={2.5} className="hidden sm:block" />
            : <Copy size={24} strokeWidth={2} className="hidden sm:block" />}
        </div>
      </button>
      <p className={`text-xs sm:text-sm font-medium transition-colors ${copied ? 'text-emerald-400' : 'text-white/30'}`}>
        {copied ? t('room_code.copied', lang) : t('room_code.tap_to_copy', lang)}
      </p>
    </div>
  );
}
