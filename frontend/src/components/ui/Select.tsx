import { useId } from 'react';
import type { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { Icon } from './Icon';
import { fieldClasses } from './fieldStyles';

export type SelectProps = {
  label: string;
  hideLabel?: boolean;
  options: { value: string; label: string }[];
  wrapperClassName?: string;
} & SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ label, hideLabel, options, className, wrapperClassName, id, ...rest }: SelectProps) {
  const auto = useId();
  const selectId = id ?? auto;
  return (
    <div className={clsx('flex flex-col gap-1.5', wrapperClassName)}>
      <label htmlFor={selectId} className={clsx('text-sm font-medium text-ink', hideLabel && 'sr-only')}>
        {label}
      </label>
      <div className="relative">
        <select id={selectId} className={clsx(fieldClasses, 'cursor-pointer appearance-none pr-9', className)} {...rest}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-2">
          <Icon icon={ChevronDown} />
        </span>
      </div>
    </div>
  );
}
