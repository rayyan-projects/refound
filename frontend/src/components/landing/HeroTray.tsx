import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { prefersReducedMotion } from '../../lib/spring';
import { OUT, SIM, VS } from './trayShaders';

export interface HeroTrayProps {
  heroRef: RefObject<HTMLElement | null>;
  onMode: (m: 'static' | 'gl') => void;
  onDeveloped: (d: boolean) => void;
}

interface Prog {
  p: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}

const SW = 384;
const SH = 224;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function webgl2(cv: HTMLCanvasElement): WebGL2RenderingContext | null {
  try {
    return cv.getContext('webgl2', { antialias: false, premultipliedAlpha: false });
  } catch {
    return null;
  }
}

/**
 * The Latent Image tray (ported from the direction 2 prototype): a WebGL2 print that develops under the pointer.
 * The real h1 and DOM text stay in place (transparent while GL paints them). Without WebGL2, on a lost context or
 * under reduced motion the hero stays a fully developed static print.
 */
export function HeroTray({ heroRef, onMode, onDeveloped }: HeroTrayProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    const host = hostRef.current;
    if (!hero || !host || prefersReducedMotion()) return;

    // Each mount makes its own canvas so a StrictMode remount never reuses a lost context.
    const cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    cv.className = 'absolute inset-0 block h-full w-full';
    const gl = webgl2(cv);
    if (!gl) return;
    const g = gl;

    const compile = (vs: string, fs: string): Prog | null => {
      const sh = (type: number, src: string) => {
        const s = g.createShader(type);
        if (!s) return null;
        g.shaderSource(s, src);
        g.compileShader(s);
        return g.getShaderParameter(s, g.COMPILE_STATUS) ? s : null;
      };
      const v = sh(g.VERTEX_SHADER, vs);
      const f = sh(g.FRAGMENT_SHADER, fs);
      const p = g.createProgram();
      if (!v || !f || !p) return null;
      g.attachShader(p, v);
      g.attachShader(p, f);
      g.linkProgram(p);
      if (!g.getProgramParameter(p, g.LINK_STATUS)) return null;
      const u: Prog['u'] = {};
      const n = g.getProgramParameter(p, g.ACTIVE_UNIFORMS) as number;
      for (let i = 0; i < n; i++) {
        const a = g.getActiveUniform(p, i);
        if (a) u[a.name] = g.getUniformLocation(p, a.name);
      }
      return { p, u };
    };
    const sim = compile(VS, SIM);
    const out = compile(VS, OUT);
    if (!sim || !out) return;

    host.appendChild(cv);
    const DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    const half = g.getExtension('EXT_color_buffer_float');
    const buf = g.createBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, buf);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
    const quad = (P: Prog) => {
      const l = g.getAttribLocation(P.p, 'a');
      g.enableVertexAttribArray(l);
      g.vertexAttribPointer(l, 2, g.FLOAT, false, 0, 0);
    };
    const params = () => {
      [g.TEXTURE_MIN_FILTER, g.TEXTURE_MAG_FILTER].forEach((p) => g.texParameteri(g.TEXTURE_2D, p, g.LINEAR));
      [g.TEXTURE_WRAP_S, g.TEXTURE_WRAP_T].forEach((p) => g.texParameteri(g.TEXTURE_2D, p, g.CLAMP_TO_EDGE));
    };
    const tex: WebGLTexture[] = [];
    const fbo: WebGLFramebuffer[] = [];
    for (let i = 0; i < 2; i++) {
      const t = g.createTexture()!;
      g.bindTexture(g.TEXTURE_2D, t);
      // half floats let development run past 1 so the print can burn; RGBA8 still develops
      if (half) g.texImage2D(g.TEXTURE_2D, 0, g.RGBA16F, SW, SH, 0, g.RGBA, g.HALF_FLOAT, null);
      else g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, SW, SH, 0, g.RGBA, g.UNSIGNED_BYTE, null);
      params();
      const f = g.createFramebuffer()!;
      g.bindFramebuffer(g.FRAMEBUFFER, f);
      g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, t, 0);
      tex.push(t);
      fbo.push(f);
    }
    const textTex = g.createTexture();
    g.pixelStorei(g.UNPACK_ALIGNMENT, 1);

    const devEls = Array.from(hero.querySelectorAll<HTMLElement>('.dev'));
    // Paint every word where the browser laid it out.
    function paintText() {
      if (!hero) return;
      const r = hero.getBoundingClientRect();
      const s = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.max(2, Math.round(r.width * s));
      const H = Math.max(2, Math.round(r.height * s));
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      const x = c.getContext('2d');
      if (!x) return;
      x.fillStyle = 'black';
      x.fillRect(0, 0, W, H);
      x.fillStyle = 'white';
      x.textBaseline = 'alphabetic';
      devEls.forEach((el) => {
        const cs = getComputedStyle(el);
        x.font = `${cs.fontWeight} ${parseFloat(cs.fontSize) * s}px ${cs.fontFamily}`;
        if ('letterSpacing' in x) (x as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${(parseFloat(cs.letterSpacing) || 0) * s}px`;
        const m = x.measureText('Hg');
        const asc = m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent;
        const des = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent;
        el.querySelectorAll<HTMLElement>('.w').forEach((sp) => {
          const b = sp.getBoundingClientRect();
          x.fillText(sp.textContent ?? '', (b.left - r.left) * s, (b.top - r.top) * s + (b.height * s - (asc + des)) / 2 + asc);
        });
      });
      const d = x.getImageData(0, 0, W, H).data;
      const a = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) a[i] = d[i * 4];
      g.bindTexture(g.TEXTURE_2D, textTex);
      g.texImage2D(g.TEXTURE_2D, 0, g.R8, W, H, 0, g.RED, g.UNSIGNED_BYTE, a);
      params();
    }

    const P = { x: 0.5, y: 0.5, on: 0, down: 0, px: 0.5, py: 0.5 };
    const onMove = (e: PointerEvent) => {
      const r = hero.getBoundingClientRect();
      P.x = (e.clientX - r.left) / r.width;
      P.y = (e.clientY - r.top) / r.height;
      P.on = 1;
    };
    const onLeave = () => {
      P.on = 0;
      P.down = 0;
    };
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('a,button')) P.down = 1;
    };
    const onUp = () => {
      P.down = 0;
    };
    hero.addEventListener('pointermove', onMove);
    hero.addEventListener('pointerleave', onLeave);
    hero.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);

    let cur = 0;
    let reset = 1;
    const start = performance.now();
    let visible = true;
    let raf = 0;
    let alive = true;
    let shown = false;
    let developed = false;

    function fit() {
      const r = cv.getBoundingClientRect();
      const w = Math.round(r.width * DPR);
      const h = Math.round(r.height * DPR);
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
      }
    }
    function simStep(t: number, st: number) {
      if (!sim || !out) return;
      g.useProgram(sim.p);
      quad(sim);
      g.bindFramebuffer(g.FRAMEBUFFER, fbo[1 - cur]);
      g.viewport(0, 0, SW, SH);
      g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D, tex[cur]);
      g.uniform1i(sim.u.prev, 0);
      // the intro: one zig-zag pass of developer over the whole sheet in about 2.4 s
      const k = clamp(st / 2.4, 0, 1.05);
      g.uniform2f(sim.u.sweep, -0.05 + k * 1.1, 0.5 + 0.48 * Math.sin(st * 12));
      g.uniform1f(sim.u.sweepOn, st < 2.6 ? 1 : 0);
      g.uniform1f(sim.u.prog, clamp(st / 2.6, 0, 1));
      g.uniform2f(sim.u.m, P.x, 1 - P.y);
      g.uniform2f(sim.u.mp, P.px, 1 - P.py);
      g.uniform1f(sim.u.pOn, P.on);
      g.uniform1f(sim.u.press, P.down);
      g.uniform2f(sim.u.res, SW, SH);
      g.uniform1f(sim.u.t, t);
      g.uniform1f(sim.u.reset, reset);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
      cur = 1 - cur;
      reset = 0;
      P.px = P.x;
      P.py = P.y;
    }
    function draw(t: number) {
      if (!out) return;
      fit();
      g.useProgram(out.p);
      quad(out);
      g.bindFramebuffer(g.FRAMEBUFFER, null);
      g.viewport(0, 0, cv.width, cv.height);
      g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D, tex[cur]);
      g.uniform1i(out.u.field, 0);
      g.activeTexture(g.TEXTURE1);
      g.bindTexture(g.TEXTURE_2D, textTex);
      g.uniform1i(out.u.text, 1);
      g.uniform2f(out.u.res, cv.width, cv.height);
      g.uniform1f(out.u.t, t);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
    }
    function frame(now: number) {
      raf = 0;
      if (!alive || !visible) return;
      const t = now / 1000;
      const st = (now - start) / 1000;
      simStep(t, st);
      simStep(t + 0.008, st + 0.008);
      draw(t);
      if (!shown && !g.isContextLost()) {
        shown = true;
        onMode('gl');
        onDeveloped(false);
      }
      if (!developed && st > 2.2) {
        developed = true;
        onDeveloped(true);
      }
      raf = requestAnimationFrame(frame);
    }
    const kick = () => {
      if (!raf && alive && visible) raf = requestAnimationFrame(frame);
    };

    const fallback = () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      onMode('static');
      onDeveloped(true);
    };
    const onLost = (e: Event) => {
      e.preventDefault();
      fallback();
    };
    cv.addEventListener('webglcontextlost', onLost);
    // A software renderer that cannot draw a first frame in time falls back to the static print.
    const watchdog = window.setTimeout(() => {
      if (!shown) fallback();
    }, 4000);

    const io = new IntersectionObserver((e) => {
      visible = e[0]?.isIntersecting ?? true;
      if (visible) kick();
    });
    io.observe(hero);
    const ro = new ResizeObserver(() => paintText());
    ro.observe(hero);
    paintText();
    Promise.all([document.fonts.load('800 80px Syne'), document.fonts.load('400 20px "Familjen Grotesk"'), document.fonts.load('600 20px "Familjen Grotesk"')])
      .catch(() => undefined)
      .then(() => {
        if (alive) paintText();
      });
    kick();

    return () => {
      alive = false;
      window.clearTimeout(watchdog);
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', onLeave);
      hero.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      cv.removeEventListener('webglcontextlost', onLost);
      tex.forEach((t) => g.deleteTexture(t));
      fbo.forEach((f) => g.deleteFramebuffer(f));
      g.deleteTexture(textTex);
      g.deleteBuffer(buf);
      g.deleteProgram(sim.p);
      g.deleteProgram(out.p);
      g.getExtension('WEBGL_lose_context')?.loseContext();
      cv.remove();
      onMode('static');
      onDeveloped(true);
    };
  }, [heroRef, onMode, onDeveloped]);

  return <div ref={hostRef} aria-hidden="true" className="absolute inset-0 -z-10" />;
}
