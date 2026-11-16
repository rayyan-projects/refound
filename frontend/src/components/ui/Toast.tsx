import { useEffect } from 'react';

export type ToastType = 'success' | 'error';

interface ToastProps {
  message: string;
  type: ToastType;
  onDismiss: () => void;
  duration?: number;
}

export function Toast({ message, type, onDismiss, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  const borderColor = type === 'success' ? 'border-success' : 'border-error';

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 bg-surface border ${borderColor} rounded-md px-4 py-3 shadow-lg max-w-sm`}
    >
      <p className="text-body-sm text-cream">{message}</p>
    </div>
  );
}

