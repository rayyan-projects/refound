import { createStore } from '../lib/store';
import { findAskedBefore } from '../lib/similar';
import { ApiError, queryMemoryStreaming } from '../services/api';
import type { HistoryItem, Source } from '../services/api';
import { readNdjson } from '../services/stream';
import { queryClient } from './queryClient';
import { settingsStore } from './settings';

export type AskStatus = 'idle' | 'retrieving' | 'streaming' | 'done' | 'stopped' | 'failed';

export interface AskState {
  status: AskStatus;
  question: string;
  /** Assembled tokens. */
  answer: string;
  /** null until the final line. */
  sources: Source[] | null;
  durationMs: number | null;
  similarProblems: unknown[];
  /** ApiError.message when status === 'failed'. */
  error: string | null;
  errorKind: 'network' | 'http' | null;
  /** The value used for this run (drives the skeleton count). */
  topK: number;
  /** A past question with near-identical wording, found at submit time from the cached history. */
  askedBefore: HistoryItem | null;
}

const IDLE: AskState = {
  status: 'idle',
  question: '',
  answer: '',
  sources: null,
  durationMs: null,
  similarProblems: [],
  error: null,
  errorKind: null,
  topK: 5,
  askedBefore: null,
};

export const askStore = createStore<AskState>(IDLE);

let controller: AbortController | null = null;
let runId = 0;
let pending = '';
let frame = 0;

function flush(): void {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  if (!pending) return;
  const text = pending;
  pending = '';
  askStore.set((s) => ({ ...s, status: s.status === 'retrieving' ? 'streaming' : s.status, answer: s.answer + text }));
}

export function isAsking(status: AskStatus): boolean {
  return status === 'retrieving' || status === 'streaming';
}

/** Runs a question. Aborts any run in flight first. */
export async function ask(question: string): Promise<void> {
  const q = question.trim();
  if (!q) return;
  controller?.abort();
  pending = '';
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  const ctrl = new AbortController();
  controller = ctrl;
  const id = ++runId;
  const { backendUrl, topK } = settingsStore.get();
  const history = queryClient.getQueryData<HistoryItem[]>(['history', backendUrl]) ?? [];
  askStore.set({ ...IDLE, status: 'retrieving', question: q, topK, askedBefore: findAskedBefore(q, history) });

  let finished = false;
  try {
    const stream = await queryMemoryStreaming(backendUrl, q, topK, ctrl.signal);
    for await (const ev of readNdjson(stream)) {
      if (id !== runId) return;
      if (ev.type === 'token') {
        pending += ev.token;
        if (askStore.get().status === 'retrieving') flush();
        else if (!frame) frame = requestAnimationFrame(flush);
      } else {
        flush();
        finished = true;
        askStore.set((s) => ({
          ...s,
          status: 'done',
          sources: ev.sources,
          durationMs: ev.durationMs,
          similarProblems: ev.similarProblems,
        }));
      }
    }
    if (id !== runId) return;
    flush();
    if (!finished) askStore.set((s) => ({ ...s, status: 'done', sources: [] }));
    void queryClient.invalidateQueries({ queryKey: ['history'] });
  } catch (err) {
    if (id !== runId || ctrl.signal.aborted) return;
    flush();
    const apiErr = err instanceof ApiError ? err : new ApiError('The backend is not reachable', 0, 'network');
    askStore.set((s) => ({ ...s, status: 'failed', error: apiErr.message, errorKind: apiErr.kind }));
    if (apiErr.kind === 'network') void queryClient.invalidateQueries({ queryKey: ['health'] });
  } finally {
    if (controller === ctrl) controller = null;
  }
}

/** Stops the answer in flight. The partial answer stays. */
export function stopAsking(): void {
  if (!isAsking(askStore.get().status)) return;
  flush();
  controller?.abort();
  controller = null;
  askStore.set((s) => ({ ...s, status: 'stopped' }));
}

export function resetAsk(): void {
  controller?.abort();
  controller = null;
  runId++;
  pending = '';
  askStore.set({ ...IDLE, topK: settingsStore.get().topK });
}
