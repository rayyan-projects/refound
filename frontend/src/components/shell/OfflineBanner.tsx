import { Unplug } from 'lucide-react';
import { useBackendStatus } from '../../hooks/useBackendStatus';
import { Button, ButtonLink } from '../ui/Button';
import { Callout } from '../ui/Callout';

export function OfflineBanner() {
  const { status, host, refetch } = useBackendStatus();
  if (status !== 'offline') return null;
  return (
    <Callout
      tone="neutral"
      icon={Unplug}
      className="mb-6"
      actions={
        <>
          <Button size="sm" variant="secondary" onClick={refetch}>
            Retry now
          </Button>
          <ButtonLink size="sm" variant="ghost" to="/settings#connection">
            Connection settings
          </ButtonLink>
        </>
      }
    >
      The backend at <span className="font-mono text-sm">{host}</span> is not answering. ReFound is retrying every 5 seconds
    </Callout>
  );
}
