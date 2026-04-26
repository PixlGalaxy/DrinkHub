import { Shield } from 'lucide-react';
import type { ActiveRule } from '../../shared/types';
import { useLanguage } from '../../shared/i18n/useLanguage';
import { pick, t } from '../../shared/i18n/translations';

interface ActiveRulesProps {
  rules: ActiveRule[];
}

export function ActiveRules({ rules }: ActiveRulesProps) {
  const [lang] = useLanguage();

  if (rules.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Shield size={13} className="text-blue-400" strokeWidth={2} />
        <span className="text-blue-400 text-xs font-bold uppercase tracking-widest">
          {t('rules.active', lang)} ({rules.length})
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {rules.map(rule => (
          <div
            key={rule.card_id}
            className="flex items-start justify-between gap-3 bg-blue-500/10 border border-blue-500/20
                       rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 hover:bg-blue-500/15 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="text-blue-300 font-bold text-xs sm:text-sm">{pick(rule.title, lang)}</p>
              <p className="text-blue-200/60 text-xs mt-1 leading-relaxed">{pick(rule.description, lang)}</p>
            </div>
            <span className="shrink-0 text-[10px] sm:text-xs font-black text-blue-400 bg-blue-400/20
                            px-2 py-1 rounded-full whitespace-nowrap">
              {t('rules.rounds_left', lang, { count: rule.rounds_remaining })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
