import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import type { HistoryItem } from '../../services/api';
import { formatDate, parseServerDate } from '../../lib/format';
import { ask } from '../../state/ask';
import { Icon } from '../ui/Icon';
import { Skeleton } from '../ui/Skeleton';

export function RecentQuestions({ items, loading }: { items: HistoryItem[]; loading?: boolean }) {
  const navigate = useNavigate();
  if (!loading && items.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="mb-2 text-sm font-medium text-ink-2">Recent questions</h2>
      {loading ? (
        <div aria-busy="true" className="divide-y divide-line border-y border-line">
          <span className="sr-only">Loading</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex h-11 items-center gap-3 px-4">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-3.5 w-1/2" />
              <span className="flex-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {items.slice(0, 5).map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  void ask(item.query_text);
                  navigate(`/ask?q=${encodeURIComponent(item.query_text)}`, { replace: true });
                }}
                className="flex h-11 w-full items-center gap-3 px-4 text-left transition-colors duration-fast ease-out hover:bg-hover active:bg-active max-lg:min-h-11"
              >
                <span className="shrink-0 text-ink-3">
                  <Icon icon={Clock} />
                </span>
                <span className="min-w-0 flex-1 truncate text-base text-ink" title={item.query_text}>
                  {item.query_text}
                </span>
                <span className="shrink-0 text-xs text-ink-3">{formatDate(parseServerDate(item.created_at))}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
