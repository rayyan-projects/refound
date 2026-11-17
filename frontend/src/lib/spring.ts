/** A critically-damped-ish spring driven by requestAnimationFrame (ported from the direction 2 prototype).
 *  `set(target)` animates toward the target; `snap(target)` jumps. Under reduced motion every set snaps. */
export interface Spring {
  set(target: number): void;
  snap(target: number): void;
  stop(): void;
  value(): number;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function spring(apply: (x: number) => void, k = 420, d = 26, initial = 0): Spring {
  let x = initial;
  let v = 0;
  let target = initial;
  let raf = 0;
  let last = 0;
  const tick = (now: number) => {
    const dt = Math.min(0.033, last ? (now - last) / 1000 : 0.016);
    last = now;
    v += (k * (target - x) - d * v) * dt;
    x += v * dt;
    apply(x);
    if (Math.abs(target - x) > 1e-3 || Math.abs(v) > 1e-3) raf = requestAnimationFrame(tick);
    else {
      x = target;
      v = 0;
      apply(x);
      raf = 0;
      last = 0;
    }
  };
  return {
    set(t) {
      target = t;
      if (prefersReducedMotion()) {
        this.snap(t);
        return;
      }
      if (!raf) raf = requestAnimationFrame(tick);
    },
    snap(t) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      target = t;
      x = t;
      v = 0;
      apply(x);
    },
    stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
    value: () => x,
  };
}
