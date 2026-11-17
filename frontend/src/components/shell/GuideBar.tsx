import { useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Settings } from 'lucide-react';
import clsx from 'clsx';
import { useBackendStatus } from '../../hooks/useBackendStatus';
import { formatCount } from '../../lib/format';
import { paletteKeys } from '../../lib/platform';
import { spring } from '../../lib/spring';
import type { Spring } from '../../lib/spring';
import { openPalette } from '../../state/palette';
import { Icon } from '../ui/Icon';
import { StatusDot } from '../ui/StatusDot';
import { NAV_ITEMS } from './navItems';
import { useNavCounts } from './navCounts';

const STATUS = { checking: 'Checking', online: 'Connected', offline: 'Offline' } as const;

/* Each guide tab is cut a little differently, like real index-card dividers. Fixed per tab, never random. */
const CUT = ['pl-4 pr-5 md:pl-5 md:pr-6', 'pl-5 pr-4 md:pl-6 md:pr-5', 'pl-4 pr-4 md:pl-5 md:pr-5', 'pl-5 pr-5 md:pl-6 md:pr-7'];

/**
 * The top bar: a strip of index-card guide tabs. Inactive tabs are recessed manila; the current page's tab stands
 * proud, in the page's own paper, and joins the page below. One shared "proud" plate springs between tabs.
 */
export function GuideBar() {
  const { pathname } = useLocation();
  const { status, host } = useBackendStatus();
  const counts = useNavCounts();
  const rowRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLSpanElement>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const springs = useRef<{ x: Spring; w: Spring } | null>(null);
  const placed = useRef(false);

  const active = NAV_ITEMS.findIndex((n) => pathname === n.to || pathname.startsWith(`${n.to}/`));
  const onSettings = pathname.startsWith('/settings');

  // Move the proud plate to the current tab (spring), or fade it out when no tab is current.
  useLayoutEffect(() => {
    const plate = plateRef.current;
    const row = rowRef.current;
    if (!plate || !row) return;
    if (!springs.current) {
      springs.current = {
        x: spring((v) => (plate.style.transform = `translateX(${v}px)`), 340, 28),
        w: spring((v) => (plate.style.width = `${v}px`), 340, 28),
      };
    }
    const s = springs.current;
    const measure = (animate: boolean) => {
      const el = active >= 0 ? tabRefs.current[active] : null;
      if (!el) {
        plate.style.opacity = '0';
        placed.current = false;
        return;
      }
      const go = animate && placed.current ? 'set' : 'snap';
      s.x[go](el.offsetLeft);
      s.w[go](el.offsetWidth);
      plate.style.opacity = '1';
      placed.current = true;
    };
    measure(true);
    const ro = new ResizeObserver(() => measure(false));
    ro.observe(row);
    return () => ro.disconnect();
  }, [active, counts.library, counts.import]);

  function onKeyDown(e: KeyboardEvent<HTMLAnchorElement>, i: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const n = NAV_ITEMS.length;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + n) % n;
    tabRefs.current[next]?.focus();
  }

  const count = (key: string) => (key === 'library' ? counts.library : key === 'import' ? counts.import : null);

  return (
    <header className="sticky top-0 z-30 bg-bar text-ink">
      <div className="mx-auto flex max-w-content flex-wrap items-end gap-x-6 px-4 md:px-6 lg:flex-nowrap lg:px-10">
        <div className="flex h-12 w-full items-center gap-2 lg:order-none lg:h-16 lg:w-auto lg:self-center">
          <Link
            to="/"
            aria-current={pathname === '/' ? 'page' : undefined}
            className="flex h-11 items-center rounded-sm font-display text-lg font-extrabold tracking-tight text-ink"
          >
            ReFound
          </Link>
          <div className="flex-1 lg:hidden" />
          <BarTools status={status} host={host} onSettings={onSettings} className="lg:hidden" />
        </div>

        <nav aria-label="Main" className="relative w-full min-w-0 lg:flex-1">
          <div ref={rowRef} className="relative flex items-end gap-1 md:gap-1.5">
            <span
              ref={plateRef}
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-px left-0 h-12 rounded-t-lg border-x border-t border-line-strong bg-canvas opacity-0 transition-opacity duration-base ease-out lg:h-13"
            >
              <span className="absolute inset-x-3 top-1.5 h-0.5 rounded-full bg-accent" />
            </span>
            {NAV_ITEMS.map((item, i) => {
              const current = i === active;
              const c = count(item.key);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  aria-current={current ? 'page' : undefined}
                  className={clsx(
                    'group relative flex min-w-0 flex-auto items-center justify-center gap-1.5 rounded-t-lg text-sm outline-offset-0 transition-[transform,background-color,color] duration-slow ease-bounce md:flex-none md:text-base',
                    CUT[i],
                    current
                      ? 'z-10 h-12 font-semibold text-ink lg:h-13'
                      : 'mb-0 h-11 translate-y-0 border-x border-t border-line bg-tab text-ink-2 hover:-translate-y-0.5 hover:bg-tab-hover hover:text-ink focus-visible:-translate-y-0.5 motion-reduce:hover:translate-y-0',
                  )}
                >
                  <span className="truncate">{item.label}</span>
                  {c !== null && <span className={clsx('text-xs tabular-nums', current ? 'text-ink-2' : 'text-ink-3')}>{formatCount(c)}</span>}
                </NavLink>
              );
            })}
          </div>
        </nav>

        <BarTools status={status} host={host} onSettings={onSettings} className="hidden lg:flex lg:h-16 lg:self-center" />
      </div>
      <div aria-hidden="true" className="h-px bg-line-strong" />
    </header>
  );
}

function BarTools({
  status,
  host,
  onSettings,
  className,
}: {
  status: 'checking' | 'online' | 'offline';
  host: string;
  onSettings: boolean;
  className?: string;
}) {
  return (
    <div className={clsx('flex shrink-0 items-center gap-1', className)}>
      <button
        type="button"
        onClick={openPalette}
        data-palette-trigger=""
        aria-label="Search or jump to"
        title="Search or jump to"
        className="flex h-11 items-center rounded px-1.5 text-ink-2 transition-colors duration-fast ease-out hover:text-ink lg:h-9"
      >
        <kbd className="inline-flex h-6 items-center rounded-sm border border-b-2 border-line-strong bg-canvas px-2 text-xs font-medium tabular-nums text-ink">
          {paletteKeys()}
        </kbd>
      </button>
      <Link
        to="/settings#connection"
        aria-label={`Backend: ${STATUS[status]}, ${host}`}
        title={`Backend at ${host}`}
        className="flex h-11 items-center gap-1.5 rounded px-2 text-sm text-ink-2 transition-colors duration-fast ease-out hover:text-ink lg:h-9"
      >
        <StatusDot state={status} />
        <span aria-hidden="true">{STATUS[status]}</span>
      </Link>
      <Link
        to="/settings"
        aria-label="Settings"
        title="Settings"
        aria-current={onSettings ? 'page' : undefined}
        className={clsx(
          'relative flex h-11 w-11 items-center justify-center rounded transition-colors duration-fast ease-out hover:text-ink lg:h-9 lg:w-9',
          onSettings ? 'text-ink' : 'text-ink-2',
        )}
      >
        <Icon icon={Settings} />
        {onSettings && <span aria-hidden="true" className="absolute inset-x-2.5 bottom-1 h-0.5 rounded-full bg-accent" />}
      </Link>
    </div>
  );
}
