import clsx from 'clsx';

export function StatusDot({ state, className }: { state: 'online' | 'offline' | 'checking'; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        'inline-block h-2 w-2 shrink-0 rounded-full',
        state === 'online' && 'bg-success',
        state === 'checking' && 'bg-ink-3',
        state === 'offline' && 'border border-ink-3',
        className,
      )}
    />
  );
}
