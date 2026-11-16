import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { Icon } from './Icon';
import { fieldClasses } from './fieldStyles';

export type TextFieldProps = {
  label: string;
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  leadingIcon?: LucideIcon;
  trailing?: ReactNode;
  ref?: Ref<HTMLInputElement>;
  wrapperClassName?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export function TextField({
  label,
  hideLabel,
  hint,
  error,
  leadingIcon,
  trailing,
  className,
  wrapperClassName,
  id,
  ...rest
}: TextFieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = clsx(error ? errorId : null, hint ? hintId : null) || undefined;
  return (
    <div className={clsx('flex flex-col gap-1.5', wrapperClassName)}>
      <label htmlFor={inputId} className={clsx('text-sm font-medium text-ink', hideLabel && 'sr-only')}>
        {label}
      </label>
      <div className="relative">
        {leadingIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-3">
            <Icon icon={leadingIcon} />
          </span>
        )}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={clsx(fieldClasses, leadingIcon && 'pl-9', trailing && 'pr-10', error && 'border-danger hover:border-danger', className)}
          {...rest}
        />
        {trailing && <span className="absolute inset-y-0 right-1 flex items-center">{trailing}</span>}
      </div>
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm text-danger">
          <Icon icon={AlertTriangle} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-xs text-ink-3">
          {hint}
        </p>
      )}
    </div>
  );
}
