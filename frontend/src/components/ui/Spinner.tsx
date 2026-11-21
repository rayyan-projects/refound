import { Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { Icon } from './Icon';

export function Spinner({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <span role="status" className={clsx('inline-flex shrink-0', className)}>
      <Icon icon={Loader2} className="animate-spin" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
