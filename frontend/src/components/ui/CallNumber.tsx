import clsx from 'clsx';
import type { Document } from '../../services/api';
import { callNumber } from '../../lib/documents';

export function CallNumber({ doc, value, className }: { doc?: Document; value?: string; className?: string }) {
  const text = value ?? (doc ? callNumber(doc) : '');
  if (!text) return null;
  return (
    <span title="Call number" className={clsx('shrink-0 whitespace-nowrap text-xs tabular-nums text-ink-3', className)}>
      {text}
    </span>
  );
}
