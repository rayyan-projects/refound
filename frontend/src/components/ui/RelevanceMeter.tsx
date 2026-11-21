import clsx from 'clsx';
import { relevance } from '../../lib/relevance';

export function RelevanceMeter({ score, showLabel = true }: { score: number; showLabel?: boolean }) {
  const r = relevance(score);
  return (
    <span className="inline-flex items-center gap-1.5" title={`Reranker score ${r.raw}`} aria-label={r.label} role="img">
      <span className="inline-flex items-end gap-0.5" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span key={i} className={clsx('block h-3 w-1 rounded-px', i <= r.bars ? 'bg-ink-2' : 'bg-line-strong')} />
        ))}
      </span>
      {showLabel && (
        <span className="text-xs text-ink-2" aria-hidden="true">
          {r.label}
        </span>
      )}
    </span>
  );
}
