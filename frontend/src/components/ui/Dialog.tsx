import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import clsx from 'clsx';

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'sm',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      el.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto"
    >
      {open && (
        <div
          className={clsx(
            'animate-rise rounded-xl border border-line bg-raised p-6 text-ink shadow-3',
            size === 'md' ? 'w-dialog md:w-dialog-md' : 'w-dialog',
          )}
        >
          <h2 id={titleId} className="font-serif text-title font-medium text-ink">
            {title}
          </h2>
          {description && (
            <div id={descId} className="mt-2 text-base text-ink-2">
              {description}
            </div>
          )}
          {children && <div className="mt-4">{children}</div>}
          {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
