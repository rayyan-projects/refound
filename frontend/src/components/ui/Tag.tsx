import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { Icon } from './Icon';

export function Tag({
  tone = 'neutral',
  icon,
  children,
  className,
}: {
  tone?: 'neutral' | 'success' | 'danger' | 'accent';
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-sm px-1.5 text-xs font-medium',
        tone === 'neutral' && 'bg-sunken text-ink-2',
        tone === 'success' && 'bg-success-soft text-success',
        tone === 'danger' && 'bg-danger-soft text-danger',
        tone === 'accent' && 'bg-accent-soft text-accent',
        className,
      )}
    >
      {icon && <Icon icon={icon} />}
      {children}
    </span>
  );
}
