import { createStore } from '../lib/store';
import { extensionOf, isSupportedFile, shortUrl } from '../lib/documents';
import { plural } from '../lib/format';
import { ApiError, importFile, importUrl } from '../services/api';
import type { ImportResult } from '../services/api';
import { currentPath, go } from './navigation';
import { queryClient } from './queryClient';
import { settingsStore } from './settings';
import { toast } from './toasts';

export type QueueStatus = 'queued' | 'working' | 'done' | 'duplicate' | 'failed' | 'skipped';
export interface QueueItem {
  id: string;
  kind: 'file' | 'url';
  /** File name, or the shortened share link. */
  label: string;
  /** The file's path within a folder, or the full share URL. */
  detail: string;
  status: QueueStatus;
  message: string | null;
  documentId: number | null;
  /** Title of the indexed (or already present) document. */
  title: string | null;
  chunks: number | null;
}

export const importQueueStore = createStore<QueueItem[]>([]);

const files = new Map<string, File>();
let seq = 0;
let running = false;
let runStats = { done: 0, failed: 0 };

export function isFinished(status: QueueStatus): boolean {
  return status === 'done' || status === 'duplicate' || status === 'failed' || status === 'skipped';
}

function update(id: string, patch: Partial<QueueItem>): void {
  importQueueStore.set((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));
}

export function enqueueFiles(list: File[]): void {
  const items: QueueItem[] = list.map((file) => {
    const id = `q${++seq}`;
    const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const base = { id, kind: 'file' as const, label: file.name, detail: path, documentId: null, title: null, chunks: null };
    if (!isSupportedFile(file.name)) {
      return { ...base, status: 'skipped' as const, message: `Unsupported type (${extensionOf(file.name) || 'no extension'})` };
    }
    files.set(id, file);
    return { ...base, status: 'queued' as const, message: null };
  });
  importQueueStore.set((prev) => [...prev, ...items]);
  void run();
}

export function enqueueUrl(url: string): void {
  const id = `q${++seq}`;
  importQueueStore.set((prev) => [
    ...prev,
    { id, kind: 'url', label: shortUrl(url), detail: url, status: 'queued', message: null, documentId: null, title: null, chunks: null },
  ]);
  void run();
}

export function retryItem(id: string): void {
  const item = importQueueStore.get().find((it) => it.id === id);
  if (!item || item.status !== 'failed') return;
  update(id, { status: 'queued', message: null });
  void run();
}

export function removeItem(id: string): void {
  files.delete(id);
  importQueueStore.set((list) => list.filter((it) => it.id !== id || it.status === 'working'));
}

export function clearFinished(): void {
  importQueueStore.set((list) => {
    list.filter((it) => isFinished(it.status)).forEach((it) => files.delete(it.id));
    return list.filter((it) => !isFinished(it.status));
  });
}

async function processItem(item: QueueItem): Promise<void> {
  const { backendUrl } = settingsStore.get();
  update(item.id, { status: 'working', message: null });
  try {
    let result: ImportResult;
    if (item.kind === 'url') {
      result = await importUrl(backendUrl, item.detail);
    } else {
      const file = files.get(item.id);
      if (!file) throw new ApiError('The file is no longer available. Choose it again', 0, 'http');
      result = await importFile(backendUrl, file);
    }
    const duplicate = result.status === 'duplicate';
    update(item.id, {
      status: duplicate ? 'duplicate' : 'done',
      documentId: result.document_id,
      title: result.title,
      chunks: result.chunks,
    });
    if (item.kind === 'file') files.delete(item.id);
    runStats.done++;
    void queryClient.invalidateQueries({ queryKey: ['documents'] });
  } catch (err) {
    const message = err instanceof ApiError ? err.message : 'The import failed';
    update(item.id, { status: 'failed', message });
    runStats.failed++;
  }
}

async function run(): Promise<void> {
  if (running) return;
  running = true;
  runStats = { done: 0, failed: 0 };
  try {
    for (;;) {
      const next = importQueueStore.get().find((it) => it.status === 'queued');
      if (!next) break;
      await processItem(next);
    }
  } finally {
    running = false;
  }
  const { done, failed } = runStats;
  if (done + failed > 0 && currentPath() !== '/import') {
    const message = failed
      ? `Imported ${plural(done, 'document', 'documents')}, ${failed} failed`
      : `Imported ${plural(done, 'document', 'documents')}`;
    toast(message, { tone: failed ? 'neutral' : 'success', action: { label: 'View', onSelect: () => go('/import') } });
  }
}
