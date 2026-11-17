import { useLayoutEffect, useRef, useState } from 'react';
import { ChevronRight, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import type { Document, Source } from '../../services/api';
import { isUrl, sourceTitle, sourceType, displayTitle } from '../../lib/documents';
import { cleanText, highlight, splitSpeaker } from '../../lib/text';
import { Button, ButtonLink } from '../ui/Button';
import { CallNumber } from '../ui/CallNumber';
import { Icon } from '../ui/Icon';
import { RelevanceMeter } from '../ui/RelevanceMeter';
import { Skeleton } from '../ui/Skeleton';
import { iconButtonClasses } from '../ui/buttonStyles';

export function SourceCard({
  index,
  source,
  doc,
  terms,
  active = false,
  docsLoaded = true,
  showActions = true,
  onHover,
}: {
  index: number;
  source: Source;
  doc?: Document;
  terms: string[];
  active?: boolean;
  docsLoaded?: boolean;
  showActions?: boolean;
  onHover?: (n: number | null) => void;
}) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  const { speaker, text } = splitSpeaker(cleanText(source.excerpt));
  const body = source.excerpt.length >= 300 ? `${text}…` : text;
  const title = sourceTitle(source, doc);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (!el.classList.contains('line-clamp-4')) return;
      setOverflows(el.scrollHeight > el.clientHeight + 1);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <li
      id={`source-${index}`}
      tabIndex={-1}
      onMouseEnter={() => onHover?.(index)}
      onMouseLeave={() => onHover?.(null)}
      className={clsx(
        'relative -mx-3 flex flex-col gap-2 rounded border-t border-line px-3 py-4 transition-colors duration-fast ease-out',
        active ? 'bg-accent-soft' : 'hover:bg-hover',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-xs tabular-nums text-accent">{index}</span>
        <span className="min-w-0 flex-1 truncate text-base font-medium text-ink" title={title}>
          {title}
        </span>
        {doc && <CallNumber doc={doc} />}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-7">
        <RelevanceMeter score={source.score} />
        {doc && (
          <>
            <span aria-hidden="true" className="text-xs text-ink-3">
              ·
            </span>
            <span className="text-xs text-ink-2">{sourceType(doc.source_type).label}</span>
          </>
        )}
        {!doc && docsLoaded && (
          <>
            <span aria-hidden="true" className="text-xs text-ink-3">
              ·
            </span>
            <span className="text-xs text-ink-3">no longer in library</span>
          </>
        )}
      </div>
      <div className="pl-7">
        {speaker && <p className="mb-1 text-xs text-ink-3">{speaker}</p>}
        <p ref={textRef} className={clsx('whitespace-pre-line font-sans text-md text-ink-2', !expanded && 'line-clamp-4')}>
          {highlight(body, terms).map((seg, i) => (seg.hit ? <mark key={i}>{seg.text}</mark> : <span key={i}>{seg.text}</span>))}
        </p>
        {(overflows || expanded) && (
          <Button variant="ghost" size="sm" className="-ml-2.5 mt-1" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Show less' : 'Show more'}
          </Button>
        )}
      </div>
      {showActions && doc && (
        <div className="-mb-1 flex items-center gap-1 pl-7">
          <ButtonLink variant="ghost" size="sm" className="-ml-2.5" iconRight={ChevronRight} to={`/library?q=${encodeURIComponent(displayTitle(doc))}`}>
            In library
          </ButtonLink>
          {isUrl(doc.filename) && (
            <a
              href={doc.filename}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Open the original share link"
              title="Open the original share link"
              className={iconButtonClasses('ghost', 'sm')}
            >
              <Icon icon={ExternalLink} />
            </a>
          )}
        </div>
      )}
    </li>
  );
}

export function SourceCardSkeleton() {
  return (
    <li className="flex flex-col gap-3 border-t border-line py-4" aria-hidden="true">
      <Skeleton className="h-3.5 w-3/5" />
      <Skeleton className="h-3 w-1/3" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
      </div>
    </li>
  );
}
