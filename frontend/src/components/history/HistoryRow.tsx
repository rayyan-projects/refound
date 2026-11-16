import { Link } from 'react-router-dom';
import clsx from 'clsx';
import type { HistoryItem } from '../../services/api';
import { formatDuration, formatTime, parseServerDate, plural } from '../../lib/format';

export function HistoryRow({ item, selected }: { item: HistoryItem; selected: boolean }) {
  const meta = [
    formatTime(parseServerDate(item.created_at)),
    item.sources ? plural(item.sources.length, 'source', 'sources') : '',
    formatDuration(item.duration_ms),
  ].filter(Boolean);
  return (
    <Link
      to={`/history/${item.id}`}
      data-history-row=""
      aria-current={selected ? 'true' : undefined}
      className={clsx(
        'relative flex min-h-15 flex-col justify-center rounded px-3 py-2 transition-colors duration-fast ease-out',
        selected ? 'bg-active' : 'hover:bg-hover',
      )}
    >
      {selected && <span aria-hidden="true" className="absolute left-0 top-3 h-4 w-0.5 rounded-full bg-accent" />}
      <span className="line-clamp-2 break-words text-base text-ink" title={item.query_text}>{item.query_text || 'Untitled question'}</span>
      {meta.length > 0 && <span className="mt-0.5 font-mono text-xs tabular-nums text-ink-3">{meta.join(' · ')}</span>}
    </Link>
  );
}
