import type { MouseEvent } from 'react';
import clsx from 'clsx';

const base = 'inline-block rounded-sm px-1 align-baseline text-xs tabular-nums leading-5 text-accent';

export function CitationMark({
  n,
  active,
  interactive,
  onHover,
}: {
  n: number;
  active: boolean;
  interactive: boolean;
  onHover?: (n: number | null) => void;
}) {
  if (!interactive) {
    return (
      <span className={base} aria-label={`Source ${n}`}>
        {n}
      </span>
    );
  }
  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const card = document.getElementById(`source-${n}`);
    if (!card) return;
    card.scrollIntoView({ block: 'nearest' });
    card.focus({ preventScroll: true });
    onHover?.(n);
  }
  return (
    <a
      href={`#source-${n}`}
      aria-label={`Source ${n}`}
      onClick={onClick}
      onMouseEnter={() => onHover?.(n)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(n)}
      onBlur={() => onHover?.(null)}
      className={clsx(base, 'no-underline transition-colors duration-fast ease-out hover:bg-accent-soft', active && 'bg-accent-soft')}
    >
      {n}
    </a>
  );
}
