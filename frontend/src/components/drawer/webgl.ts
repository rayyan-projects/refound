import { prefersReducedMotion } from '../../lib/spring';

let cached: boolean | null = null;

/** WebGL2 is available (probed once, on a throwaway canvas whose context is released straight away). */
export function hasWebGL2(): boolean {
  if (cached !== null) return cached;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    cached = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}

/** The 3D drawer runs only with WebGL2 and without a reduced-motion preference. */
export function canRun3D(): boolean {
  return !prefersReducedMotion() && hasWebGL2();
}
