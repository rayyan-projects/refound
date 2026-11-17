import { Link, NavLink } from 'react-router-dom';
import { Search } from 'lucide-react';
import clsx from 'clsx';
import { formatCount } from '../../lib/format';
import { paletteKeys } from '../../lib/platform';
import { openPalette } from '../../state/palette';
import { Icon } from '../ui/Icon';
import { Kbd } from '../ui/Kbd';
import { ConnectionStatus } from './ConnectionStatus';
import { NAV_ITEMS, SETTINGS_ITEM } from './navItems';
import type { NavItem } from './navItems';
import { useNavCounts } from './navCounts';

function NavRow({ item, count }: { item: NavItem; count?: number | null }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        clsx(
          'relative flex h-9 items-center gap-2 rounded px-2 text-base transition-colors duration-fast ease-out',
          isActive ? 'bg-active font-medium text-ink' : 'text-ink-2 hover:bg-hover hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span aria-hidden="true" className="absolute left-0 top-2.5 h-4 w-0.5 rounded-full bg-accent" />}
          <Icon icon={item.icon} />
          <span className="flex-1">{item.label}</span>
          {count !== null && count !== undefined && (
            <span className="text-xs tabular-nums text-ink-3">{formatCount(count)}</span>
          )}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const counts = useNavCounts();
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-sidebar flex-col border-r border-line bg-sunken p-3 lg:flex">
      <div className="flex h-14 shrink-0 items-center px-2">
        <Link to="/ask" className="rounded-sm font-display text-lg font-extrabold text-ink">
          ReFound
        </Link>
      </div>
      <button
        type="button"
        onClick={openPalette}
        data-palette-trigger=""
        className="mb-4 flex h-9 w-full items-center gap-2 rounded border border-control bg-surface px-2.5 text-left text-base text-ink-3 transition-colors duration-fast ease-out hover:border-ink-3"
      >
        <Icon icon={Search} />
        <span className="flex-1">Search or jump to</span>
        <Kbd>{paletteKeys()}</Kbd>
      </button>
      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <NavRow key={item.to} item={item} count={item.key === 'library' ? counts.library : item.key === 'import' ? counts.import : null} />
        ))}
      </nav>
      <div className="flex-1" />
      <div className="flex flex-col gap-1">
        <NavRow item={SETTINGS_ITEM} />
        <ConnectionStatus />
      </div>
    </aside>
  );
}
