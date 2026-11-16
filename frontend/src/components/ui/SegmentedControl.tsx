import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { Icon } from './Icon';

export interface SegmentOption {
  value: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

export function SegmentedControl({
  label,
  value,
  onChange,
  options,
  size = 'sm',
  disabled,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: SegmentOption[];
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(0, options.findIndex((o) => o.value === value));

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (current + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (current - 1 + options.length) % options.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    if (next === -1) return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div className={clsx('max-w-full overflow-x-auto', className)}>
      <div role="radiogroup" aria-label={label} className="inline-flex gap-0.5 whitespace-nowrap rounded bg-sunken p-0.5">
        {options.map((o, i) => {
          const selected = i === current;
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(o.value)}
              onKeyDown={onKeyDown}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-sm px-3 text-sm transition-colors duration-fast ease-out disabled:cursor-not-allowed disabled:opacity-50',
                size === 'sm' ? 'h-7' : 'h-8',
                'max-lg:h-11',
                selected ? 'bg-surface font-medium text-ink shadow-1 dark:bg-raised' : 'text-ink-2 enabled:hover:text-ink',
              )}
            >
              {o.icon && <Icon icon={o.icon} />}
              {o.label}
              {o.count !== undefined && <span className="font-mono text-xs tabular-nums text-ink-3">{o.count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
