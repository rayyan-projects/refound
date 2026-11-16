import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { Icon } from '../ui/Icon';
import { NAV_ITEMS } from './navItems';

export function TabBar() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-surface pb-safe lg:hidden"
    >
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            clsx(
              'relative flex h-14 flex-col items-center justify-center gap-0.5 text-xs transition-colors duration-fast ease-out',
              isActive ? 'font-medium text-ink' : 'text-ink-3 hover:text-ink',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && <span aria-hidden="true" className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-accent" />}
              <Icon icon={item.icon} size={20} />
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
