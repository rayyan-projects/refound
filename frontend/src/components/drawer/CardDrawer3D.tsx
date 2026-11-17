import { useEffect, useRef } from 'react';
import {
  ACESFilmicToneMapping,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  ExtrudeGeometry,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Path,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Raycaster,
  RepeatWrapping,
  Scene,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  SpotLight,
  SRGBColorSpace,
  Texture,
  TorusGeometry,
  Vector2,
  WebGLRenderer,
} from 'three';
import type { Material, Object3D } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { prefersReducedMotion } from '../../lib/spring';
import { DRAWER } from './drawerPalette';
import type { DrawerItem, DrawerProps } from './drawerTypes';

interface Card {
  g: Group;
  body: Mesh;
  face: Mesh;
  flag: Mesh;
  isDiv: boolean;
  i: number;
  rot: number;
  vr: number;
  lift: number;
  vl: number;
  flagS: number;
  jitter: number;
  match: boolean;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function webgl2(canvas: HTMLCanvasElement): WebGL2RenderingContext | null {
  try {
    return canvas.getContext('webgl2', { antialias: true });
  } catch {
    return null;
  }
}
const W = 1.25;
const H = 0.75;
const T = 0.0055;
const GAP = 0.052;
const ROD_Y = 0.09;
const HOLE_Y = 0.06;
const TABS: [number, number][] = [
  [-0.58, -0.3],
  [-0.28, 0],
  [0.02, 0.3],
  [0.32, 0.6],
];

/**
 * A real card-catalogue drawer (three.js r170), ported from the direction 2 prototype: oak tray, brass rod, cards
 * with thickness and a rod hole, divider cards with tabs, a desk lamp. It renders only while something moves.
 * `onFail` fires when WebGL2 is unavailable or the context is lost, so the caller can show the static drawer.
 */
export default function CardDrawer3D({ items, flagged, focus, riffle = false, replay = 0, label, lowRes = false, onPull, onFail }: DrawerProps & { onFail: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const api = useRef<{ update: (p: { flagged: number[]; focus: number | null; riffle: boolean; replay: number }) => void } | null>(null);
  const live = useRef({ flagged, focus, riffle, replay, onPull });
  useEffect(() => {
    live.current = { flagged, focus, riffle, replay, onPull };
  });

  // Build the scene for this deck. Rebuilt (and fully disposed) when the deck changes.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const RM = prefersReducedMotion();
    const canvas = document.createElement('canvas');
    canvas.className = 'absolute inset-0 block h-full w-full';
    const ctx = webgl2(canvas);
    if (!ctx) {
      onFail();
      return;
    }
    host.appendChild(canvas);

    let alive = true;
    const renderer = new WebGLRenderer({ canvas, context: ctx, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowRes ? 1.25 : 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = SRGBColorSpace;
    const scene = new Scene();
    scene.background = new Color(DRAWER.room);
    scene.fog = new Fog(DRAWER.room, 3.2, 6.5 + items.length * 0.02);
    const pmrem = new PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const envTarget = pmrem.fromScene(room, 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.28;
    const camera = new PerspectiveCamera(30, 1, 0.05, 30);
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const textures: Texture[] = [];
    const repaints: (() => void)[] = [];

    // a desk lamp: one warm key with soft shadows, a cool rim from behind, a dim bounce
    const key = new SpotLight(DRAWER.key, 38, 0, 0.62, 0.75, 2);
    key.position.set(-1.25, 2.55, 1.05);
    key.target.position.set(0.05, 0.2, -0.75);
    key.castShadow = true;
    key.shadow.mapSize.set(lowRes ? 1024 : 1536, lowRes ? 1024 : 1536);
    key.shadow.bias = -0.0002;
    key.shadow.normalBias = 0.012;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 6;
    scene.add(key, key.target);
    const rim = new DirectionalLight(DRAWER.rim, 0.35);
    rim.position.set(1.6, 1.4, -3);
    scene.add(rim);
    scene.add(new HemisphereLight(DRAWER.hemiSky, DRAWER.hemiGround, 0.18));

    // procedural textures: no image files, everything is drawn here
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const canvasTex = (w: number, h: number, draw: (x: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true, text = false) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const x = c.getContext('2d');
      if (x) draw(x, w, h);
      const t = new CanvasTexture(c);
      // Text drawn before the web font loads falls back to a system face: repaint it once the font is in.
      if (text && x)
        repaints.push(() => {
          x.clearRect(0, 0, w, h);
          draw(x, w, h);
          t.needsUpdate = true;
        });
      if (srgb) t.colorSpace = SRGBColorSpace;
      t.anisotropy = maxAniso;
      textures.push(t);
      return t;
    };
    const wood = (x: CanvasRenderingContext2D, w: number, h: number, base: string, dark: string, rings: number) => {
      x.fillStyle = base;
      x.fillRect(0, 0, w, h);
      for (let i = 0; i < rings; i++) {
        const y = rnd() * h;
        const a = 0.05 + rnd() * 0.12;
        const amp = 2 + rnd() * 10;
        const f = 0.002 + rnd() * 0.006;
        const ph = rnd() * 9;
        x.strokeStyle = DRAWER.grain(dark, a);
        x.lineWidth = 0.6 + rnd() * 2.4;
        x.beginPath();
        for (let X = 0; X <= w; X += 8) {
          const Y = y + Math.sin(X * f + ph) * amp + Math.sin(X * f * 3.1 + ph) * amp * 0.25;
          if (X) x.lineTo(X, Y);
          else x.moveTo(X, Y);
        }
        x.stroke();
      }
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, DRAWER.shadeTop);
      g.addColorStop(1, DRAWER.shadeBottom);
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
    };
    const oak = canvasTex(1024, 256, (x, w, h) => wood(x, w, h, DRAWER.oak, DRAWER.oakGrain, 110));
    oak.wrapS = oak.wrapT = RepeatWrapping;
    const walnut = canvasTex(1024, 1024, (x, w, h) => wood(x, w, h, DRAWER.walnut, '0,0,0', 220));
    walnut.wrapS = walnut.wrapT = RepeatWrapping;
    walnut.repeat.set(3, 3);
    const fibre = canvasTex(
      512,
      512,
      (x, w, h) => {
        const d = x.createImageData(w, h);
        for (let i = 0; i < w * h; i++) {
          const v = 128 + (rnd() - 0.5) * 46;
          d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v;
          d.data[i * 4 + 3] = 255;
        }
        x.putImageData(d, 0, 0);
        x.globalAlpha = 0.18;
        for (let i = 0; i < 900; i++) {
          x.strokeStyle = rnd() > 0.5 ? 'white' : 'black';
          x.lineWidth = 0.6;
          x.beginPath();
          const X = rnd() * w;
          const Y = rnd() * h;
          const a = rnd() * 6.28;
          const l = 4 + rnd() * 14;
          x.moveTo(X, Y);
          x.quadraticCurveTo(X + Math.cos(a + 1) * l * 0.5, Y + Math.sin(a + 1) * l * 0.5, X + Math.cos(a) * l, Y + Math.sin(a) * l);
          x.stroke();
        }
      },
      false,
    );
    fibre.wrapS = fibre.wrapT = RepeatWrapping;

    // desk and drawer
    const N = Math.max(1, items.length);
    const L = N * GAP + 0.22;
    const desk = new Mesh(new PlaneGeometry(10, 10), new MeshStandardMaterial({ map: walnut, roughness: 0.62, bumpMap: walnut, bumpScale: 0.4 }));
    desk.rotation.x = -Math.PI / 2;
    desk.receiveShadow = true;
    scene.add(desk);
    const tray = new Group();
    scene.add(tray);
    const oakMat = (rx: number, ry: number) => {
      const t = oak.clone();
      textures.push(t);
      t.needsUpdate = true;
      t.repeat.set(rx, ry);
      return new MeshStandardMaterial({ map: t, roughness: 0.55, bumpMap: t, bumpScale: 0.3, color: DRAWER.oakTint });
    };
    const box = (w: number, h: number, d: number, mat: Material, x: number, y: number, z: number) => {
      const m = new Mesh(new BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true;
      tray.add(m);
      return m;
    };
    const wall = 0.045;
    const IW = W + 0.07;
    const WH = 0.4;
    const zFront = 0.14;
    const zBack = -L + 0.08;
    const zMid = (zFront + zBack) / 2;
    box(IW + wall * 2, 0.03, L + 0.08, oakMat(1.4, 1), 0, 0.015, zMid);
    box(wall, WH, L + 0.08, oakMat(2, 0.5), -(IW / 2 + wall / 2), WH / 2, zMid);
    box(wall, WH, L + 0.08, oakMat(2, 0.5), IW / 2 + wall / 2, WH / 2, zMid);
    box(IW + wall * 2, WH, wall, oakMat(1.2, 0.5), 0, WH / 2, zBack - 0.02);
    box(IW + wall * 2 + 0.02, WH + 0.06, 0.06, oakMat(1.2, 0.5), 0, (WH + 0.06) / 2, zFront + 0.05);
    const brass = new MeshStandardMaterial({ color: DRAWER.brass, metalness: 1, roughness: 0.28 });
    const holder = new Mesh(new BoxGeometry(0.34, 0.12, 0.008), brass);
    holder.position.set(0, 0.3, zFront + 0.084);
    holder.castShadow = true;
    tray.add(holder);
    const labelTex = canvasTex(512, 146, (x, w, h) => {
      x.fillStyle = DRAWER.labelPaper;
      x.fillRect(0, 0, w, h);
      x.fillStyle = DRAWER.labelInk;
      x.font = '600 58px "Familjen Grotesk"';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText('2026  A–Z', w / 2, h / 2 + 4);
    }, true, true);
    const plate = new Mesh(new PlaneGeometry(0.3, 0.085), new MeshStandardMaterial({ roughness: 0.9, map: labelTex }));
    plate.position.set(0, 0.3, zFront + 0.0885);
    tray.add(plate);
    const pull = new Mesh(new TorusGeometry(0.055, 0.009, 16, 48, Math.PI), brass);
    pull.rotation.z = Math.PI;
    pull.position.set(0, 0.17, zFront + 0.09);
    pull.castShadow = true;
    tray.add(pull);
    const rod = new Mesh(new CylinderGeometry(0.011, 0.011, L + 0.2, 24), brass);
    rod.rotation.x = Math.PI / 2;
    rod.position.set(0, ROD_Y, zMid + 0.05);
    rod.castShadow = true;
    tray.add(rod);
    const knob = new Mesh(new SphereGeometry(0.022, 24, 16), brass);
    knob.position.set(0, ROD_Y, zFront + 0.1);
    tray.add(knob);

    // cards: real thickness, rounded corners and the rod hole
    function cardShape(h: number, tab: [number, number] | null) {
      const s = new Shape();
      const r = 0.018;
      const x0 = -W / 2;
      const x1 = W / 2;
      s.moveTo(x0 + r, 0);
      s.lineTo(x1 - r, 0);
      s.quadraticCurveTo(x1, 0, x1, r);
      s.lineTo(x1, h - r);
      s.quadraticCurveTo(x1, h, x1 - r, h);
      if (tab) {
        const [a, b] = tab;
        const th = 0.085;
        s.lineTo(b + 0.012, h);
        s.quadraticCurveTo(b, h, b, h + 0.012);
        s.lineTo(b, h + th - 0.012);
        s.quadraticCurveTo(b, h + th, b - 0.012, h + th);
        s.lineTo(a + 0.012, h + th);
        s.quadraticCurveTo(a, h + th, a, h + th - 0.012);
        s.lineTo(a, h + 0.012);
        s.quadraticCurveTo(a, h, a - 0.012, h);
      }
      s.lineTo(x0 + r, h);
      s.quadraticCurveTo(x0, h, x0, h - r);
      s.lineTo(x0, r);
      s.quadraticCurveTo(x0, 0, x0 + r, 0);
      const hole = new Path();
      hole.absarc(0, HOLE_Y, 0.019, 0, Math.PI * 2, true);
      s.holes.push(hole);
      return s;
    }
    const edgeMat = new MeshStandardMaterial({ color: DRAWER.edge, roughness: 0.95 });
    const manilaEdge = new MeshStandardMaterial({ color: DRAWER.manilaEdge, roughness: 0.9 });
    const flagMat = new MeshStandardMaterial({ color: DRAWER.flag, roughness: 0.6 });
    const flagGeo = new BoxGeometry(0.07, 0.06, 0.012);
    function wrapText(x: CanvasRenderingContext2D, text: string, maxW: number, lh: number, maxLines: number) {
      const words = text.split(' ');
      let line = '';
      let y = 0;
      let n = 0;
      for (const w of words) {
        const t = line ? `${line} ${w}` : w;
        if (x.measureText(t).width > maxW && line) {
          x.fillText(line, 0, y);
          line = w;
          y += lh;
          if (++n >= maxLines - 1) {
            const rest = line;
            line = rest;
            // ellipsis on the last line
            while (x.measureText(`${line}…`).width > maxW && line.length > 1) line = line.slice(0, -1);
            line += '…';
            break;
          }
        } else line = t;
      }
      x.fillText(line, 0, y);
    }
    const PX = lowRes ? 560 : 900;
    function faceTexture(it: DrawerItem, h: number, tab: [number, number] | null) {
      const w = Math.round(W * PX);
      const ht = Math.round((h + (tab ? 0.085 : 0)) * PX);
      const k = PX / 900;
      return canvasTex(w, ht, (x) => {
        x.fillStyle = tab ? DRAWER.dividerPaper : DRAWER.cardPaper;
        x.fillRect(0, 0, w, ht);
        const g = x.createRadialGradient(w / 2, ht * 0.55, ht * 0.2, w / 2, ht * 0.55, w * 0.7);
        g.addColorStop(0, DRAWER.clear);
        g.addColorStop(1, tab ? DRAWER.dividerEdge : DRAWER.cardEdge);
        x.fillStyle = g;
        x.fillRect(0, 0, w, ht);
        x.globalAlpha = 0.05;
        x.fillStyle = DRAWER.fleck;
        for (let i = 0; i < 1800 * k; i++) x.fillRect(rnd() * w, rnd() * ht, 1.4, 1.4);
        x.globalAlpha = 1;
        if (it.kind === 'divider' && tab) {
          x.fillStyle = DRAWER.ink;
          x.font = `600 ${46 * k}px "Familjen Grotesk"`;
          x.textBaseline = 'middle';
          x.fillText(it.label, (tab[0] + W / 2) * PX + 28 * k, 0.085 * PX * 0.55);
          return;
        }
        if (it.kind !== 'card') return;
        const pad = 54 * k;
        x.fillStyle = DRAWER.headRule;
        x.fillRect(pad * 0.6, 108 * k, w - pad * 1.2, 3 * k);
        x.fillStyle = DRAWER.ruling;
        for (let y = 200 * k; y < ht - 110 * k; y += 52 * k) x.fillRect(pad * 0.6, y, w - pad * 1.2, 2 * k);
        x.fillStyle = DRAWER.ink;
        x.textBaseline = 'alphabetic';
        x.font = `600 ${34 * k}px "Familjen Grotesk"`;
        x.fillText(it.cn, pad, 82 * k);
        x.font = `400 ${30 * k}px "Familjen Grotesk"`;
        x.fillStyle = DRAWER.ink2;
        x.textAlign = 'right';
        x.fillText(it.date, w - pad, 82 * k);
        x.textAlign = 'left';
        x.fillStyle = DRAWER.title;
        x.font = `500 ${48 * k}px "Familjen Grotesk"`;
        x.save();
        x.translate(pad, 178 * k);
        wrapText(x, it.title, w - pad * 2, 52 * k, 1);
        x.restore();
        x.fillStyle = it.failed ? DRAWER.failed : DRAWER.body;
        x.font = `400 ${33 * k}px "Familjen Grotesk"`;
        x.save();
        x.translate(pad, 244 * k);
        wrapText(x, it.text, w - pad * 2, 52 * k, 4);
        x.restore();
        x.fillStyle = DRAWER.source;
        x.font = `400 ${26 * k}px "Familjen Grotesk"`;
        x.fillText(it.src, pad, ht - 46 * k);
      }, true, true);
    }

    let divN = 0;
    const cards: Card[] = items.map((it, i) => {
      const isDiv = it.kind === 'divider';
      const h = isDiv ? 0.7 : H;
      const tab = isDiv ? TABS[divN++ % 4] : null;
      const totalH = h + (tab ? 0.085 : 0);
      const shape = cardShape(h, tab);
      const body = new Mesh(
        new ExtrudeGeometry(shape, { depth: T, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0012, bevelSegments: 1, curveSegments: 10 }),
        isDiv ? manilaEdge : edgeMat,
      );
      body.geometry.translate(0, -HOLE_Y, -T / 2);
      const map = faceTexture(it, h, tab);
      map.repeat.set(1 / W, 1 / totalH);
      map.offset.set(0.5, 0);
      const bump = fibre.clone();
      textures.push(bump);
      bump.needsUpdate = true;
      bump.repeat.set(1.6 / W, 1 / totalH);
      const face = new Mesh(
        new ShapeGeometry(shape, 10),
        new MeshPhysicalMaterial({
          map,
          roughness: 0.88,
          sheen: 0.5,
          sheenRoughness: 0.7,
          sheenColor: new Color(DRAWER.sheen),
          bumpMap: bump,
          bumpScale: 0.35,
          polygonOffset: true,
          polygonOffsetFactor: -1,
        }),
      );
      face.geometry.translate(0, -HOLE_Y, T / 2 + 0.0009);
      const flag = new Mesh(flagGeo, flagMat);
      flag.position.set(W / 2 - 0.1, h - HOLE_Y - 0.005, 0);
      flag.scale.setScalar(0.0001);
      flag.castShadow = true;
      const g = new Group();
      g.add(body, face, flag);
      [body, face].forEach((m) => {
        m.castShadow = true;
        m.receiveShadow = true;
        m.userData.i = i;
      });
      g.position.set((rnd() - 0.5) * 0.012, ROD_Y, zFront - 0.1 - i * GAP);
      g.rotation.y = (rnd() - 0.5) * 0.012;
      tray.add(g);
      return { g, body, face, flag, isDiv, i, rot: -0.12, vr: 0, lift: 0, vl: 0, flagS: 0, jitter: (rnd() - 0.5) * 0.03, match: false };
    });

    // interaction
    const ray = new Raycaster();
    const ndc = new Vector2();
    let open = -1;
    let hoverY: number | null = null;
    let pinned = -1;
    let pulled = -1;
    let wave = -1;
    let waveT = 0;
    let riffling = false;
    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      hoverY = (e.clientY - r.top) / r.height;
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      pinned = -1;
      wake();
    };
    const onLeave = () => {
      hoverY = null;
      wake();
    };
    const onClick = () => {
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(cards.flatMap((c) => [c.body, c.face]))[0];
      if (hit) {
        const i = hit.object.userData.i as number;
        pulled = pulled === i ? -1 : i;
        pinned = i;
        live.current.onPull?.(pulled >= 0 ? pulled : null);
      }
      wake();
    };
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);
    host.addEventListener('click', onClick);

    const startWave = () => {
      wave = 0;
      waveT = performance.now();
    };
    let lastFlags = '';
    function apply(p: { flagged: number[]; focus: number | null; riffle: boolean; replay: number }) {
      const set = new Set(p.flagged);
      const sig = `${p.replay}:${p.flagged.join(',')}`;
      cards.forEach((c) => (c.match = !c.isDiv && set.has(c.i)));
      if (sig !== lastFlags) {
        lastFlags = sig;
        pulled = -1;
        if (p.flagged.length) startWave();
      }
      pinned = p.focus ?? -1;
      if (p.focus !== null) hoverY = null;
      riffling = p.riffle;
      if (riffling && wave < 0) startWave();
      wake();
    }

    function resize() {
      const r = host!.getBoundingClientRect();
      if (!r.width || !r.height) return;
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / r.height;
      const narrow = camera.aspect < 1.1;
      camera.fov = narrow ? 44 : 31;
      camera.position.set(narrow ? 0.05 : 0.22, narrow ? 1.75 : 1.62, narrow ? 2.0 : 2.02);
      camera.lookAt(0, narrow ? 0.22 : 0.2, -0.74);
      camera.updateProjectionMatrix();
    }

    const K = 260;
    const D = 22;
    let last = performance.now();
    let visible = true;
    let moving = true;
    const firstMatch = () => cards.findIndex((c) => c.match);
    function step(now: number) {
      let energy = 0;
      const dt = Math.min(0.033, Math.max(0, (now - last) / 1000));
      last = now;
      // where the drawer is open: pointer depth, else a pinned citation, else the top match
      if (hoverY !== null) open = Math.round(clamp((0.86 - hoverY) / 0.66, 0, 1) * (N - 1));
      else if (pinned >= 0) open = pinned;
      else open = firstMatch();
      const waveAt = wave >= 0 ? ((now - waveT) / 1000) * 34 : -99;
      cards.forEach((c) => {
        let target: number;
        if (open < 0) target = -0.13 + c.jitter;
        else if (c.i < open) target = 0.5 + Math.min(0.22, (open - c.i) * 0.02) + c.jitter; // cards in front fall toward you
        else if (c.i === open) target = -0.06;
        else target = -0.18 - Math.min(0.08, (c.i - open) * 0.01) + c.jitter; // the rest lean back
        if (Math.abs(c.i - waveAt) < 1.2) c.vr += 30 * dt; // the riffle
        const shown = c.match && waveAt > c.i;
        const wantLift = c.i === pulled ? 0.34 : shown || (c.match && wave < 0) ? 0.2 : 0;
        const flagOn = shown || (c.match && wave < 0) ? 1 : 0;
        c.vr += (K * (target - c.rot) - D * c.vr) * dt;
        c.rot += c.vr * dt;
        c.vl += (K * (wantLift - c.lift) - D * c.vl) * dt;
        c.lift += c.vl * dt;
        c.flagS += (flagOn - c.flagS) * Math.min(1, dt * 10);
        c.g.rotation.x = c.rot;
        c.g.position.y = ROD_Y + c.lift;
        c.flag.scale.setScalar(Math.max(0.0001, c.flagS));
        energy += Math.abs(c.vr) + Math.abs(c.vl) + Math.abs(target - c.rot) + Math.abs(wantLift - c.lift) + Math.abs(flagOn - c.flagS);
      });
      if (waveAt > N + 4) {
        if (riffling && !RM) startWave();
        else wave = -1;
      }
      moving = wave >= 0 || energy > 0.004;
    }
    // render only while something moves; a settled drawer costs nothing
    let looping = false;
    let raf = 0;
    function frame(now: number) {
      raf = 0;
      if (!alive || !visible) {
        looping = false;
        return;
      }
      step(now);
      if (moving) renderer.render(scene, camera);
      if (moving && !RM) raf = requestAnimationFrame(frame);
      else looping = false;
    }
    function wake() {
      if (!looping && visible && alive) {
        looping = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }
    const io = new IntersectionObserver(
      (e) => {
        visible = e[0]?.isIntersecting ?? true;
        if (visible) wake();
      },
      { rootMargin: '200px' },
    );
    io.observe(host);
    const ro = new ResizeObserver(() => {
      resize();
      if (visible && alive) renderer.render(scene, camera);
    });
    ro.observe(host);
    resize();

    const onLost = (e: Event) => {
      e.preventDefault();
      alive = false;
      onFail();
    };
    canvas.addEventListener('webglcontextlost', onLost);

    api.current = { update: apply };
    apply(live.current);
    // settle so the first frame already shows the drawer open at the answer
    const t0 = performance.now();
    last = t0;
    if (!riffling) {
      for (let i = 1; i <= 150; i++) step(t0 + i * 16 + 1200);
      wave = -1;
    }
    last = performance.now();
    renderer.render(scene, camera);
    host.dataset.drawerReady = 'true';
    // Repaint the card faces once the fonts are in (canvas text drawn before load falls back to a system face).
    Promise.all(['400', '500', '600'].map((w) => document.fonts.load(`${w} 40px "Familjen Grotesk"`)))
      .catch(() => undefined)
      .then(() => {
        if (!alive) return;
        repaints.forEach((r) => r());
        renderer.render(scene, camera);
      });

    return () => {
      alive = false;
      api.current = null;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('click', onClick);
      canvas.removeEventListener('webglcontextlost', onLost);
      scene.traverse((o: Object3D) => {
        const m = o as Mesh;
        if (m.geometry) m.geometry.dispose();
        const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
        mats.forEach((mat) => mat.dispose());
      });
      textures.forEach((t) => t.dispose());
      envTarget.dispose();
      pmrem.dispose();
      room.traverse((o: Object3D) => {
        const m = o as Mesh;
        if (m.geometry) m.geometry.dispose();
        const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
        mats.forEach((mat) => mat.dispose());
      });
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      delete host.dataset.drawerReady;
    };
    // Rebuilt only when the deck changes; flags and focus are applied live by the effect below.
  }, [items, lowRes, onFail]);

  useEffect(() => {
    api.current?.update({ flagged, focus, riffle, replay });
  }, [flagged, focus, riffle, replay]);

  return <div ref={hostRef} role="img" aria-label={label} className="absolute inset-0 cursor-pointer touch-pan-y" />;
}
