import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { Icon } from './Icon';

export function Callout({
  tone,
  icon,
  title,
  children,
  actions,
  className,
}: {
  tone: 'neutral' | 'danger' | 'success';
  icon?: LucideIcon;
  title?: string;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={clsx(
        'flex gap-3 rounded-lg border border-line p-4',
        tone === 'neutral' && 'bg-sunken',
        tone === 'danger' && 'bg-danger-soft',
        tone === 'success' && 'bg-success-soft',
        className,
      )}
    >
      {icon && (
        <span className={clsx('mt-0.5 shrink-0', tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-ink-2')}>
          <Icon icon={icon} />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-base text-ink">
        {title && <p className={clsx('font-medium', tone === 'danger' && 'text-danger')}>{title}</p>}
        {children && <div className="min-w-0">{children}</div>}
        {actions && <div className="mt-2 flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
