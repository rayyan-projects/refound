import clsx from 'clsx';
import type { DrawerProps } from './drawerTypes';

/**
 * The designed still of the drawer, for no WebGL or reduced motion: card edges seen from the front of the tray,
 * divider tabs labelled, the cited cards raised with amber flags, and the open card's face in front.
 */
export function StaticDrawer({ items, flagged, focus, label }: Pick<DrawerProps, 'items' | 'flagged' | 'focus' | 'label'>) {
  const flags = new Set(flagged);
  const openIndex = focus ?? flagged[0] ?? items.findIndex((it) => it.kind === 'card');
  const open = openIndex >= 0 ? items[openIndex] : undefined;
  const edges = items.slice(0, 40);
  return (
    <div role="img" aria-label={label} data-static-drawer="" className="absolute inset-0 flex flex-col items-center justify-center gap-6 overflow-hidden bg-drawer-room px-4 py-6 md:px-10">
      {open && open.kind === 'card' && (
        <div aria-hidden="true" className="w-full max-w-narrow -rotate-1 rounded-sm bg-drawer-paper px-4 py-3 text-drawer-ink shadow-3 md:px-5 md:py-4">
          <div className="flex justify-between gap-4 border-b-2 border-drawer-rule pb-1.5 text-xs font-semibold">
            <span>{open.cn}</span>
            <span className="font-normal">{open.date}</span>
          </div>
          <p className="mt-2 truncate text-base font-medium">{open.title}</p>
          <p className="mt-1 line-clamp-3 text-sm">{open.text}</p>
          <p className="mt-2 truncate text-xs opacity-70">{open.src}</p>
        </div>
      )}
      <div aria-hidden="true" className="w-full max-w-column">
        <div className="flex h-20 items-end gap-px rounded-t-sm bg-drawer-oak px-2 pt-6 md:h-28">
          {edges.map((it, i) =>
            it.kind === 'divider' ? (
              <div key={it.key} className="relative z-10 h-full min-w-0 flex-1">
                <span className="absolute -top-5 left-0 whitespace-nowrap rounded-t-sm bg-drawer-manila px-1.5 text-xs font-semibold text-drawer-ink">
                  {it.label}
                </span>
                <span className="block h-full rounded-t-sm bg-drawer-manila" />
              </div>
            ) : (
              <div key={it.key} className={clsx('relative min-w-0 flex-1', flags.has(i) || i === openIndex ? 'h-full' : 'h-4/5')}>
                {flags.has(i) && <span className="absolute -top-2 right-0 h-2 w-full rounded-t-sm bg-flag" />}
                <span className={clsx('block h-full rounded-t-sm', flags.has(i) || i === openIndex ? 'bg-drawer-paper' : 'bg-drawer-paper-dim')} />
              </div>
            ),
          )}
        </div>
        <div className="flex h-12 items-center justify-center rounded-b-sm border-t-2 border-drawer-room bg-drawer-oak">
          <span className="rounded-sm bg-drawer-paper px-3 py-0.5 text-xs font-semibold text-drawer-ink">2026 A–Z</span>
        </div>
      </div>
    </div>
  );
}
