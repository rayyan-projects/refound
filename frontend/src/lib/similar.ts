import type { HistoryItem } from '../services/api';
import { queryTerms } from './text';

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Jaccard overlap of two term sets, and how many terms they share. */
function overlap(a: string[], b: string[]): { score: number; shared: number } {
  const A = new Set(a);
  const B = new Set(b);
  let shared = 0;
  A.forEach((x) => {
    if (B.has(x)) shared++;
  });
  const union = A.size + B.size - shared;
  return { score: union === 0 ? 0 : shared / union, shared };
}

/** Client-side "asked before": near-identical wording only. History is newest first. */
export function findAskedBefore(question: string, history: HistoryItem[]): HistoryItem | null {
  const q = normalise(question);
  const qt = queryTerms(question);
  for (const item of history) {
    if (!item.answer || !item.answer.trim()) continue;
    const other = item.query_text ?? '';
    if (normalise(other) === q) return item;
    const { score, shared } = overlap(qt, queryTerms(other));
    if (shared >= 2 && score >= 0.8) return item;
  }
  return null;
}
