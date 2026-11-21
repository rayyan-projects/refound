import type { Source } from './api';

export type StreamEvent =
  | { type: 'token'; token: string }
  | { type: 'final'; sources: Source[]; durationMs: number; similarProblems: unknown[] };

function parseLine(line: string): StreamEvent | null {
  if (!line.trim()) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof obj !== 'object' || obj === null) return null;
  const o = obj as Record<string, unknown>;
  if (typeof o.token === 'string') return { type: 'token', token: o.token };
  if (Array.isArray(o.sources)) {
    return {
      type: 'final',
      sources: o.sources as Source[],
      durationMs: typeof o.duration_ms === 'number' ? o.duration_ms : 0,
      similarProblems: Array.isArray(o.similar_problems) ? o.similar_problems : [],
    };
  }
  return null;
}

/** Reads the query NDJSON stream. Partial lines are buffered; unparseable lines are skipped. */
export async function* readNdjson(stream: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl = buffer.indexOf('\n');
      while (nl !== -1) {
        const ev = parseLine(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        if (ev) yield ev;
        nl = buffer.indexOf('\n');
      }
    }
    buffer += decoder.decode();
    const ev = parseLine(buffer);
    if (ev) yield ev;
  } finally {
    reader.releaseLock();
  }
}
