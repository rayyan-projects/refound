import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { COPY } from '../components/landing/landingCopy';
import { HeroTray } from '../components/landing/HeroTray';
import { DrawerTeaser } from '../components/landing/DrawerTeaser';
import { Words } from '../components/landing/Words';
import { prefersReducedMotion } from '../lib/spring';

const solid =
  'inline-flex h-12 items-center rounded-full px-6 text-md font-medium transition-colors duration-base ease-out';

export default function Landing() {
  useDocumentTitle('ReFound');
  const heroRef = useRef<HTMLElement>(null);
  // 'static' = fully developed print (no WebGL, lost context, or reduced motion); 'gl' = painted by WebGL.
  const [mode, setMode] = useState<'static' | 'gl'>('static');
  const [developed, setDeveloped] = useState(true);
  const gl = mode === 'gl';

  // Lenis smooth scrolling, on the landing page only (never under reduced motion).
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let stopped = false;
    let raf = 0;
    let destroy = () => undefined as void;
    void import('lenis').then(({ default: Lenis }) => {
      if (stopped) return;
      const lenis = new Lenis({ lerp: 0.1 });
      const loop = (t: number) => {
        lenis.raf(t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      const anchors = (e: MouseEvent) => {
        const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('main a[href^="#"]');
        const el = a ? document.querySelector(a.getAttribute('href') ?? '') : null;
        if (!a || !el) return;
        e.preventDefault();
        lenis.scrollTo(el as HTMLElement, { offset: -96 });
      };
      document.addEventListener('click', anchors);
      destroy = () => {
        document.removeEventListener('click', anchors);
        lenis.destroy();
      };
    });
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      destroy();
    };
  }, []);

  return (
    <main id="main" tabIndex={-1} className="focus:outline-none" data-landing="">
      <section
        ref={heroRef}
        aria-labelledby="hero-h"
        data-hero-mode={mode}
        data-developed={developed ? 'true' : 'false'}
        className={clsx(
          'relative isolate grid min-h-hero overflow-hidden',
          gl ? 'bg-tray' : 'print-static',
          gl && 'hero-gl',
        )}
      >
        <HeroTray
          heroRef={heroRef}
          onMode={setMode}
          onDeveloped={setDeveloped}
        />
        <div className="relative z-10 mx-auto grid w-full max-w-content grid-cols-1 items-center gap-12 px-4 pb-24 pt-12 md:px-6 lg:grid-cols-12 lg:gap-16 lg:px-10 lg:pb-24 lg:pt-16">
          <div className="lg:col-span-7">
            <nav aria-label="On this page" className="mb-8 flex gap-6 text-sm text-print-ink-2">
              <a href="#how" className="inline-flex h-11 items-center underline-offset-4 hover:text-print-ink hover:underline">
                {COPY.navHow}
              </a>
              <a href="#data" className="inline-flex h-11 items-center underline-offset-4 hover:text-print-ink hover:underline">
                {COPY.navData}
              </a>
            </nav>
            <h1 id="hero-h" tabIndex={-1} className="dev max-w-hero font-display text-hero font-extrabold text-print-ink focus:outline-none">
              <Words text={COPY.h1} />
            </h1>
            <div className={clsx('reveal', gl && !developed && 'reveal-hidden')}>
              <p className="mt-7 max-w-sub text-lg text-print-ink md:text-xl">{COPY.sub}</p>
              <div className="mt-9 flex flex-wrap items-center gap-5">
                <Link to="/ask" className={clsx(solid, 'bg-print-ink text-print hover:bg-print-ink-2')}>
                  {COPY.open}
                </Link>
                <a href="#ask" className="inline-flex h-12 items-center px-1.5 text-md font-medium text-print-ink">
                  <span className="border-b border-current pb-0.5">{COPY.seeIt}</span>
                </a>
              </div>
            </div>
          </div>
          <figure className="grid max-w-example gap-3.5 lg:col-span-5 lg:justify-self-end">
            <figcaption className="text-xs font-medium text-print-ink-2">{COPY.exampleLabel}</figcaption>
            <p className="dev text-md font-semibold text-print-ink">
              <Words text={COPY.exampleQ} />
            </p>
            <p className="dev text-xl tracking-tight text-print-ink md:text-example">
              <Words text={COPY.exampleA} />
            </p>
            <p className="dev text-sm font-medium text-print-ink">
              <Words text={COPY.exampleSrc} />
            </p>
          </figure>
        </div>
        <p className="absolute inset-x-0 bottom-5 z-10 mx-auto max-w-content px-4 text-sm text-print-ink md:px-6 lg:px-10">{COPY.hint}</p>
      </section>

      <DrawerTeaser />

      <section id="how" aria-labelledby="how-h" className="scroll-mt-24 py-24">
        <div className="mx-auto max-w-content px-4 md:px-6 lg:px-10">
          <h2 id="how-h" className="font-display text-section font-extrabold text-ink">
            {COPY.howH}
          </h2>
          <ol className="mt-12 border-t border-line">
            {COPY.steps.map((s, i) => (
              <li key={s.title} className="grid grid-cols-step gap-x-4 gap-y-2 border-b border-line py-7 md:grid-cols-step-md md:gap-6">
                <span className="font-display text-lg font-bold text-ink-3">{i + 1}</span>
                <h3 className="text-title font-semibold tracking-tight text-ink">{s.title}</h3>
                <p className="max-w-prose text-md text-ink-2 max-md:col-start-2">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="data" aria-labelledby="data-h" className="scroll-mt-24 pb-30 pt-24">
        <div className="mx-auto grid max-w-content grid-cols-1 items-start gap-6 px-4 md:px-6 lg:grid-cols-2 lg:gap-12 lg:px-10">
          <h2 id="data-h" className="font-display text-section font-extrabold text-ink">
            {COPY.dataH}
          </h2>
          <p className="max-w-data text-lg text-ink-2 md:text-xl">
            <b className="font-medium text-ink">{COPY.dataLead}</b>
            {COPY.dataRest}
          </p>
        </div>
      </section>

      <footer className="border-t border-line pb-14 pt-9 text-sm text-ink-3">
        <div className="mx-auto flex max-w-content flex-wrap justify-between gap-4 px-4 md:px-6 lg:px-10">
          <span>{COPY.footer}</span>
          <span>{COPY.footerSmall}</span>
        </div>
      </footer>
    </main>
  );
}
