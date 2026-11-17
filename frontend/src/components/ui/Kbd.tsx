import type { ReactNode } from 'react';
import clsx from 'clsx';

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={clsx(
        'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-sm border border-line bg-sunken px-1.5 text-xs text-ink-2',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
