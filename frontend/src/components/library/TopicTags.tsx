import { Tag } from '../ui/Tag';

export function TopicTags({ topics }: { topics: string[] }) {
  if (topics.length === 0) return null;
  const shown = topics.slice(0, 3);
  const rest = topics.length - shown.length;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((t) => (
        <Tag key={t}>{t}</Tag>
      ))}
      {rest > 0 && <span className="text-xs tabular-nums text-ink-3">+{rest}</span>}
    </span>
  );
}
