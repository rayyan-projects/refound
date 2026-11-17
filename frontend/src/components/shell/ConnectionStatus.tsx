import { Link } from 'react-router-dom';
import { useBackendStatus } from '../../hooks/useBackendStatus';
import { StatusDot } from '../ui/StatusDot';

const LABEL = { checking: 'Checking', online: 'Connected', offline: 'Offline' } as const;

export function ConnectionStatus() {
  const { status, host } = useBackendStatus();
  return (
    <Link
      to="/settings#connection"
      aria-label={`Backend: ${LABEL[status]}, ${host}`}
      className="flex h-11 items-center gap-2.5 rounded px-2 transition-colors duration-fast ease-out hover:bg-hover"
    >
      <StatusDot state={status} />
      <span className="flex min-w-0 flex-col">
        <span className="text-sm text-ink">{LABEL[status]}</span>
        <span className="truncate text-xs tabular-nums text-ink-3" title={host}>
          {host}
        </span>
      </span>
    </Link>
  );
}
