import { AlertTriangle, Info, RotateCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Callout } from '../ui/Callout';

export function NoKeyNotice() {
  return (
    <Callout tone="neutral" icon={Info} title="No written answer">
      The backend has no Gemini key, so ReFound can only show the closest passages. Add{' '}
      <code className="rounded-sm bg-sunken px-1 font-mono text-sm">GEMINI_API_KEY</code> to{' '}
      <code className="rounded-sm bg-sunken px-1 font-mono text-sm">backend/.env</code> and restart the backend to get written answers
    </Callout>
  );
}

export function LlmErrorNotice({ detail, onRetry, retryDisabled }: { detail: string; onRetry?: () => void; retryDisabled?: boolean }) {
  return (
    <Callout
      tone="danger"
      icon={AlertTriangle}
      title="The answer could not be written"
      actions={
        onRetry && (
          <Button variant="secondary" size="sm" icon={RotateCw} onClick={onRetry} disabled={retryDisabled}>
            Try again
          </Button>
        )
      }
    >
      <p>Gemini returned an error. The passages below were still found</p>
      {detail && (
        <p className="mt-1 line-clamp-3 break-words font-mono text-xs text-ink-2" title={detail}>
          {detail}
        </p>
      )}
    </Callout>
  );
}

export function WeakMatchNotice() {
  return (
    <Callout tone="neutral" icon={Info}>
      Nothing in your library matches this closely. Treat the answer with care
    </Callout>
  );
}
