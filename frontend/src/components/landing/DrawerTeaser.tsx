import { Fragment, useState } from 'react';
import clsx from 'clsx';
import { CardDrawer } from '../drawer/CardDrawer';
import { COPY } from './landingCopy';
import { TEASER_ANSWER, TEASER_CITES, TEASER_ITEMS } from './teaserData';

/** The answer develops word by word, like the hero print. Keyed on each ask so it develops again. */
function DevelopingAnswer({ onCite }: { onCite: (n: number | null) => void }) {
  let k = 0;
  const word = (w: string, key: string) => (
    <span key={key} className="develop-word" style={{ animationDelay: `${k++ * 38}ms` }}>
      {w}
    </span>
  );
  return (
    <p className="text-xl text-ink md:text-example">
      {TEASER_ANSWER.map((run, i) => {
        if (typeof run === 'string')
          return (
            <Fragment key={i}>
              {run.split(/(\s+)/).map((w, j) => (/\s/.test(w) || !w ? w : word(w, `${i}-${j}`)))}
            </Fragment>
          );
        if ('code' in run)
          return (
            <code key={i} className="develop-word rounded-sm bg-hover px-1 font-mono text-md" style={{ animationDelay: `${k++ * 38}ms` }}>
              {run.code}
            </code>
          );
        return (
          <sup
            key={i}
            className="develop-word ml-0.5 cursor-pointer text-xs font-semibold text-accent"
            style={{ animationDelay: `${k++ * 38}ms` }}
            onPointerEnter={() => onCite(run.cite)}
            onPointerLeave={() => onCite(null)}
          >
            {run.cite}
          </sup>
        );
      })}
    </p>
  );
}

export function DrawerTeaser() {
  const [q, setQ] = useState(COPY.askDefault);
  const [run, setRun] = useState(0);
  const [focusRow, setFocusRow] = useState<number | null>(null);
  const focus = focusRow !== null ? TEASER_CITES[focusRow - 1] : null;

  return (
    <section id="ask" aria-labelledby="drawer-h" className="scroll-mt-24 pb-18 pt-30">
      <div className="mx-auto max-w-content px-4 md:px-6 lg:px-10">
        <div className="grid grid-cols-1 items-end gap-8 lg:grid-cols-5 lg:gap-12">
          <h2 id="drawer-h" className="font-display text-section font-extrabold text-ink lg:col-span-3">
            {COPY.drawerH}
          </h2>
          <p className="max-w-prose text-lg text-ink-2 lg:col-span-2">{COPY.drawerBody}</p>
        </div>
        <p className="mt-14 text-xs font-medium text-ink-3">{COPY.exampleLabel}</p>
        <form
          className="mt-2 flex items-center gap-3 border-b border-line pb-4 focus-within:border-ink-3"
          onSubmit={(e) => {
            e.preventDefault();
            setRun((r) => r + 1);
          }}
        >
          <label htmlFor="teaser-q" className="hidden whitespace-nowrap text-sm text-ink-3 sm:block">
            {COPY.askButton}
          </label>
          <input
            id="teaser-q"
            value={q}
            spellCheck={false}
            onChange={(e) => setQ(e.target.value)}
            className="min-w-0 flex-1 bg-transparent py-2 text-title font-medium tracking-tight text-ink focus-visible:outline-offset-4 md:text-page"
          />
          <button type="submit" className="inline-flex h-11 items-center rounded-full bg-btn px-5 text-md font-medium text-on-btn transition-colors duration-base ease-out hover:bg-btn-hover">
            {COPY.askButton}
          </button>
        </form>
        <div className="mt-8 grid grid-cols-1 items-start gap-12 lg:grid-cols-8">
          <div className="lg:col-span-5">
            <CardDrawer
              replay={run}
              items={TEASER_ITEMS}
              flagged={TEASER_CITES}
              focus={focus}
              label="An example card catalogue drawer. The cards that answer the question are pulled up and flagged."
              className="aspect-drawer-sm sm:aspect-drawer-md lg:aspect-drawer"
            />
            <div className="mt-3.5 flex flex-wrap justify-between gap-x-6 gap-y-2 text-sm text-ink-3">
              <span>{COPY.drawerHint}</span>
              <span>{COPY.drawerCaption}</span>
            </div>
          </div>
          <div className="grid min-w-0 gap-5 pt-2 lg:col-span-3" aria-live="polite">
            <p className="text-sm text-ink-3">{COPY.answerMeta}</p>
            <DevelopingAnswer key={run} onCite={setFocusRow} />
            <ol className="border-t border-line">
              {TEASER_CITES.map((idx, i) => {
                const it = TEASER_ITEMS[idx];
                if (it.kind !== 'card') return null;
                return (
                  <li key={idx} className="border-b border-line">
                    <button
                      type="button"
                      onPointerEnter={() => setFocusRow(i + 1)}
                      onPointerLeave={() => setFocusRow(null)}
                      onFocus={() => setFocusRow(i + 1)}
                      onBlur={() => setFocusRow(null)}
                      className={clsx('grid min-h-11 w-full grid-cols-source items-baseline gap-3 py-3 text-left', focusRow === i + 1 ? 'text-ink' : 'text-ink')}
                    >
                      <span className="text-sm font-semibold text-accent">{i + 1}</span>
                      <span className="truncate font-medium">{it.title}</span>
                      <span className="text-sm text-ink-3">{it.cn}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
