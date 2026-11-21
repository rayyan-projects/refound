import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Skeleton } from '../ui/Skeleton';

export function PageHeader({
  title,
  meta,
  actions,
  loading,
  className,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  loading?: boolean;
  className?: string;
}) {
  return (
    <header className={clsx('mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between', className)}>
      <div className="min-w-0">
        <h1 tabIndex={-1} className="font-display text-title font-extrabold text-ink focus:outline-none md:text-page">
          {title}
        </h1>
        {loading ? (
          <Skeleton className="mt-2 h-3 w-40" />
        ) : (
          meta && <p className="mt-1 text-xs tabular-nums text-ink-3">{meta}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
