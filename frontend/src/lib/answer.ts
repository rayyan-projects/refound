import type { Source } from '../services/api';

export type AnswerKind =
  | { kind: 'empty-index' }
  | { kind: 'no-key' }
  | { kind: 'llm-error'; detail: string }
  | { kind: 'answer' };

/** The backend reports three failure modes as ordinary answer text. */
export function classifyAnswer(answer: string, sources: Source[] | null): AnswerKind {
  if (answer.startsWith('No relevant memories found') && (!sources || sources.length === 0)) {
    return { kind: 'empty-index' };
  }
  if (answer.startsWith('[GEMINI_API_KEY not set]')) return { kind: 'no-key' };
  if (answer.startsWith('Error generating answer:')) {
    return { kind: 'llm-error', detail: answer.slice('Error generating answer:'.length).trim() };
  }
  return { kind: 'answer' };
}

const MARKER = /\[\s*Memory\s+\d+(?:\s*,\s*(?:Memory\s+)?\d+)*\s*\]/gi;

/** `[Memory 2]` → `[2](#source-2)`; `[Memory 1, 3]` → both. Out-of-range markers stay plain. */
export function linkCitations(markdown: string, sourceCount: number | null): string {
  return markdown.replace(MARKER, (marker) => {
    const nums = (marker.match(/\d+/g) ?? []).map(Number);
    const parts = nums.map((n) =>
      n >= 1 && (sourceCount === null || n <= sourceCount) ? `[${n}](#source-${n})` : `[Memory ${n}]`,
    );
    return parts.join(' ');
  });
}

/** The answer text without citation markers, for copying. */
export function stripCitations(answer: string): string {
  return answer
    .replace(MARKER, '')
    .replace(/ +([.,;:!?])/g, '$1')
    .replace(/ {2,}/g, ' ')
    .trim();
}
