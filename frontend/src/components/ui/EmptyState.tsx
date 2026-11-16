import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { Icon } from './Icon';

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
  headingLevel = 2,
}: {
  icon: LucideIcon;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
  headingLevel?: 1 | 2 | 3;
}) {
  const H = `h${headingLevel}` as 'h1' | 'h2' | 'h3';
  return (
    <div className={clsx('max-w-narrow py-10', className)}>
      <span className="text-ink-3">
        <Icon icon={icon} size={20} />
      </span>
      <H tabIndex={headingLevel === 1 ? -1 : undefined} className="mt-3 font-serif text-title font-medium text-ink focus:outline-none">
        {title}
      </H>
      {body && <div className="mt-2 text-base text-ink-2">{body}</div>}
      {action && <div className="mt-4 flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}
