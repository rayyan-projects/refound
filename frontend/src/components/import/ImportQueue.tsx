import { useStore } from '../../hooks/useStore';
import { useDocuments } from '../../hooks/useDocuments';
import { plural } from '../../lib/format';
import { clearFinished, importQueueStore, isFinished } from '../../state/importQueue';
import type { QueueItem } from '../../state/importQueue';
import { Button } from '../ui/Button';
import { ImportQueueItem } from './ImportQueueItem';

function announcement(item: QueueItem | undefined): string {
  if (!item) return '';
  if (item.status === 'done') return `${item.label}: indexed, ${plural(item.chunks ?? 0, 'passage', 'passages')}`;
  if (item.status === 'duplicate') return `${item.label}: already in your library`;
  if (item.status === 'failed') return `${item.label}: failed. ${item.message ?? ''}`;
  return '';
}

export function ImportQueue() {
  const items = useStore(importQueueStore);
  const docs = useDocuments();
  const finished = items.filter((it) => isFinished(it.status));
  const running = items.some((it) => it.status === 'queued' || it.status === 'working');
  const lastDone = [...items].reverse().find((it) => it.status === 'done' || it.status === 'duplicate' || it.status === 'failed');

  return (
    <section>
      <div className="mb-2 flex h-7 items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-ink-2">This session</h2>
        {finished.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFinished}>
            Clear finished
          </Button>
        )}
      </div>
      {running && (
        <div className="mb-3 flex items-center gap-3">
          <div
            role="progressbar"
            aria-label="Import progress"
            aria-valuenow={finished.length}
            aria-valuemin={0}
            aria-valuemax={items.length}
            className="h-1 flex-1 overflow-hidden rounded-full bg-sunken"
          >
            <div className="h-full rounded-full bg-ink-2" style={{ width: `${(finished.length / Math.max(1, items.length)) * 100}%` }} />
          </div>
          <span className="font-mono text-xs tabular-nums text-ink-3">
            {finished.length} of {items.length}
          </span>
        </div>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-ink-3">Imports from this session appear here</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {items.map((item) => (
            <ImportQueueItem
              key={item.id}
              item={item}
              failedBefore={item.status === 'duplicate' && !!docs.data?.some((d) => d.id === item.documentId && d.status === 'error')}
            />
          ))}
        </ul>
      )}
      <p role="status" className="sr-only">
        {announcement(lastDone)}
      </p>
    </section>
  );
}
