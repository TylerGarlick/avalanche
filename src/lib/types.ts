export interface UnifiedForecast {
  zone: string;
  zoneId: string;
  center: 'CAIC' | 'UAC';
  dangerRating: 1 | 2 | 3 | 4 | 5;
  dangerByAspect: Record<string, number>;
  dangerByElevation: Record<string, number>;
  avalancheProblems: AvalancheProblem[];
  forecastDiscussion: string;
  publishedAt: string;
  validDay: string;
  epistemic: 'known' | 'inferred' | 'uncertain';
}

export interface AvalancheProblem {
  type: string;
  likelihood: string;
  size: string;
  aspect?: string[];
  elevation?: string[];
  discussion: string;
}

export type DangerLevel = 1 | 2 | 3 | 4 | 5;

export const DANGER_LABELS: Record<DangerLevel, string> = {
  1: 'Low',
  2: 'Moderate',
  3: 'Considerable',
  4: 'High',
  5: 'Extreme',
};

export const DANGER_COLORS: Record<DangerLevel, string> = {
  1: '#22c55e',
  2: '#eab308',
  3: '#f97316',
  4: '#ef4444',
  5: '#7f1d1d',
};

export const ASPECTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export const ELEVATIONS = ['Below Treeline', 'Near Treeline', 'Above Treeline'] as const;
