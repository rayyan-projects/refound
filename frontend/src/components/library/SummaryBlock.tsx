import { useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Button } from '../ui/Button';

export function SummaryBlock({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (el.classList.contains('line-clamp-2')) setOverflows(el.scrollHeight > el.clientHeight + 1);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="mt-1">
      <p ref={ref} className={clsx('font-serif text-md text-ink-2', !expanded && 'line-clamp-2')}>
        {text}
      </p>
      {(overflows || expanded) && (
        <Button variant="ghost" size="sm" className="-ml-2.5" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      )}
    </div>
  );
}
