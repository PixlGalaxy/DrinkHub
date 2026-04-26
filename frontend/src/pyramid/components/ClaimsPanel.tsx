import { GlassWater, ArrowRight } from 'lucide-react';
import type { PyramidClaim } from '../../shared/types';
import { useLanguage } from '../../shared/i18n/useLanguage';

interface ClaimsPanelProps {
  claims: PyramidClaim[];
}

export function ClaimsPanel({ claims }: ClaimsPanelProps) {
  const [lang] = useLanguage();

  if (!claims.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-white/30 text-xs font-bold uppercase tracking-widest">
        {lang === 'es' ? 'Reclamaciones' : 'Claims'}
      </p>
      <div className="flex flex-col gap-2">
        {claims.map(claim => (
          <ClaimItem key={claim.claim_id} claim={claim} lang={lang} />
        ))}
      </div>
    </div>
  );
}

interface ClaimItemProps {
  claim: PyramidClaim;
  lang: 'en' | 'es';
}

function drinksBadge(drinks: number): string {
  if (drinks >= 4) return 'text-red-400';
  if (drinks >= 3) return 'text-yellow-400';
  if (drinks >= 2) return 'text-green-400';
  return 'text-gray-400';
}

function ClaimItem({ claim, lang }: ClaimItemProps) {
  return (
    <div className="bg-[#12111e] border border-purple-900/30 rounded-xl px-3 py-2.5 flex items-center gap-3 fade-in">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
        <span className="text-white font-bold">{claim.claimer_name}</span>
        <ArrowRight size={12} className="text-white/30 shrink-0" strokeWidth={2} />
        <span className="text-purple-300 font-bold">{claim.target_name}</span>
        <span className={`flex items-center gap-1 font-black ml-1 ${drinksBadge(claim.drinks)}`}>
          <GlassWater size={13} strokeWidth={2} />
          {claim.drinks}
        </span>
        <span className="text-white/25 text-xs ml-0.5">
          {lang === 'es' ? `(×${claim.drinks} bebidas)` : `(×${claim.drinks} drinks)`}
        </span>
      </div>
    </div>
  );
}
