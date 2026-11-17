import { COPY } from './landingCopy';

export function DrawerTeaser() {
  return (
    <section id="ask" aria-labelledby="drawer-h" className="scroll-mt-24 pb-18 pt-30">
      <div className="mx-auto max-w-content px-4 md:px-6 lg:px-10">
        <div className="grid grid-cols-1 items-end gap-8 lg:grid-cols-5 lg:gap-12">
          <h2 id="drawer-h" className="font-display text-section font-extrabold text-ink lg:col-span-3">
            {COPY.drawerH}
          </h2>
          <p className="max-w-prose text-lg text-ink-2 lg:col-span-2">{COPY.drawerBody}</p>
        </div>
      </div>
    </section>
  );
}
