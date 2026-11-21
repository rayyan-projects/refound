/**
 * Provisional shapes for features the backend does not have yet (plan section 6).
 * These are GUESSES, to be replaced by the real contract when the backend ships it.
 * Guards ignore anything that does not match and never throw.
 */

export interface SimilarProblem {
  history_id: number;
  query_text: string;
  created_at: string;
  similarity: number;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isSimilarProblem(v: unknown): v is SimilarProblem {
  return (
    isRecord(v) &&
    typeof v.history_id === 'number' &&
    typeof v.query_text === 'string' &&
    typeof v.created_at === 'string' &&
    typeof v.similarity === 'number'
  );
}

/** Up to three valid similar-problem items, or [] for anything else. */
export function similarProblems(value: unknown): SimilarProblem[] {
  return Array.isArray(value) ? value.filter(isSimilarProblem).slice(0, 3) : [];
}

/** `topics?: string[]` on a Document. */
export function documentTopics(doc: unknown): string[] {
  if (!isRecord(doc) || !Array.isArray(doc.topics)) return [];
  return doc.topics.filter((t): t is string => typeof t === 'string' && t.trim() !== '');
}

/** `summary?: string` on a Document. */
export function documentSummary(doc: unknown): string | null {
  if (!isRecord(doc) || typeof doc.summary !== 'string' || !doc.summary.trim()) return null;
  return doc.summary.trim();
}
