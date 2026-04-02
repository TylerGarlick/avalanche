interface EpistemicBadgeProps {
  epistemic: 'known' | 'inferred' | 'uncertain' | 'unknown';
}

const EPISTEMIC_CONFIG = {
  known: {
    label: '[KNOWN]',
    color: 'text-emerald-400',
    bg: 'bg-emerald-900/40',
    border: 'border-emerald-700',
    tooltip: 'Observed or confirmed',
  },
  inferred: {
    label: '[INFERRED]',
    color: 'text-blue-400',
    bg: 'bg-blue-900/40',
    border: 'border-blue-700',
    tooltip: 'Based on indirect evidence',
  },
  uncertain: {
    label: '[UNCERTAIN]',
    color: 'text-amber-400',
    bg: 'bg-amber-900/40',
    border: 'border-amber-700',
    tooltip: 'Limited data available',
  },
  unknown: {
    label: '[UNKNOWN]',
    color: 'text-red-400',
    bg: 'bg-red-900/40',
    border: 'border-red-700',
    tooltip: 'No information available',
  },
} as const;

export default function EpistemicBadge({ epistemic }: EpistemicBadgeProps) {
  const config = EPISTEMIC_CONFIG[epistemic] ?? EPISTEMIC_CONFIG.unknown;

  return (
    <span
      title={config.tooltip}
      className={`inline-block px-2 py-0.5 text-xs font-mono font-bold rounded border ${config.color} ${config.bg} ${config.border}`}
    >
      {config.label}
    </span>
  );
}
