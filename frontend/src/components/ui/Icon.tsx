import type { LucideIcon } from 'lucide-react';

export function Icon({ icon: C, size = 16, className }: { icon: LucideIcon; size?: 16 | 20; className?: string }) {
  return <C size={size} strokeWidth={1.5} aria-hidden="true" focusable="false" className={className} />;
}
