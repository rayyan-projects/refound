import { lazy, Suspense, useCallback, useState } from 'react';
import clsx from 'clsx';
import { StaticDrawer } from './StaticDrawer';
import type { DrawerProps } from './drawerTypes';
import { canRun3D } from './webgl';

// three.js lives only in this chunk; nothing loads it without WebGL2.
const CardDrawer3D = lazy(() => import('./CardDrawer3D'));

/** The card-catalogue drawer: 3D when the browser can, otherwise the designed still. Never blank. */
export function CardDrawer({ className, ...props }: DrawerProps & { className?: string }) {
  const [failed, setFailed] = useState(false);
  const onFail = useCallback(() => setFailed(true), []);
  const use3D = !failed && canRun3D();
  const still = <StaticDrawer items={props.items} flagged={props.flagged} focus={props.focus} label={props.label} />;
  return (
    <div data-drawer={use3D ? '3d' : 'static'} className={clsx('relative overflow-hidden rounded bg-drawer-room', className)}>
      {use3D ? (
        <Suspense fallback={still}>
          <CardDrawer3D {...props} onFail={onFail} />
        </Suspense>
      ) : (
        still
      )}
    </div>
  );
}
