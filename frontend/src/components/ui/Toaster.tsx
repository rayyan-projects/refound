import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Info, X } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../../hooks/useStore';
import { dismissToast, toastStore } from '../../state/toasts';
import type { Toast } from '../../state/toasts';
import { Button } from './Button';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

function ToastItem({ t }: { t: Toast }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;

  useEffect(() => {
    if (paused || t.tone === 'danger') return;
    const timer = window.setTimeout(() => dismissToast(t.id), t.action ? 8000 : 5000);
    return () => window.clearTimeout(timer);
  }, [paused, t.id, t.tone, t.action]);

  const icon = t.tone === 'success' ? Check : t.tone === 'danger' ? AlertTriangle : Info;
  return (
    <div
      role={t.tone === 'danger' ? 'alert' : 'status'}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
      className="pointer-events-auto flex w-full max-w-toast animate-rise items-center gap-3 rounded-lg border border-line bg-raised px-4 py-3 text-base text-ink shadow-2"
    >
      <span className={clsx('shrink-0', t.tone === 'success' ? 'text-success' : t.tone === 'danger' ? 'text-danger' : 'text-ink-3')}>
        <Icon icon={icon} />
      </span>
      <p className="min-w-0 flex-1 break-words">{t.message}</p>
      {t.action && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            t.action?.onSelect();
            dismissToast(t.id);
          }}
        >
          {t.action.label}
        </Button>
      )}
      <IconButton icon={X} label="Dismiss" size="sm" onClick={() => dismissToast(t.id)} className="-mr-1.5" />
    </div>
  );
}

export function Toaster() {
  const toasts = useStore(toastStore);
  return (
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-4 bottom-22 z-50 flex flex-col items-center gap-2 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:items-end"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  );
}
