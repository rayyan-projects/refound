import { useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { Callout } from './Callout';
import { Dialog } from './Dialog';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'default';
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({ open, onClose, title, body, confirmLabel, tone = 'default', onConfirm }: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  // Start fresh each time the dialog opens (state adjusted during render, not in an effect).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPending(false);
      setError(null);
    }
  }

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      setPending(false);
      onClose();
    } catch (err) {
      setPending(false);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!pending) onClose();
      }}
      title={title}
      description={body}
      footer={
        <>
          <Button variant="secondary" autoFocus onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={pending} onClick={() => void confirm()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {error && (
        <Callout tone="danger" icon={AlertTriangle} title="That did not work">
          {error}
        </Callout>
      )}
    </Dialog>
  );
}
