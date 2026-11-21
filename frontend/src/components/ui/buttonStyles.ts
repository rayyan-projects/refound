import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded font-sans text-base font-medium transition-colors duration-fast ease-out disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50';

const sizes: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 max-lg:h-11',
  md: 'h-9 px-3.5 max-lg:h-11',
  lg: 'h-11 px-4.5',
};

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-btn text-on-btn enabled:hover:bg-btn-hover enabled:active:translate-y-px',
  secondary: 'border border-control bg-surface text-ink enabled:hover:bg-hover enabled:active:bg-active',
  ghost: 'text-ink-2 enabled:hover:bg-hover enabled:hover:text-ink enabled:active:bg-active',
  danger: 'bg-danger-solid text-on-danger enabled:hover:opacity-90 enabled:active:translate-y-px',
};

/** Link-styled buttons have no `enabled:` state; their hover is plain `hover:` unless aria-disabled. */
const linkVariants: Record<ButtonVariant, string> = {
  primary: 'bg-btn text-on-btn hover:bg-btn-hover active:translate-y-px',
  secondary: 'border border-control bg-surface text-ink hover:bg-hover active:bg-active',
  ghost: 'text-ink-2 hover:bg-hover hover:text-ink active:bg-active',
  danger: 'bg-danger-solid text-on-danger hover:opacity-90 active:translate-y-px',
};

export function buttonClasses(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', link = false): string {
  return clsx(base, sizes[size], link ? linkVariants[variant] : variants[variant]);
}

export type IconButtonVariant = 'ghost' | 'secondary' | 'primary';

export function iconButtonClasses(variant: IconButtonVariant = 'ghost', size: 'sm' | 'md' = 'md'): string {
  return clsx(
    'inline-flex shrink-0 items-center justify-center rounded transition-colors duration-fast ease-out disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 max-lg:h-11 max-lg:w-11',
    size === 'sm' ? 'h-7 w-7' : 'h-9 w-9',
    variant === 'ghost' && 'text-ink-2 enabled:hover:bg-hover enabled:hover:text-ink enabled:active:bg-active',
    variant === 'secondary' && 'border border-control bg-surface text-ink enabled:hover:bg-hover enabled:active:bg-active',
    variant === 'primary' && 'bg-btn text-on-btn enabled:hover:bg-btn-hover enabled:active:translate-y-px',
  );
}
