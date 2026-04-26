import type { Language } from './translations';

interface FlagIconProps {
  lang: Language;
  className?: string;
}

export function FlagIcon({ lang, className = '' }: FlagIconProps) {
  if (lang === 'en') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-label="English (US)" role="img">
        <rect width="24" height="24" fill="#B22234" />
        <rect y="1.85" width="24" height="1.85" fill="#fff" />
        <rect y="5.54" width="24" height="1.85" fill="#fff" />
        <rect y="9.23" width="24" height="1.85" fill="#fff" />
        <rect y="12.92" width="24" height="1.85" fill="#fff" />
        <rect y="16.62" width="24" height="1.85" fill="#fff" />
        <rect y="20.31" width="24" height="1.85" fill="#fff" />
        <rect width="10" height="13" fill="#3C3B6E" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-label="Español (LATAM)" role="img">
      <rect width="8" height="24" fill="#006847" />
      <rect x="8" width="8" height="24" fill="#fff" />
      <rect x="16" width="8" height="24" fill="#CE1126" />
      <circle cx="12" cy="12" r="2.6" fill="#9b6b2b" opacity="0.85" />
      <circle cx="12" cy="12" r="1.4" fill="#fff" opacity="0.55" />
    </svg>
  );
}

interface FlagToggleProps {
  value: Language;
  onChange: (lang: Language) => void;
  size?: 'sm' | 'md';
  label?: string;
  variant?: 'card' | 'pill';
}

export function FlagToggle({ value, onChange, size = 'md', label, variant = 'card' }: FlagToggleProps) {
  const flagSizeClass = size === 'sm' ? 'w-5 h-5' : 'w-7 h-7';
  const buttonPad = size === 'sm' ? 'p-1' : 'p-1.5';

  if (variant === 'pill') {
    return (
      <div className="inline-flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
        {(['en', 'es'] as const).map(l => (
          <button
            key={l}
            type="button"
            onClick={() => onChange(l)}
            aria-label={l === 'en' ? 'English' : 'Español'}
            aria-pressed={value === l}
            className={`${buttonPad} rounded-md transition-all
                        ${value === l
                          ? 'bg-yellow-400/20 ring-1 ring-yellow-400/60'
                          : 'opacity-50 hover:opacity-100'}`}
          >
            <FlagIcon lang={l} className={`${flagSizeClass} rounded-[3px] block`} />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div>
      {label && (
        <label className="text-white/50 text-xs font-bold uppercase tracking-widest block mb-2">
          {label}
        </label>
      )}
      <div className="grid grid-cols-2 gap-2">
        {(['en', 'es'] as const).map(l => (
          <button
            key={l}
            type="button"
            onClick={() => onChange(l)}
            aria-label={l === 'en' ? 'English' : 'Español'}
            aria-pressed={value === l}
            className={`flex items-center justify-center gap-2 rounded-xl
                        py-2.5 sm:py-3 transition-all border-2
                        ${value === l
                          ? 'bg-yellow-400/15 border-yellow-400/60 shadow-md shadow-yellow-400/10'
                          : 'bg-white/5 border-white/10 hover:bg-white/8'}`}
          >
            <FlagIcon lang={l} className="w-7 h-7 rounded-[3px]" />
            <span className={`text-sm font-bold ${value === l ? 'text-yellow-400' : 'text-white/70'}`}>
              {l === 'en' ? 'English' : 'Español'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
