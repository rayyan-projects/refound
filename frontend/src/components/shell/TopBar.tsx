import { Link } from 'react-router-dom';
import { Search, Settings } from 'lucide-react';
import { useBackendStatus } from '../../hooks/useBackendStatus';
import { openPalette } from '../../state/palette';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { StatusDot } from '../ui/StatusDot';
import { iconButtonClasses } from '../ui/buttonStyles';

const LABEL = { checking: 'Checking the backend', online: 'Backend connected', offline: 'Backend offline' } as const;

export function TopBar() {
  const { status } = useBackendStatus();
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-canvas px-4 md:px-6 lg:hidden">
      <Link to="/ask" className="flex h-11 items-center rounded-sm font-serif text-lg font-medium text-ink">
        ReFound
      </Link>
      <div className="flex-1" />
      <Link to="/settings#connection" className="flex h-11 w-11 items-center justify-center rounded" title={LABEL[status]}>
        <StatusDot state={status} />
        <span className="sr-only">{LABEL[status]}</span>
      </Link>
      <IconButton icon={Search} label="Search or jump to" onClick={openPalette} data-palette-trigger="" />
      <Link to="/settings" aria-label="Settings" title="Settings" className={iconButtonClasses('ghost')}>
        <Icon icon={Settings} />
      </Link>
    </header>
  );
}
