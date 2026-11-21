import { AlertTriangle, Check, ChevronRight, Info, MessageSquare, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { typeIcon } from '../../lib/documents';
import { plural } from '../../lib/format';
import { removeItem, retryItem } from '../../state/importQueue';
import type { QueueItem } from '../../state/importQueue';
import { Button, ButtonLink } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { Spinner } from '../ui/Spinner';

const EXT_TYPE: Record<string, string> = { '.pdf': 'pdf', '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.gif': 'image', '.webp': 'image', '.bmp': 'image', '.json': 'chatgpt' };

function itemIcon(item: QueueItem) {
  if (item.kind === 'url') return MessageSquare;
  const ext = item.label.slice(item.label.lastIndexOf('.')).toLowerCase();
  return typeIcon(EXT_TYPE[ext] ?? 'markdown');
}

export function ImportQueueItem({ item, failedBefore }: { item: QueueItem; failedBefore: boolean }) {
  const title = item.title || item.label;
  const libraryLink = (
    <ButtonLink variant="ghost" size="sm" iconRight={ChevronRight} to={`/library?q=${encodeURIComponent(title)}`}>
      In library
    </ButtonLink>
  );
  let detail: ReactNode;
  let action: ReactNode = null;
  switch (item.status) {
    case 'queued':
      detail = <span className="text-ink-3">Waiting</span>;
      action = <IconButton icon={X} label="Remove from queue" size="sm" onClick={() => removeItem(item.id)} />;
      break;
    case 'working':
      detail = (
        <span className="flex items-center gap-1.5 text-ink-2">
          <Spinner label="Working" />
          {item.kind === 'url' ? 'Fetching the conversation' : 'Reading and indexing'}
        </span>
      );
      break;
    case 'done':
      detail = (
        <span className="flex items-start gap-1.5 text-ink-2">
          <Icon icon={Check} className="mt-0.5 shrink-0 text-success" />
          <span className="min-w-0">
            Indexed as "{title}" · {plural(item.chunks ?? 0, 'passage', 'passages')}
          </span>
        </span>
      );
      action = libraryLink;
      break;
    case 'duplicate':
      detail = failedBefore ? (
        <span className="flex items-start gap-1.5 text-danger">
          <Icon icon={AlertTriangle} className="mt-0.5 shrink-0" />
          <span className="min-w-0">This failed before. Delete the failed entry in Library, then import again</span>
        </span>
      ) : (
        <span className="flex items-start gap-1.5 text-ink-2">
          <Icon icon={Info} className="mt-0.5 shrink-0 text-ink-3" />
          <span className="min-w-0">Already in your library as "{title}"</span>
        </span>
      );
      action = libraryLink;
      break;
    case 'failed':
      detail = (
        <span className="flex items-start gap-1.5 text-danger">
          <Icon icon={AlertTriangle} className="mt-0.5 shrink-0" />
          <span className="line-clamp-3 min-w-0 break-words">{item.message}</span>
        </span>
      );
      action = (
        <Button variant="secondary" size="sm" onClick={() => retryItem(item.id)}>
          Retry
        </Button>
      );
      break;
    case 'skipped':
      detail = <span className="text-ink-3">Skipped: {(item.message ?? 'Unsupported type').replace(/^Unsupported/, 'unsupported')}</span>;
      action = <IconButton icon={X} label="Dismiss" size="sm" onClick={() => removeItem(item.id)} />;
      break;
  }
  return (
    <li data-queue-item="" className="flex min-h-13 items-start gap-3 px-4 py-2.5">
      <span className="mt-0.5 shrink-0 text-ink-3">
        <Icon icon={itemIcon(item)} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base text-ink" title={item.detail}>
          {item.label}
        </p>
        <div className="mt-0.5 text-sm">{detail}</div>
      </div>
      {action && <div className="-my-0.5 shrink-0">{action}</div>}
    </li>
  );
}
