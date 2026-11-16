import type { ReactNode } from 'react';

export function SettingRow({ label, description, children, labelFor }: { label: string; description?: ReactNode; children: ReactNode; labelFor?: string }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-10">
      <div className="max-w-label">
        {labelFor ? (
          <label htmlFor={labelFor} className="font-medium text-ink">
            {label}
          </label>
        ) : (
          <p className="font-medium text-ink">{label}</p>
        )}
        {description && <p className="mt-0.5 text-sm text-ink-2">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
