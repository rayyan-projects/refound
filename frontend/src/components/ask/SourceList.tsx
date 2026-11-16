import type { Document, Source } from '../../services/api';
import { matchDocument } from '../../lib/documents';
import { queryTerms } from '../../lib/text';
import { SourceCard, SourceCardSkeleton } from './SourceCard';

export function SourceList({
  sources,
  loadingCount,
  question,
  label = 'Sources',
  emptyText = 'No passages were returned for this answer',
  caption,
  activeCite = null,
  onHover,
  docs,
}: {
  sources: Source[] | null;
  loadingCount: number;
  question: string;
  label?: string;
  emptyText?: string;
  caption?: string;
  activeCite?: number | null;
  onHover?: (n: number | null) => void;
  /** Current documents, or undefined while they load. */
  docs?: Document[];
}) {
  const terms = queryTerms(question);
  return (
    <section aria-label={label} className="min-w-0">
      <h2 className="mb-2 text-sm font-medium text-ink-2">{label}</h2>
      {caption && <p className="mb-3 text-xs text-ink-3">{caption}</p>}
      {sources === null ? (
        <div aria-busy="true">
          <span className="sr-only">Loading</span>
          <ol className="flex flex-col gap-3">
            {Array.from({ length: loadingCount }, (_, i) => (
              <SourceCardSkeleton key={i} />
            ))}
          </ol>
        </div>
      ) : sources.length === 0 ? (
        <p className="text-sm text-ink-3">{emptyText}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {sources.map((s, i) => (
            <SourceCard
              key={i}
              index={i + 1}
              source={s}
              doc={docs ? matchDocument(s, docs) : undefined}
              docsLoaded={docs !== undefined}
              terms={terms}
              active={activeCite === i + 1}
              onHover={onHover}
            />
          ))}
        </ol>
      )}
    </section>
  );
}
