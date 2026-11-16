export type RelevanceLevel = 'strong' | 'partial' | 'weak';
export interface Relevance {
  level: RelevanceLevel;
  label: string;
  bars: 1 | 2 | 3;
  raw: string;
}

/** Scores are cross-encoder logits (about -11..+11), not 0..1. */
export function relevance(score: number): Relevance {
  const p = 1 / (1 + Math.exp(-score));
  const raw = score.toFixed(2);
  if (p >= 0.7) return { level: 'strong', label: 'Strong match', bars: 3, raw };
  if (p >= 0.3) return { level: 'partial', label: 'Partial match', bars: 2, raw };
  return { level: 'weak', label: 'Weak match', bars: 1, raw };
}
