import type { KeyboardEvent } from 'react';
import { Search, SearchX } from 'lucide-react';
import type { HistoryItem } from '../../services/api';
import { formatDayHeading, parseServerDate } from '../../lib/format';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { TextField } from '../ui/TextField';
import { HistoryRow } from './HistoryRow';

function groupByDay(items: HistoryItem[]): { heading: string; items: HistoryItem[] }[] {
  const groups: { heading: string; items: HistoryItem[] }[] = [];
  for (const item of items) {
    const heading = formatDayHeading(parseServerDate(item.created_at));
    const last = groups[groups.length - 1];
    if (last && last.heading === heading) last.items.push(item);
    else groups.push({ heading, items: [item] });
  }
  return groups;
}

function onArrow(e: KeyboardEvent<HTMLDivElement>) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const rows = Array.from(e.currentTarget.querySelectorAll<HTMLAnchorElement>('[data-history-row]'));
  const i = rows.indexOf(document.activeElement as HTMLAnchorElement);
  if (i === -1) return;
  e.preventDefault();
  rows[Math.min(rows.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
}

export function HistoryList({
  items,
  filter,
  onFilter,
  selectedId,
}: {
  items: HistoryItem[];
  filter: string;
  onFilter: (v: string) => void;
  selectedId: number | null;
}) {
  const needle = filter.trim().toLowerCase();
  const visible = needle ? items.filter((it) => (it.query_text ?? '').toLowerCase().includes(needle)) : items;
  return (
    <div className="flex flex-col gap-4">
      <TextField
        label="Filter questions"
        hideLabel
        leadingIcon={Search}
        placeholder="Filter questions"
        type="search"
        value={filter}
        onChange={(e) => onFilter(e.target.value)}
      />
      {visible.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No questions match"
          className="py-6"
          action={
            <Button variant="ghost" onClick={() => onFilter('')}>
              Clear filter
            </Button>
          }
        />
      ) : (
        <div onKeyDown={onArrow} className="flex flex-col gap-6">
          {groupByDay(visible).map((g) => (
            <section key={g.heading}>
              <h2 data-day-heading="" className="mb-2 px-3 text-sm font-medium text-ink-2">
                {g.heading}
              </h2>
              <ul className="flex flex-col gap-0.5">
                {g.items.map((item) => (
                  <li key={item.id}>
                    <HistoryRow item={item} selected={item.id === selectedId} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
