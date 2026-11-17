# ReFound frontend redesign: implementation plan

Branch: `feat/premium-frontend-redesign`. Scope: `frontend/` only (plus the doc updates in Phase 9).
Audience: the engineer implementing this, starting cold. Follow it literally. Where a value, file path, prop
or line of copy is given, use it as written. If something here contradicts the code you find, the facts in
section 0 were verified against the repo on 2026-11-16; re-check the file, then follow the plan's intent.

Contents: 0 Verified facts · 1 Design direction · 2 Design system · 3 Routes and shell · 4 Components ·
5 Fixtures · 6 Unbuilt-feature policy · 7 Bugs to fix · 8 Dependencies · 9 Build phases · 10 Acceptance

---

## 0. Verified facts (read before building)

### 0.1 Baseline
- `npm run build` passes today: one JS chunk, 397 kB (125 kB gzip). `npm run lint` **fails** with 9 errors
  (`react-hooks/set-state-in-effect` in `useTheme.ts`, `useBackend.ts`, `Import.tsx`; `no-explicit-any` in
  `api.ts`, `useQueryState.ts`, `History.tsx`; unused var in `Search.tsx`). The redesign must end with zero.
- `three`, `@react-three/*`, `meshline`, `ogl`, `@types/three` are imported nowhere in `src`. `motion` is used
  only for page curtains, a boot overlay, letter-by-letter headings and scroll reveals.
- `tailwind.config.js` defines no `fontSize`, so the classes used everywhere today (`text-display`,
  `text-body`, `text-label`, `text-heading`, `text-body-sm`, `text-score`, `font-label`) generate nothing. The
  current UI has no real type scale.
- `index.html` loads Inter and JetBrains Mono from Google Fonts (a runtime CDN; must go).
- `src/App.css`, `src/assets/react.svg`, `src/assets/vite.svg`, `public/icons.svg`, `public/favicon.svg` (the
  purple Vite bolt) and `frontend/README.md` are Vite template leftovers.
- `frontend/Dockerfile` runs `COPY nginx.conf ...` with build context `./frontend`, but the only `nginx.conf`
  is at `/nginx/nginx.conf`. By inspection the image cannot build (Docker was not available to confirm). Fix in
  Phase 0 by adding `frontend/nginx.conf`; neither the Dockerfile nor `nginx/nginx.conf` is edited.
- Vite 8 needs Node `^20.19.0 || >=22.12.0`. Cloudflare's `NODE_VERSION=20` resolves to the latest 20.x, which
  satisfies it. Do not add an `engines` field.
- Cloudflare Pages serves `index.html` for unknown paths only while the output has **no** top-level
  `404.html`. Never add `public/404.html`. The not-found page is a React route.
- Playwright 1.63.0 is reachable only through `require('playwright')` (global `NODE_PATH`). `frontend` is
  `"type": "module"`, so every script that uses it is a `.cjs` file. Do not add Playwright or
  `@playwright/test` to `package.json` and do not run `playwright install`.

### 0.2 Real API shapes (source: `backend/app/api/routes/*.py`, `backend/app/database/models.py`)
All paths are under `{backendUrl}`. Default `backendUrl` is `http://localhost:8000`.

| Call | Response |
|---|---|
| `GET /api/health` | `{"status":"ok"}` |
| `GET /api/documents/` | `Document[]`, newest first |
| `POST /api/documents/import` (multipart field `file`) | `ImportResult` |
| `POST /api/documents/import-url` (`{"url": string}`) | `ImportResult` |
| `DELETE /api/documents/{id}` | `{"status":"deleted","document_id":number}` |
| `POST /api/query/` (`{"query": string, "top_k": number}`) | `text/plain` NDJSON stream, see below |
| `GET /api/query/history?limit=N` (server default 20) | `HistoryItem[]`, newest first |
| `GET /api/settings/` | `{"message":"not implemented"}` (do not call it) |

```ts
type SourceType = 'chatgpt' | 'chatgpt_share' | 'claude' | 'markdown' | 'txt' | 'pdf' | 'image';
interface Document {
  id: number;
  filename: string;            // uploaded file name, OR the full share URL for link imports
  source_type: SourceType | string;
  title: string | null;        // the real title; may be null or ""
  created_at: string | null;   // naive UTC, e.g. "2026-11-14T09:12:44.512339" (NO "Z")
  chunk_count: number;
  status: 'pending' | 'indexed' | 'error';   // NOT 'failed'
  error_message: string | null;
}
interface ImportResult {
  status: 'ok' | 'duplicate';  // 'duplicate' returns the existing document's fields
  document_id: number;
  title: string | null;
  source_type: string;
  chunks: number;
}
interface Source {             // no ids; matched to a Document by filename
  source: string;              // document TITLE ("Unknown" if the doc vanished)
  filename: string;            // document filename (a URL for link imports)
  score: number;               // cross-encoder logit, roughly -11..+11. NOT 0..1
  excerpt: string;             // first 300 chars of the passage
}
interface HistoryItem {
  id: number;
  query_text: string;          // NOT `query`
  answer: string | null;
  sources: Source[] | null;
  similar_problems: unknown[] | null;   // always [] today
  created_at: string | null;   // naive UTC
  duration_ms: number | null;
}
```

Errors: every non-2xx is JSON `{"detail": string}` from `HTTPException`, or
`{"detail": [{"loc": [...], "msg": string, "type": string}]}` from FastAPI validation (422).
Import statuses: 422 parse/validation, 403 share is private or blocked, 404 share deleted, 502 share host
error, 504 timeout, 500 `Indexing error: ...`.

Query stream: one JSON object per line.
- `{"token": "..."}` zero or more times, then exactly one `{"sources": Source[], "duration_ms": number}`.
- Sources arrive **only on the last line**. Nothing is known about sources while tokens stream.
- The stream never sends `{"error"}`. Three failure modes arrive as ordinary token text and must be detected
  by prefix on the assembled answer (section 4.5 `classifyAnswer`):
  1. Empty index: `No relevant memories found. Import some documents first.` with `sources: []`.
  2. No Gemini key: `[GEMINI_API_KEY not set] Top result: <passage text>` with real sources.
  3. Gemini failure: `Error generating answer: <message>` with real sources.
- History is saved only on the Gemini path. With no key, History stays empty.
- The prompt labels passages `[Memory 1]`, `[Memory 2]`, ... so answers sometimes contain those markers. They
  are not guaranteed.

There is no endpoint for a document's text or passages, none for deleting history, none for settings, topics,
summaries or export. Nothing in the UI may depend on them (section 6).

---

## 1. Design direction: "Card Index"

- **Product.** ReFound finds things you already worked out, in your own past AI conversations, notes and
  PDFs, and answers from them with the passages it used. It runs on your machine.
- **Character.** Quiet, exact, bookish.
- **World.** A private reading room with a card index. This is not a borrowed metaphor: the pipeline cuts
  every document into small cards (passages), files them, and pulls the closest few when asked.
  `EXPLAINER.md` already explains the product as a librarian with index cards.
- **Moments.** (1) The answer sheet: the answer set in a reading serif on a paper surface, with the source
  cards beside it and the matching words marked with highlighter. (2) The library list: a dense, aligned
  catalogue where every item carries its call number.
- **Signature.** The call number. Every document has a short monospace identifier (`GPT-0042`, `PDF-0017`)
  shown wherever the document appears: library rows, source cards, the command palette.

Why this and not the current look: the existing UI is generic dark SaaS with decoration that says nothing
about the product (a glowing orb, tilted outline squares, blur washes, a boot screen, a floating pill nav,
emoji icons, uppercase tracked labels, pulsing dots, letter-by-letter headings, a hard-coded terminal demo
claiming `24 docs / 186 chunks`). The new direction keeps the chrome neutral and quiet and spends all
richness on the two moments above.

Rules that follow from it (apply everywhere):
1. One accent, amber, the colour of a highlighter. It is carried over from the existing brand amber
   (`#E8A838`, kept exactly as the dark-theme accent). It marks found text, citations, the current nav item
   and focus. It is never a button fill and never a gradient.
2. Primary buttons are ink (near-black on light, off-white on dark).
3. Serif is for things you read (answers, questions, page titles). Sans is for things you operate. Mono is
   for call numbers, counts, durations and keycaps.
4. Sentence case everywhere. No uppercase tracked labels. No exclamation marks. Headings, labels and buttons
   end without a period.
5. No emoji, no gradients, no glows, no blurs, no decorative shapes, no looping animation except a loading
   indicator while something is really loading.
6. UI vocabulary: "passages" (never "chunks"), "library", "documents", "question", "answer", "sources",
   "backend". The wordmark is `ReFound` in Newsreader 500. No `RF·` mark.

---

## 2. Design system

Build this first (Phase 1) and build nothing that bypasses it. Tokens live as CSS custom properties in
`frontend/src/styles/tokens.css` and are exposed to Tailwind in `frontend/tailwind.config.js`. Components
use Tailwind classes only; no hex values, no arbitrary colour values and no inline colour styles anywhere in
`src` outside `tokens.css`.

Tailwind stays at 3.4.19 with the existing PostCSS setup. v4 would change the config format and the build
plugin for no visible gain.

### 2.1 Colour tokens

`frontend/src/styles/tokens.css` (complete file):

```css
:root {
  color-scheme: light;
  --canvas: #F6F5F2;
  --surface: #FFFFFF;
  --sunken: #EEECE7;
  --raised: #FFFFFF;
  --hover: #EBEAE7;
  --active: #E2E1DE;
  --ink: #1B1A17;
  --ink-2: #55514A;
  --ink-3: #67635B;
  --line: rgba(27, 26, 23, 0.10);
  --line-strong: rgba(27, 26, 23, 0.20);
  --control: #8C877E;
  --accent: #8A5A00;
  --accent-soft: #F1EBE0;
  --mark: #FFE39A;
  --success: #2A6A43;
  --success-soft: #EAF0EC;
  --danger: #A8382A;
  --danger-soft: #F6EBEA;
  --danger-solid: #A8382A;
  --on-danger: #FFFFFF;
  --btn: #1B1A17;
  --btn-hover: #33312D;
  --on-btn: #F6F5F2;
  --overlay: rgba(27, 26, 23, 0.32);
  --focus: #8A5A00;
  --shadow-1: 0 1px 2px rgba(27, 26, 23, 0.06);
  --shadow-2: 0 4px 16px rgba(27, 26, 23, 0.08), 0 1px 2px rgba(27, 26, 23, 0.06);
  --shadow-3: 0 16px 48px rgba(27, 26, 23, 0.16), 0 2px 6px rgba(27, 26, 23, 0.08);
}

:root[data-theme='dark'] {
  color-scheme: dark;
  --canvas: #141311;
  --surface: #1B1A17;
  --sunken: #0F0E0D;
  --raised: #232220;
  --hover: #252421;
  --active: #2D2C29;
  --ink: #ECE9E3;
  --ink-2: #B5B0A7;
  --ink-3: #9A958C;
  --line: rgba(236, 233, 227, 0.10);
  --line-strong: rgba(236, 233, 227, 0.20);
  --control: #7D786F;
  --accent: #E8A838;
  --accent-soft: #342B1B;
  --mark: #5A4310;
  --success: #86B892;
  --success-soft: #262A23;
  --danger: #EC8C7B;
  --danger-soft: #302521;
  --danger-solid: #C6513F;
  --on-danger: #FFFFFF;
  --btn: #ECE9E3;
  --btn-hover: #FFFFFF;
  --on-btn: #141311;
  --overlay: rgba(0, 0, 0, 0.56);
  --focus: #E8A838;
  --shadow-1: none;
  --shadow-2: 0 8px 24px rgba(0, 0, 0, 0.40);
  --shadow-3: 0 16px 48px rgba(0, 0, 0, 0.56);
}
```

Roles:
| Token | Use |
|---|---|
| `canvas` | page background |
| `surface` | cards, the answer sheet, list containers, inputs |
| `sunken` | sidebar, wells, code blocks, skeleton blocks, keycaps |
| `raised` | dialogs, command palette, toasts, menus |
| `hover` / `active` | row and ghost-button hover / pressed and selected-row background |
| `ink`, `ink-2`, `ink-3` | primary, secondary, muted text. Icons take their text role's colour |
| `line` | hairlines between rows and around cards |
| `line-strong` | dividers that must read clearly, dropzone dashes |
| `control` | borders of inputs, selects, checkboxes, secondary buttons (meets 3:1) |
| `accent` | citation numbers, current-nav indicator, links inside prose, focus ring |
| `accent-soft` | hover background of a citation, selected-source card background |
| `mark` | highlighter background behind matched words (text on it stays `ink`) |
| `success`, `danger` (+ `-soft`) | status text and its tinted callout background only |
| `danger-solid` + `on-danger` | the destructive confirm button only |
| `btn`, `btn-hover`, `on-btn` | primary button |

Contrast (WCAG 2.x ratios, computed; AA needs 4.5 for text, 3.0 for control borders and focus):

| Pair | Light | Dark |
|---|---|---|
| `ink` on `canvas` / `surface` / `sunken` / `raised` | 15.96 / 17.40 / 14.74 / 17.40 | 15.32 / 14.36 / 15.92 / 13.12 |
| `ink-2` on `canvas` / `surface` / `sunken` / `raised` | 7.24 / 7.89 / 6.68 / 7.89 | 8.61 / 8.07 / 8.94 / 7.37 |
| `ink-3` on `canvas` / `surface` / `sunken` / `raised` | 5.48 / 5.98 / 5.06 / 5.98 | 6.23 / 5.84 / 6.48 / 5.34 |
| `ink-3` on `hover` / `active` (worst text case) | 4.97 / 4.57 | 5.21 / 4.69 |
| `ink-3` on `accent-soft` | 5.04 | 4.68 |
| `accent` on `canvas` / `surface` / `sunken` | 5.44 / 5.93 / 5.02 | 8.92 / 8.36 / 9.27 |
| `accent` on `accent-soft` / `active` | 5.00 / 4.53 | 6.69 / 6.71 |
| `ink` on `mark` | 13.84 | 7.72 |
| `success` on `surface` / `success-soft` | 6.48 / 5.61 | 7.69 / 6.46 |
| `danger` on `surface` / `danger-soft` | 6.43 / 5.51 | 7.13 / 6.09 |
| `on-btn` on `btn` / `btn-hover` | 15.96 / 11.90 | 15.32 / 18.57 |
| `on-danger` on `danger-solid` | 6.43 | 4.52 |
| `control` border on `canvas` / `surface` / `sunken` | 3.27 / 3.57 / 3.02 | 4.23 / 3.97 / 4.40 |
| `focus` ring on `canvas` / `surface` | 5.44 / 5.93 | 8.92 / 8.36 |

Never put `ink-3` text on `mark`, `danger-solid` or `btn`. Never use `line` as the only boundary of an
interactive control; use `control`.

### 2.2 Tailwind config

Replace `frontend/tailwind.config.js` with:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      canvas: 'var(--canvas)',
      surface: 'var(--surface)',
      sunken: 'var(--sunken)',
      raised: 'var(--raised)',
      hover: 'var(--hover)',
      active: 'var(--active)',
      ink: { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)', 3: 'var(--ink-3)' },
      line: { DEFAULT: 'var(--line)', strong: 'var(--line-strong)' },
      control: 'var(--control)',
      accent: { DEFAULT: 'var(--accent)', soft: 'var(--accent-soft)' },
      mark: 'var(--mark)',
      success: { DEFAULT: 'var(--success)', soft: 'var(--success-soft)' },
      danger: { DEFAULT: 'var(--danger)', soft: 'var(--danger-soft)', solid: 'var(--danger-solid)' },
      'on-danger': 'var(--on-danger)',
      btn: { DEFAULT: 'var(--btn)', hover: 'var(--btn-hover)' },
      'on-btn': 'var(--on-btn)',
      overlay: 'var(--overlay)',
      focus: 'var(--focus)',
    },
    fontFamily: {
      sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
      serif: ['"Newsreader Variable"', 'Georgia', '"Times New Roman"', 'serif'],
      mono: ['"IBM Plex Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
    },
    fontSize: {
      xs: ['12px', { lineHeight: '16px' }],
      sm: ['13px', { lineHeight: '20px' }],
      base: ['14px', { lineHeight: '20px' }],
      md: ['16px', { lineHeight: '24px' }],
      lg: ['18px', { lineHeight: '28px' }],
      read: ['18px', { lineHeight: '30px' }],
      title: ['22px', { lineHeight: '28px', letterSpacing: '-0.005em' }],
      page: ['28px', { lineHeight: '36px', letterSpacing: '-0.01em' }],
      display: ['44px', { lineHeight: '48px', letterSpacing: '-0.02em' }],
    },
    fontWeight: { normal: '400', medium: '500' },
    borderRadius: { none: '0', sm: '4px', DEFAULT: '8px', lg: '12px', xl: '16px', full: '9999px' },
    boxShadow: { none: 'none', 1: 'var(--shadow-1)', 2: 'var(--shadow-2)', 3: 'var(--shadow-3)' },
    extend: {
      maxWidth: { measure: '680px', content: '1120px' },
      width: { sidebar: '248px', rail: '360px' },
      height: { bar: '56px' },
      transitionDuration: { fast: '120ms', base: '180ms', slow: '240ms' },
      transitionTimingFunction: { out: 'cubic-bezier(0.2, 0, 0, 1)' },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        rise: { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        breathe: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.55' } },
        spin: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        'fade-in': 'fade-in 180ms cubic-bezier(0.2, 0, 0, 1) both',
        rise: 'rise 180ms cubic-bezier(0.2, 0, 0, 1) both',
        breathe: 'breathe 1.6s ease-in-out infinite',
        spin: 'spin 800ms linear infinite',
      },
    },
  },
  plugins: [],
};
```

Spacing uses Tailwind's default scale unchanged (1 = 4px). Use only these steps: `0.5 1 1.5 2 3 4 5 6 8 10 12
16 20 24`. No arbitrary spacing values (`mt-[13px]`) anywhere.

### 2.3 Typography

Fonts are self-hosted through npm and bundled by Vite. Import exactly these in `src/main.tsx`, before
`./index.css`:

```ts
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource-variable/newsreader/wght.css';
import '@fontsource-variable/newsreader/wght-italic.css';
```

(The Newsreader files declare `unicode-range` per subset, so only the Latin file, 58 kB, is fetched unless
other glyphs or italics actually render. Do not use the `opsz` files: 132 kB each.)

Families: IBM Plex Sans and IBM Plex Mono are one superfamily, chosen for their filing-system, typewritten
character. Newsreader is a text serif drawn for reading on screens.

| Style | Class recipe | Used for |
|---|---|---|
| Display | `font-serif text-display font-medium` (below `md`: `text-page`) | Welcome headline only |
| Page title | `font-serif text-page font-medium` (below `md`: `text-title`) | one `h1` per page |
| Title | `font-serif text-title font-medium` | the asked question, dialog titles, empty-state titles |
| Reading | `font-serif text-read` (below `md`: `text-md` with `leading-7`) | answer body, history answer |
| Section label | `font-sans text-sm font-medium text-ink-2` | section headings inside a page (`h2`) |
| UI | `font-sans text-base` | default body, buttons, rows, inputs on desktop |
| UI large | `font-sans text-md` | all inputs below `md` (prevents iOS zoom), welcome paragraph |
| Small | `font-sans text-sm text-ink-2` | secondary lines, helper text |
| Caption | `font-sans text-xs text-ink-3` | timestamps, field hints |
| Meta | `font-mono text-xs text-ink-3 tabular-nums` | call numbers, counts, durations, keycaps |

Rules: weights 400 and 500 only. Hierarchy comes from size and colour. Negative tracking only on `title`,
`page`, `display` (built into the tokens). Numbers always `tabular-nums`. No italics for emphasis; markdown
`em` in answers renders in Newsreader italic because the model wrote it.

### 2.4 Global CSS

`frontend/src/index.css` (complete file):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html { background: var(--canvas); color: var(--ink); -webkit-text-size-adjust: 100%; }
  body {
    min-height: 100dvh; margin: 0;
    font-family: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 14px; line-height: 20px;
    -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
  }
  #root { min-height: 100dvh; }
  ::selection { background: var(--mark); color: var(--ink); }
  :focus { outline: none; }
  :focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; border-radius: 4px; }
  mark { background: var(--mark); color: var(--ink); border-radius: 2px; padding: 0 1px; }
  dialog { padding: 0; border: 0; background: transparent; color: inherit; max-width: none; max-height: none; }
  dialog::backdrop { background: var(--overlay); }
  button, input, select, textarea { font: inherit; color: inherit; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Focus ring spec: 2px solid `focus`, 2px offset, on `:focus-visible` only, on every interactive element. Text
inputs override the offset to 0 (`focus-visible:outline-offset-0`) so the ring replaces the border. Never
remove the outline without replacing it. Inside dialogs the same ring applies.

### 2.5 Spacing, layout grid, breakpoints

- 4px grid. Page padding: 16px below `md`, 24px from `md`, 40px from `lg`.
- Breakpoints are Tailwind defaults: `sm` 640, `md` 768, `lg` 1024, `xl` 1280.
- Shell: from `lg`, a fixed left sidebar (`w-sidebar`, 248px) and fluid content capped at `max-w-content`
  (1120px), left-aligned within the content area with the page padding. Below `lg`: top bar (56px) and
  bottom tab bar (56px plus `env(safe-area-inset-bottom)`).
- Reading measure: `max-w-measure` (680px) for answers, questions and prose.
- Ask page from `xl`: two columns, answer (`max-w-measure`) and a sticky sources rail (`w-rail`, 360px),
  gap 40px. Below `xl`: one column, sources under the answer.
- Control heights: small 28px, default 36px, large 44px. Touch targets below `lg` are at least 44px.
- Row heights: nav row 36px, single-line list row 44px, two-line list row 60px.
- Gaps: 8 inside a control group, 12 between related controls, 24 between blocks, 40 between page sections.
  A section label sits 24 below the previous block and 8 above its own content.

### 2.6 Radii, borders, elevation

- Radii: 4 (`rounded-sm`: keycaps, marks, citation chips, status tags), 8 (`rounded`: buttons, inputs, nav
  rows), 12 (`rounded-lg`: cards, the answer sheet, list containers, dropzone), 16 (`rounded-xl`: dialogs,
  command palette), full (status dot only). Nested radius = outer radius minus padding, minimum 4.
- Borders: 1px `line` around cards and between rows. 1px `control` on form controls. Dashed 1px
  `line-strong` on the dropzone only.
- Elevation: `shadow-1` on nothing by default (cards are flat with a hairline); `shadow-2` on toasts and the
  drag overlay card; `shadow-3` on dialogs and the palette. In dark mode depth comes from the
  `sunken → canvas → surface → raised` steps plus hairlines.

### 2.7 Iconography

One library: `lucide-react` (pinned `1.73.0`). Every icon goes through `src/components/ui/Icon.tsx` so size
and stroke cannot drift:

```tsx
import type { LucideIcon } from 'lucide-react';
export function Icon({ icon: C, size = 16, className }: { icon: LucideIcon; size?: 16 | 20; className?: string }) {
  return <C size={size} strokeWidth={1.5} aria-hidden="true" focusable="false" className={className} />;
}
```

Size 16 everywhere; 20 only in the mobile tab bar and empty-state headers. Icons inherit `currentColor`.
Icon-only buttons need `aria-label` and a matching `title`. Use only these exports (all verified to exist in
1.73.0): `Search, Library, History, Settings, Upload, Link2, FileText, FileJson, Image, MessageSquare,
Trash2, X, Check, AlertTriangle, Info, Sun, Moon, Monitor, ChevronRight, ChevronDown, ArrowUp, ArrowLeft,
CornerDownLeft, Square, RotateCw, Copy, ExternalLink, Unplug, FolderOpen, Loader2, Plus, Inbox, SearchX,
Clock, Minus`.

Source-type icons: `chatgpt`, `chatgpt_share`, `claude` → `MessageSquare`; `markdown`, `txt` → `FileText`;
`pdf` → `FileText`; `image` → `Image`; anything else → `FileText`. The type is told apart by its label and
call-number prefix, not by icon colour.

### 2.8 Motion

- One curve: `ease-out` token `cubic-bezier(0.2, 0, 0, 1)`. Durations: `fast` 120ms (hover, press, colour),
  `base` 180ms (things that appear: toast, dialog, palette, answer blocks), `slow` 240ms (drag overlay).
- Allowed: colour/background/border transitions on hover (`transition-colors duration-fast ease-out`);
  `animate-rise` on a dialog, the palette, a toast, and once on the answer sheet when the first token
  arrives; `animate-fade-in` on route content; `animate-breathe` on skeleton blocks and the streaming caret
  only while loading; `animate-spin` on `Loader2` only while loading.
- Forbidden: `transition-all`, `hover:scale`, hover translate, springs, blur transitions, animated
  width/height/margins, page-transition curtains, staggered card entrances, any loop on idle UI (the
  connection dot does not pulse).
- Reduced motion: the global rule in 2.4 neutralises everything. Additionally the streaming caret is hidden
  and replaced by the status line text "Writing" (which is always present anyway).
- Remove the `motion` package entirely (section 8). Everything above is CSS.

### 2.9 Theme mechanics

- Preference: `'system' | 'light' | 'dark'`, stored in `localStorage['refound_theme']` (existing key; old
  values `light`/`dark` remain valid; missing means `system`).
- `index.html` sets the attribute before first paint (no flash). Put this inline in `<head>`:

```html
<script>
  (function () {
    try {
      var p = localStorage.getItem('refound_theme');
      var dark = p === 'dark' || (p !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    } catch (e) { document.documentElement.setAttribute('data-theme', 'light'); }
  })();
</script>
```

- `index.html` also gets: `<meta name="color-scheme" content="light dark">`,
  `<meta name="description" content="Search and ask your own past AI conversations, notes and PDFs. Runs on your machine.">`,
  `<link rel="icon" type="image/svg+xml" href="/favicon.svg">`, title `ReFound`. Delete the three Google
  Fonts tags.
- New `public/favicon.svg`: a 32×32 rounded square (radius 7) filled `#1B1A17` with a single amber `#E8A838`
  horizontal bar, 16×5, radius 1.5, at x=8 y=17 (a highlighter stroke), and above it a 10×2 bar `#ECE9E3` at
  x=8 y=11 with opacity 0.5. No text.

---

## 3. Route map and information architecture

### 3.1 Routes

| Route | Page | Decision | Rationale |
|---|---|---|---|
| `/` | Welcome | **Replace** the marketing landing | A local app does not need a scrolling sales page, boot screen or fake terminal. `/` becomes one screen that explains the product in two sentences and connects the backend. If the backend is online, `/` redirects to `/ask`. |
| `/ask` | Ask | **Keep**, renamed from `/app/search` | The product's main act. The page holds the composer, the streamed answer and its sources. |
| `/library` | Library | **Add** (split out of Import) | The document list was buried under the upload form. It is the user's collection and needs its own place, with filter, sort and delete. |
| `/import` | Import | **Keep**, renamed from `/app/import`, refocused | Only adding things: files (several at once), a folder, a share link, and the queue of this session's imports. |
| `/history`, `/history/:id` | History | **Keep**, renamed from `/app/history`, rebuilt | List of past questions with a readable detail view and "Ask again". |
| `/settings` | Settings | **Keep**, renamed from `/app/settings` | Theme, connection, passages per answer, planned features, about. |
| `*` | Not found | **Add** | React route; no `404.html`. |
| `/app/search`, `/app/import`, `/app/history`, `/app/settings` | redirects | **Remove**, redirect with `<Navigate replace>` to the new paths | Old bookmarks keep working. |

No document reader page: the backend has no endpoint that returns a document's text.

`src/App.tsx`: `BrowserRouter` → `Routes`. `/` renders `Welcome` (no shell). All other pages render inside
`AppShell` via a layout route with `<Outlet />`. Pages are `React.lazy` imports wrapped in one `Suspense`
whose fallback is the page skeleton `PageLoading` (title skeleton plus three row skeletons). Navigation does
not animate beyond `animate-fade-in` on the outlet container, keyed by pathname's first segment.

Each page sets `document.title` in a `useEffect` (`Ask · ReFound`, `Library · ReFound`, `Import · ReFound`,
`History · ReFound`, `Settings · ReFound`, `Not found · ReFound`, Welcome: `ReFound`) and its `h1` has
`tabIndex={-1}` and receives focus on route change (`AppShell` does this in an effect on `pathname`, calling
`document.querySelector('main h1')?.focus()` with `preventScroll`). The `h1` focus outline is suppressed with
`focus:outline-none` since it is not interactive.

### 3.2 App shell

Desktop (`lg` and up):

```
+----------------------+------------------------------------------------+
| ReFound              |  [offline banner, only when offline]           |
|                      |                                                |
| [Search or jump  ⌘K] |  Page title                         [actions]  |
|                      |  meta line                                     |
|  Ask                 |                                                |
|  Library         42  |  page content, max 1120                        |
|  Import           2  |                                                |
|  History             |                                                |
|                      |                                                |
|  (flex spacer)       |                                                |
|  Settings            |                                                |
|  ● Connected         |                                                |
|    localhost:8000    |                                                |
+----------------------+------------------------------------------------+
```

- `Sidebar`: fixed, full height, `w-sidebar`, `bg-sunken`, right border `line`, padding 12. Wordmark row
  (height 56, `ReFound` in `font-serif text-lg font-medium`, links to `/ask`). Then the palette trigger: a
  36px button styled as an input (`bg-surface border border-line rounded`, `Search` icon, text "Search or
  jump to" in `ink-3`, keycap `⌘K` right-aligned; shows `Ctrl K` when `navigator.platform` does not contain
  `Mac`). Then nav rows. Bottom group: Settings row, then `ConnectionStatus`.
- Nav row: height 36, radius 8, padding-x 8, gap 8 between icon and label, `text-base text-ink-2`.
  Hover: `bg-hover text-ink`. Current (`aria-current="page"`): `bg-active text-ink font-medium` plus a 2px
  by 16px `bg-accent` bar at the left edge (`rounded-full`, absolutely positioned at `left-0`). Focus-visible:
  ring. Right-aligned count in Meta style: Library shows the document count when known; Import shows the
  number of queued-or-working items while the queue is running (nothing when idle).
  Icons: Ask `Search`, Library `Library`, Import `Upload`, History `History`, Settings `Settings`.
- Content area: `margin-left: 248px`, `main` with page padding and `max-w-content`.

Mobile and tablet (below `lg`):
- `TopBar`: sticky, height 56, `bg-canvas`, bottom border `line`. Left: wordmark. Right: `StatusDot` (with
  `sr-only` text), an icon button `Search` ("Search or jump to", opens the palette), an icon button
  `Settings` (link to `/settings`).
- `TabBar`: fixed bottom, `bg-surface`, top border `line`, padding-bottom `env(safe-area-inset-bottom)`, four
  equal tabs: Ask, Library, Import, History. Each: icon size 20 above a `text-xs` label, 56px tall, `ink-3`;
  current tab `text-ink` with a 2px `bg-accent` bar on its top edge. `main` gets bottom padding 72px.
- A "Skip to content" link is the first focusable element in both layouts (`sr-only focus:not-sr-only`,
  styled as a secondary button at top-left).

`ConnectionStatus` (sidebar bottom): a 44px row, button semantics, links to `/settings#connection`.
`StatusDot` + label + second line with the host in Meta style.
| State | Dot | Label | Second line |
|---|---|---|---|
| checking | `bg-ink-3` | Checking | host |
| online | `bg-success` | Connected | host (e.g. `localhost:8000`) |
| offline | hollow ring, `border-ink-3` | Offline | host |
The dot is 8px, never animated. It has `aria-hidden`; the row's accessible name is "Backend: Connected,
localhost:8000".

`OfflineBanner`: rendered at the top of `main` on every shell page when status is `offline`. It is a
`Callout tone="neutral"` with icon `Unplug`, text "The backend at {host} is not answering. ReFound is
retrying every 5 seconds", and two actions: `Retry now` (refetches health) and a link `Connection settings`.
It disappears as soon as a health check succeeds (and a toast "Reconnected" is shown).

### 3.3 Command palette (warranted: this is a search product used by keyboard people)

Open with `⌘K` / `Ctrl+K` from anywhere (also `/` when focus is not in a field), or the sidebar trigger.
Full spec in 4.4. Sections, in order:
1. **Ask**: when the input is non-empty, the first row is `Ask "{input}"` (Enter runs the question and goes
   to `/ask`).
2. **Go to**: Ask, Library, Import, History, Settings (filtered by the input).
3. **Recent questions**: up to 5 history items whose text contains the input → `/history/{id}`.
4. **Documents**: up to 6 documents whose title contains the input (case-insensitive), with call number →
   `/library?q={title}`.
5. **Actions**: `Switch to light theme` / `Switch to dark theme`, `Import files` (→ `/import`).

### 3.4 Global behaviours

- Drag files anywhere over the app → `DropOverlay` appears; dropping enqueues them and navigates to
  `/import`.
- Keyboard: `⌘K`/`Ctrl+K` palette; `/` focus the Ask composer when on `/ask`, otherwise open the palette;
  `Esc` closes dialogs/palette and, on `/ask` while streaming, stops the answer; `g a`, `g l`, `g i`, `g h`,
  `g s` go to Ask, Library, Import, History, Settings (sequence within 800ms, ignored while typing in a
  field). The shortcuts are listed in Settings → About.
- Toasts are for the result of an action the user just took and can no longer see (delete, copy, reconnect,
  an import finishing while on another page). Validation and server errors for a visible form appear inline
  next to that form, not as toasts.

---

## 4. Component inventory

Conventions for every component:
- Files live under `src/components/<area>/Name.tsx`, one component per file, named export.
- `className` composition uses `clsx`.
- **Standard interactive states**, unless a component says otherwise: hover = background or text colour step
  with `transition-colors duration-fast ease-out`; active (pressed) = one step further (`bg-active`);
  focus-visible = the global ring; disabled = `opacity-50 cursor-not-allowed` with the native `disabled`
  attribute (or `aria-disabled` on links) and no hover response.
- **Backend-offline** is a first-class state: every data view below says what it renders when
  `useBackendStatus().status === 'offline'`.
- Loading uses `Skeleton` blocks shaped like the real content. No spinners for page-level loading; `Spinner`
  is for inline, in-progress actions.

### 4.1 Foundation (not visual; build in Phase 2)

**`src/lib/store.ts`** — a 25-line external store, so no context providers and no `setState` in effects
(this is what makes `react-hooks/set-state-in-effect` and `react-refresh/only-export-components` pass):

```ts
export interface Store<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(listener: () => void): () => void;
}
export function createStore<T>(initial: T): Store<T>;
```
**`src/hooks/useStore.ts`** — `useStore(store)` and `useStore(store, selector)` built on
`useSyncExternalStore`. Selectors must return primitives or references already held in the state object.

**`src/state/settings.ts`** — `settingsStore: Store<{ backendUrl: string; theme: 'system'|'light'|'dark';
topK: number }>` initialised from localStorage keys `refound_backend_url` (default
`http://localhost:8000`), `refound_theme` (default `system`), `refound_top_k` (default 5, clamped 1..10).
Exports `setBackendUrl(url)` (trims, strips trailing slashes), `setTheme(t)`, `setTopK(n)`; each writes
localStorage inside try/catch. `setTheme` also sets `data-theme` on `<html>`; the module registers one
`matchMedia('(prefers-color-scheme: dark)')` change listener that re-applies when the preference is
`system`.

**`src/state/queryClient.ts`** — exports one `QueryClient` with defaults `staleTime: 30_000`,
`refetchOnWindowFocus: true`, `retry: (count, err) => !(err instanceof ApiError) && count < 1`.

**`src/services/api.ts`** — keep every endpoint, method and payload exactly as today. Changes:
- Export the types from 0.2 (`Document`, `ImportResult`, `Source`, `HistoryItem`, `SourceType`). No `any`.
- `export class ApiError extends Error { status: number; kind: 'network' | 'http' }`. `status` is 0 for
  network failures.
- `async function readError(res: Response): Promise<ApiError>`: read `res.text()`; try `JSON.parse`; if
  `detail` is a string use it; if `detail` is an array, join each item's `msg` with `; `; otherwise use
  the fallback table below. Never surface raw JSON or HTML.
- A `request()` wrapper catches `TypeError`/`AbortError` from `fetch` and throws
  `new ApiError('The backend is not reachable', 0, 'network')` (re-throw `AbortError` untouched when the
  caller passed its own signal).
- Fallback messages by status when the body has no usable `detail`: 404 `Not found`, 413 `That file is too
  large for the backend`, 422 `The backend could not read that`, 500 `The backend hit an error`,
  502/503/504 `The backend could not complete the request`, other `Request failed ({status})`.
- Functions (same names where they exist today): `healthCheck(baseUrl)`, `listDocuments(baseUrl)`,
  `importFile(baseUrl, file, signal?)`, `importUrl(baseUrl, url, signal?)`, `deleteDocument(baseUrl, id)`,
  `getHistory(baseUrl, limit = 100)` (adds `?limit=`; the route already accepts it),
  `queryMemoryStreaming(baseUrl, query, topK, signal?)` returning `ReadableStream<Uint8Array>`.
- **`src/services/stream.ts`** — `async function* readNdjson(stream): AsyncGenerator<StreamEvent>` where
  `type StreamEvent = { type: 'token'; token: string } | { type: 'final'; sources: Source[]; durationMs:
  number; similarProblems: unknown[] }`. Buffer partial lines; flush the decoder and the last line at the
  end; skip blank and unparseable lines (do **not** append unparseable text to the answer, as today's code
  does).

**`src/hooks/useBackendStatus.ts`** — `useQuery({ queryKey: ['health', backendUrl], queryFn: () =>
healthCheck(backendUrl), retry: false, refetchInterval: q => (q.state.data ? 30_000 : 5_000) })`. Returns
`{ status: 'checking' | 'online' | 'offline', host, refetch }` where `checking` = no result yet,
`host` = `new URL(backendUrl).host` (fallback: the raw string).

**`src/hooks/useDocuments.ts`**, **`src/hooks/useHistory.ts`** — `useQuery` with keys
`['documents', backendUrl]` and `['history', backendUrl]`, `enabled: status === 'online'`.
`useDeleteDocument` is a `useMutation` that removes the row optimistically from the cache, restores it on
error, and invalidates `['documents']` on settle.

**`src/state/ask.ts`** — the current question lives in a module store so it survives navigation:

```ts
type AskStatus = 'idle' | 'retrieving' | 'streaming' | 'done' | 'stopped' | 'failed';
interface AskState {
  status: AskStatus;
  question: string;
  answer: string;              // assembled tokens
  sources: Source[] | null;    // null until the final line
  durationMs: number | null;
  similarProblems: unknown[];
  error: string | null;        // ApiError.message when status === 'failed'
  topK: number;                // the value used for this run (drives skeleton count)
}
export const askStore: Store<AskState>;
export function ask(question: string): Promise<void>;  // aborts any run in flight first
export function stopAsking(): void;                     // AbortController.abort(); status → 'stopped'
export function resetAsk(): void;
```
`ask()`: set `retrieving`; call `queryMemoryStreaming`; on the first token set `streaming`; append tokens
(batch updates with `requestAnimationFrame` so a fast stream does not re-render per token); on `final` set
`done` with sources and duration, then `queryClient.invalidateQueries({ queryKey: ['history'] })`; if the
stream ends without a `final` line set `done` with `sources: []`; on `ApiError` set `failed`.

**`src/state/importQueue.ts`** — store of
`{ id: string; kind: 'file' | 'url'; label: string; detail: string; status: 'queued' | 'working' | 'done' |
'duplicate' | 'failed' | 'skipped'; message: string | null; documentId: number | null; chunks: number | null }[]`
plus `enqueueFiles(files: File[])`, `enqueueUrl(url: string)`, `retryItem(id)`, `removeItem(id)`,
`clearFinished()`. One item is processed at a time (the backend embeds synchronously). After each `done`,
invalidate `['documents']`. Files whose extension is not in `SUPPORTED_EXTENSIONS` are added as `skipped`
with message `Unsupported type (.ext)` and never uploaded (the backend would index any unknown extension as
plain text). When the queue finishes while the user is not on `/import`, push one toast:
`Imported 3 documents` / `Imported 2 documents, 1 failed` with action `View` → `/import`.

**`src/state/toasts.ts`** — store of `{ id; tone: 'neutral' | 'success' | 'danger'; message; action?:
{ label; onSelect } }[]` and `toast(message, opts?)`, `dismissToast(id)`. Max 3 visible; oldest drops.

**`src/lib/` pure helpers** (each with the exact behaviour below; these are where most bugs get fixed):

| Function | Behaviour |
|---|---|
| `parseServerDate(s: string \| null): Date \| null` | `null` in → `null`. If `s` has no `Z` and no `±hh:mm` suffix, append `Z` (backend stores naive UTC). Invalid → `null`. |
| `formatDate(d)` | `14 Nov 2026` (`Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })`). `null` → `Unknown date`. |
| `formatDateTime(d)` | `14 Nov 2026, 09:12` (24-hour, local time). |
| `formatDayHeading(d)` | `Today`, `Yesterday`, else `formatDate`. |
| `formatDuration(ms: number \| null)` | `null` → `''`; `< 1000` → `840 ms`; else one decimal, `2.4 s`. |
| `formatCount(n)` | `1,318` (`Intl.NumberFormat('en-US')`). |
| `plural(n, one, many)` | `1 passage`, `34 passages`, with `formatCount`. |
| `isUrl(s)` | `/^https?:\/\//i` |
| `displayTitle(doc: Document)` | `doc.title?.trim()` if non-empty; else if `isUrl(doc.filename)` → `Shared conversation`; else `doc.filename`. |
| `originLabel(doc)` | URL imports: host + path with the id shortened, e.g. `chatgpt.com/share/6741f3c2…` (first 8 chars of the id then `…`). Files: `doc.filename`, or `''` when it equals the display title. |
| `SOURCE_TYPES` | map: `chatgpt` → `{ label: 'ChatGPT export', prefix: 'GPT', group: 'chats' }`; `chatgpt_share` → `{ 'ChatGPT share link', 'GPT', 'chats' }`; `claude` → `{ 'Claude export', 'CLD', 'chats' }`; `markdown` → `{ 'Markdown', 'MD', 'notes' }`; `txt` → `{ 'Text', 'TXT', 'notes' }`; `pdf` → `{ 'PDF', 'PDF', 'pdfs' }`; `image` → `{ 'Image', 'IMG', 'images' }`; fallback `{ 'Document', 'DOC', 'notes' }`. |
| `callNumber(doc)` | `` `${prefix}-${String(doc.id).padStart(4, '0')}` `` → `GPT-0042`. |
| `SUPPORTED_EXTENSIONS` | `['.json', '.md', '.markdown', '.txt', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']` |
| `matchDocument(source: Source, docs: Document[])` | First doc with `doc.filename === source.filename`; among several, prefer `doc.title === source.source`. No match → `undefined`. |
| `sourceTitle(source, doc?)` | `displayTitle(doc)` if matched; else `source.source` if non-empty and not `Unknown`; else `Shared conversation` if `isUrl(source.filename)`; else `source.filename` or `Unknown document`. **Never the raw URL.** |
| `relevance(score: number)` | `p = 1 / (1 + Math.exp(-score))`. `p >= 0.7` → `{ level: 'strong', label: 'Strong match', bars: 3 }`; `p >= 0.3` → `{ 'partial', 'Partial match', 2 }`; else `{ 'weak', 'Weak match', 1 }`. Also returns `raw: score.toFixed(2)`. |
| `splitSpeaker(excerpt)` | If the text starts with `[USER]`, `[ASSISTANT]`, `[CLAUDE]` or `[TOOL]` followed by a newline, return `{ speaker: 'You' \| 'ChatGPT' \| 'Claude' \| 'Tool', text: rest }`; else `{ speaker: null, text }`. |
| `cleanText(s)` | Remove markdown escape backslashes: `s.replace(/\\([\\`*_{}\[\]()#+\-.!:>~\|])/g, '$1')`; collapse 3+ newlines to 2; trim. Applied to every excerpt before display (fixes `My pick\:`). |
| `queryTerms(question)` | Lowercase, split on non-letters/digits, keep words of 4+ chars not in the stop list, dedupe, max 8. Stop list: `about, after, again, also, been, before, being, between, both, could, does, doing, down, each, find, from, have, here, into, just, like, made, make, mentioned, more, most, much, need, notes, only, other, over, said, same, should, some, such, than, that, their, them, then, there, these, they, this, those, through, under, very, want, were, what, when, where, which, while, will, with, would, wrote, write, your`. |
| `highlight(text, terms)` | Returns `{ text: string; hit: boolean }[]` splitting on `new RegExp('\\b(' + terms.map(escape).join('\|') + ')\\w*', 'gi')`. Empty `terms` → one non-hit segment. Rendered as `<mark>` for hits. |
| `classifyAnswer(answer, sources)` | `answer.startsWith('No relevant memories found')` and no sources → `{ kind: 'empty-index' }`. `answer.startsWith('[GEMINI_API_KEY not set]')` → `{ kind: 'no-key' }`. `answer.startsWith('Error generating answer:')` → `{ kind: 'llm-error', detail: rest.trim() }`. Else `{ kind: 'answer' }`. |
| `linkCitations(markdown, sourceCount)` | Replace each `[Memory N]` (also lists such as `[Memory 1, Memory 3]` and `[Memory 1, 3]`) with markdown links `[N](#source-N)` for each `N` between 1 and `sourceCount`; markers out of range are left as plain text. With `sourceCount === null` (still streaming) convert all. |
| `findAskedBefore(question, history)` | Normalise both sides (lowercase, strip punctuation, collapse spaces). Match when normalised strings are equal, or the Jaccard overlap of their `queryTerms` sets is `>= 0.8` with at least 2 terms. Returns the most recent matching `HistoryItem` that has a non-empty answer, else `null`. |
| `parseShareLink(input)` | Mirrors the backend allowlist. Returns `{ ok: true, url }` or `{ ok: false, message }`. Rules in 4.7. |

### 4.2 Primitives (`src/components/ui/`)

**Button** — `{ variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg';
loading?: boolean; icon?: LucideIcon; iconRight?: LucideIcon; } & ButtonHTMLAttributes`. Also exports
`ButtonLink` (same look, renders a router `Link`).
- Shape: radius 8, `font-medium text-base`, heights 28/36/44, padding-x 10/14/18, icon gap 8.
- default: primary `bg-btn text-on-btn`; secondary `bg-surface text-ink border border-control`; ghost
  `text-ink-2`; danger `bg-danger-solid text-on-danger`.
- hover: primary `bg-btn-hover`; secondary `bg-hover`; ghost `bg-hover text-ink`; danger `opacity-90`.
- active: primary and danger `translate-y-px`; secondary and ghost `bg-active`.
- focus-visible: ring. disabled: standard.
- loading: `aria-busy`, disabled, the leading icon is replaced by `Spinner`; the label stays (width does
  not jump). Buttons whose label changes while loading say so in their spec ("Connecting").

**IconButton** — `{ icon: LucideIcon; label: string; size?: 'sm' | 'md'; variant?: 'ghost' | 'secondary' }`.
Square 28/36 (44 below `lg` via `max-lg:h-11 max-lg:w-11`). `aria-label={label}` and `title={label}`.
States as Button ghost/secondary.

**TextField** — `{ label: string; hideLabel?: boolean; hint?: string; error?: string; leadingIcon?:
LucideIcon; trailing?: ReactNode; } & InputHTMLAttributes`. Label above (`text-sm font-medium text-ink`,
gap 6px → use `gap-1.5`). Input: height 36 (44 below `md`, with `text-md`), `bg-surface border
border-control rounded px-3`, placeholder `text-ink-3`.
- hover: `border-ink-3`. focus-visible: ring at offset 0, border `transparent`. disabled: `bg-sunken`,
  standard. error: border `danger`, message below in `text-sm text-danger` with `AlertTriangle` icon,
  `aria-invalid`, `aria-describedby` linking hint or error. Hint: `text-xs text-ink-3` below.
- `id` generated with `useId`.

**Select** — native `<select>` styled like TextField with a `ChevronDown` overlay. `{ label; hideLabel?;
options: { value: string; label: string }[] } & SelectHTMLAttributes`. Same states.

**SegmentedControl** — `{ label: string; value: string; onChange(v): void; options: { value; label;
icon?: LucideIcon; count?: number }[]; size?: 'sm' | 'md' }`. `role="radiogroup"` with `role="radio"`
buttons, roving tabindex, arrow keys move and select. Track: `bg-sunken rounded p-0.5`; segment height 28
(md 32), `text-sm text-ink-2 rounded-sm px-3`. Selected: `bg-surface text-ink font-medium shadow-1` (dark:
`bg-raised`). Hover (unselected): `text-ink`. Focus-visible: ring on the segment. Disabled: standard.
Below `sm` it scrolls horizontally (`overflow-x-auto`, no wrap).

**Stepper** — `{ label: string; value: number; min: number; max: number; onChange(n): void }`. Three joined
controls: `Minus` IconButton, a 44px-wide read-only value in `font-mono tabular-nums` (`role="spinbutton"`,
`aria-valuenow/min/max`, Up/Down arrows change it), `Plus` IconButton. The buttons disable at the bounds.

**Kbd** — `{ children }`. `font-mono text-xs text-ink-2 bg-sunken border border-line rounded-sm px-1.5`,
height 20, min-width 20, centred. Static.

**Spinner** — `Loader2` with `animate-spin`, size 16, `role="status"` and `sr-only` text from prop
`label` (default `Loading`).

**Skeleton** — `{ className }`. `bg-sunken rounded-sm animate-breathe`, `aria-hidden`. The container that
holds skeletons has `aria-busy="true"` and an `sr-only` "Loading" text.

**StatusDot** — `{ state: 'online' | 'offline' | 'checking' }`. 8px circle as in 3.2. No animation.

**Tag** — `{ tone?: 'neutral' | 'success' | 'danger' | 'accent'; icon?: LucideIcon; children }`. Quiet
text tag, not a pill: height 20, `rounded-sm px-1.5 text-xs font-medium`. neutral `bg-sunken text-ink-2`;
success `bg-success-soft text-success`; danger `bg-danger-soft text-danger`; accent `bg-accent-soft
text-accent`. Static.

**CallNumber** — `{ doc?: Document; value?: string }`. Renders `callNumber(doc)` in Meta style inside a
`<span title="Call number">`. Renders nothing if neither prop resolves.

**RelevanceMeter** — `{ score: number; showLabel?: boolean }`. Uses `relevance(score)`. Three 4px by 12px
bars, gap 2px, radius 1px; filled bars `bg-ink-2`, empty bars `bg-line-strong`. Label after it in
`text-xs text-ink-2` (`Strong match`). Wrapper has `title={"Reranker score " + raw}` and
`aria-label={label}`. No percentages anywhere.

**Callout** — `{ tone: 'neutral' | 'danger' | 'success'; icon?: LucideIcon; title?: string; children;
actions?: ReactNode }`. `rounded-lg border border-line p-4 flex gap-3`; neutral `bg-sunken`; danger
`bg-danger-soft` with the icon and title in `text-danger`; success `bg-success-soft`. Body `text-base
text-ink`, title `font-medium`. Danger callouts have `role="alert"`; others `role="status"`.

**EmptyState** — `{ icon: LucideIcon; title: string; body?: ReactNode; action?: ReactNode }`. Left-aligned
(not centred) block, max-width 440, padding-y 40: icon size 20 in `ink-3`, title in Title style, body in
`text-base text-ink-2`, action 16 below. Used for empty, not-found and offline page states.

**Dialog** — built on the native `<dialog>` element with `showModal()` (gives focus trap, `Esc`, inert
background and top layer without a dependency). `{ open: boolean; onClose(): void; title: string;
description?: string; children; footer?: ReactNode; size?: 'sm' | 'md' }`. An effect calls
`showModal()`/`close()` when `open` changes; `onCancel` and `onClose` call `onClose`; a click whose target
is the `<dialog>` element itself (the backdrop) closes it. Panel: `bg-raised border border-line rounded-xl
shadow-3 p-6 animate-rise`, width `min(100vw - 32px, 440px)` (`md`: 560), title in Title style with
`aria-labelledby`, description `text-base text-ink-2`. Footer: right-aligned buttons, gap 8, primary action
last. On open, focus goes to the first element with `autoFocus` (the least destructive button). On close,
focus returns to the trigger (native behaviour). Body scroll is locked by the top layer.

**ConfirmDialog** — `{ open; onClose; title; body: ReactNode; confirmLabel: string; tone?: 'danger' |
'default'; onConfirm(): void | Promise<void> }`. Footer: `Cancel` (secondary, `autoFocus`) and the confirm
button (`danger` or `primary`), which shows `loading` while the promise is pending and closes on success;
on error the dialog stays open and shows a danger Callout with the error message above the footer.

**Toaster** — rendered once in `AppShell` and once in `Welcome`. Fixed bottom-right from `lg` (24px inset);
bottom-centre above the tab bar below `lg` (88px from the bottom). Container `role="region"
aria-label="Notifications"`; each toast `role="status"` (`role="alert"` for danger). Toast: `bg-raised
border border-line rounded-lg shadow-2 px-4 py-3 flex items-center gap-3 animate-rise`, max-width 400,
`text-base`. Leading icon by tone: `Check` (`text-success`), `AlertTriangle` (`text-danger`), `Info`
(`text-ink-3`). Optional ghost action button. Dismiss `IconButton` `X` ("Dismiss"). Auto-dismiss after
5s (8s with an action; danger toasts do not auto-dismiss); the timer pauses while hovered or focused.

### 4.3 Shell (`src/components/shell/`)

`AppShell`, `Sidebar`, `TopBar`, `TabBar`, `ConnectionStatus`, `OfflineBanner` are specified in 3.2.

**PageHeader** — `{ title: string; meta?: ReactNode; actions?: ReactNode }`. `h1` in Page title style,
meta line 4 below in Meta style, actions right-aligned on the title's baseline from `md`, stacked below on
smaller screens. Bottom margin 24. Loading: meta shows a `Skeleton` 160 by 12.

**DropOverlay** — listens on `window` for `dragenter/dragover/dragleave/drop` carrying files
(`dataTransfer.types` includes `Files`). While dragging: fixed full-screen layer `bg-overlay
animate-fade-in` with a centred card (`bg-raised rounded-xl shadow-2 border border-dashed
border-line-strong p-10`): `Upload` icon size 20, Title "Drop to import", body "Files are indexed on your
machine". On drop: `enqueueFiles([...files])`, navigate to `/import`. Offline: the card reads "The backend
is offline" / "Reconnect, then drop the files again" and drop does nothing. `Esc` or leaving the window
hides it.

### 4.4 CommandPalette (`src/components/shell/CommandPalette.tsx`)

Native `<dialog>` (same mechanics as Dialog), positioned 96px from the top (16px below `md`), width
`min(100vw - 32px, 600px)`, `bg-raised rounded-xl shadow-3 border border-line`, `animate-rise`.
- Input row: height 52, `Search` icon, borderless input `text-md`, placeholder "Ask a question or jump to",
  `Kbd` `Esc` on the right. `role="combobox" aria-expanded="true" aria-controls` → listbox,
  `aria-activedescendant` → the active option id.
- List: `role="listbox"`, max-height 400, scrolls. Section headings are `text-xs text-ink-3 px-3 pt-3 pb-1`
  (sentence case, `role="presentation"`). Option row: height 40, `px-3 gap-3 rounded mx-1.5`, icon, label
  (`truncate`), right-aligned meta (call number, date, or `Kbd ↵` on the active row).
- States: default; hover and active-descendant share one look, `bg-hover text-ink` (mouse move sets the
  active index); pressed `bg-active`. Arrow Up/Down move (wrapping), Home/End jump, Enter selects, Esc
  closes, Tab is trapped on the input.
- Loading (documents or history still loading): the Go to and Actions sections work immediately; the data
  sections show two `Skeleton` rows each.
- Empty (input matches nothing other than the Ask row): the Ask row alone is shown, nothing else.
- Error or offline: the data sections are omitted and a single disabled row reads "Backend offline:
  documents and history are unavailable". The Ask row is shown but disabled with meta "Offline".
- On select: close, then act. Closing restores focus to the trigger; a navigation moves focus to the new
  page's `h1`.

### 4.5 Ask (`src/pages/Ask.tsx`, `src/components/ask/`)

Layout: `PageHeader` is replaced on this page by a compact header (below). Structure top to bottom:
status/meta line, `h1`, `AskComposer`, then either `RecentQuestions` (idle) or the result area. From `xl`
the result area is two columns: left `AnswerSheet` (max 680), right `SourceList` (360, `position: sticky;
top: 24px`).

Page states (drive them from `askStore.status`, `classifyAnswer`, `useDocuments`, `useBackendStatus`):

| State | What renders |
|---|---|
| **Idle, library has documents** | Top padding 64 (`lg`). Meta line: `42 documents · 1,318 passages`. `h1` "Ask your library". Composer (large). Under it a caption: "Matches by meaning, not exact words". Then `RecentQuestions`. |
| **Idle, documents loading** | Meta line is a `Skeleton` 200 by 12. Composer enabled. `RecentQuestions` shows three row skeletons. |
| **Idle, library empty** | Meta line `0 documents`. Composer disabled. `EmptyState` icon `Inbox`, title "Your library is empty", body "Import a conversation or a file, then ask about it", action primary `ButtonLink` "Import" → `/import`. |
| **Offline** | `OfflineBanner` (from the shell). Composer disabled with placeholder "Backend offline". If a previous answer is in the store it stays visible and readable. |
| **Retrieving** (request sent, no token yet) | `h1` becomes the question (Title style, `text-ink`). Status line: `Spinner` + "Searching your library". `AnswerSheet` in skeleton (5 lines: 100%, 96%, 88%, 92%, 60% width, 14px tall, 16 gap). `SourceList` shows `topK` `SourceCard` skeletons. Composer shows `Stop`. |
| **Streaming** | Status line: `Spinner` + "Writing". Answer text streams with the caret. `SourceList` still skeleton, with caption "Sources are listed when the answer is complete". |
| **Done, normal answer** | Status line replaced by the meta row. Sources render. If every source is `weak`: a neutral Callout above the answer, icon `Info`: "Nothing in your library matches this closely. Treat the answer with care". |
| **Done, `empty-index`** | No answer sheet. `EmptyState` `Inbox`: "Nothing to search yet" / "The index is empty. Import a conversation or a file first" / `ButtonLink` "Import". |
| **Done, `no-key`** | No answer sheet. Neutral Callout, icon `Info`, title "No written answer", body "The backend has no Gemini key, so ReFound can only show the closest passages. Add `GEMINI_API_KEY` to `backend/.env` and restart the backend to get written answers". Sources render below it full width (max 680) under the label "Closest passages". The raw `[GEMINI_API_KEY not set] Top result: ...` text is never shown. |
| **Done, `llm-error`** | No answer sheet. Danger Callout, icon `AlertTriangle`, title "The answer could not be written", body "Gemini returned an error. The passages below were still found", then the detail in `font-mono text-xs text-ink-2` (clamped to 3 lines, full text in `title`), action secondary Button "Try again" (`RotateCw`). Sources render as in `no-key`. |
| **Done, zero sources but a normal answer** | Answer renders; the sources area shows caption "No passages were returned for this answer". |
| **Stopped** | Partial answer stays, caret removed. Meta row reads `Stopped`. Sources area: caption "Stopped before sources arrived". Action "Ask again". |
| **Failed** (`ApiError`) | Danger Callout: title "The question could not be sent", body = `error` message, action "Try again". If `kind === 'network'` the body is "The backend is not reachable" and the shell's offline banner will also appear. |

**AskComposer** — `{ size: 'lg' | 'md'; disabled?: boolean; }` (reads `askStore`).
A `<form role="search">` containing a `<textarea rows={1}>` that auto-grows to 4 lines (set height from
`scrollHeight` in the change handler, not with a transition), `aria-label="Question"`, placeholder "Ask a
question". Container: `bg-surface border border-control rounded-lg`, min-height 56 (`lg`) / 44 (`md`),
padding 8 with the textarea padded 8; text `text-lg` for `lg`, `text-md` for `md`. Right side: when idle,
a primary IconButton `ArrowUp` ("Ask"); while retrieving or streaming, a secondary Button `Square` "Stop".
Bottom-left hint row inside the container at `lg` size only: `Kbd ↵` "to ask" · `Kbd Shift` `Kbd ↵` "for a
new line" in `text-xs text-ink-3` (hidden below `md`).
- Enter submits; Shift+Enter inserts a newline; submit is ignored when empty or whitespace.
- hover: border `ink-3`. focus-within: ring on the container (outline 2px `focus`, offset 0), textarea
  itself has no outline. disabled: `bg-sunken`, standard. Empty: the Ask button is disabled.
- The size is `lg` while idle and `md` once a question has been asked. After submit the textarea keeps the
  question text selected so typing replaces it.
- On submit: `ask(text)` and `navigate('/ask?q=' + encodeURIComponent(text), { replace: true })`. On page
  load with `?q=` and an idle store, prefill the textarea and do **not** auto-run (a reload must not re-bill
  a Gemini call).

**RecentQuestions** — `{ items: HistoryItem[] }` (first 5). Section label "Recent questions". A list in a
`surface` card with hairline dividers; each row is a button, height 44: `Clock` icon, the question
(`truncate`, `text-ink`), date in Caption style right. Click runs it again via `ask()`. Hover `bg-hover`.
Loading: three skeleton rows. Empty (no history): the section is not rendered. Error/offline: not rendered.

**AnswerSheet** — `{ answer: string; sourceCount: number | null; streaming: boolean; onCiteHover?(n:
number | null): void; activeCite?: number | null }`.
`article`, `bg-surface border border-line rounded-lg`, padding 24 (`md`: 32), `animate-rise` on first
mount. Body is rendered by `AnswerBody`.
- **AnswerBody** lazy-loads `react-markdown` (`const Markdown = lazy(() => import('react-markdown'))`);
  the `Suspense` fallback renders the same text as plain paragraphs split on blank lines, so there is no
  flash of empty content. Input is `linkCitations(answer, sourceCount)`.
- Element mapping (pass as `components`): `p` → Reading style, margin-bottom 16; `strong` → `font-medium`;
  `em` → italic; `ul`/`ol` → Reading style, padding-left 24, `list-disc`/`list-decimal`, items gap 8;
  `h1`–`h6` → `font-sans text-md font-medium`, margin 24 top / 8 bottom (the model's headings must not
  outrank the page); `code` inline → `font-mono text-sm bg-sunken rounded-sm px-1`; `pre` → `font-mono
  text-sm bg-sunken rounded p-4 overflow-x-auto`; `blockquote` → left border 2px `line-strong`, padding-left
  16, `text-ink-2`; `a` with `href` starting `#source-` → `CitationMark`; any other `a` → `text-accent
  underline underline-offset-2` with `target="_blank" rel="noreferrer noopener"`; `img` → not rendered
  (return the alt text). `hr` → 1px `line`. Do not enable raw HTML.
- Streaming caret: a 2px by 20px `bg-accent` inline block after the last character with `animate-breathe`,
  `aria-hidden`.
- Accessibility: the sheet has `aria-live="off"` (token-by-token announcements are noise). A separate
  `sr-only` `role="status"` node next to it announces "Searching your library", "Writing the answer",
  "Answer ready, {n} sources" once per state change.
- Footer meta row (only when `done` or `stopped`), 16 above a top hairline: Meta text `5 passages · 2.4 s`
  (or `Stopped`), then right-aligned ghost Buttons: `Copy` "Copy" (copies the answer text without citation
  markers; label becomes "Copied" with `Check` for 2s and a toast is **not** shown), `RotateCw` "Ask again".

**CitationMark** — `{ n: number; active: boolean; interactive: boolean }`. Inline superscript-height chip:
`font-mono text-xs text-accent bg-transparent rounded-sm px-1 align-baseline` showing the number.
Interactive (sources known): a link to `#source-{n}`; hover and `active` → `bg-accent-soft`; click scrolls
the matching `SourceCard` into view (`scrollIntoView({ block: 'nearest' })`) and moves focus to it.
Non-interactive (still streaming): plain `span`, same look, no hover. Accessible name "Source {n}".

**SourceList** — `{ sources: Source[] | null; loadingCount: number; question: string; label?: string;
activeCite: number | null; onHover(n | null) }`. An `ol` with section label (default "Sources") and gap 12.
`null` → `loadingCount` skeleton cards. `[]` → the caption from the page-state table.

**SourceCard** — `{ index: number; source: Source; doc?: Document; terms: string[]; active?: boolean }`.
`li id="source-{index}" tabIndex={-1}`, `bg-surface border border-line rounded-lg p-4`.
- Row 1: the index in a 20px `font-mono text-xs text-accent` box, the title (`sourceTitle`, `font-medium
  text-base truncate`), and right-aligned `CallNumber` when `doc` matched.
- Row 2: `RelevanceMeter` with label · source-type label (`SOURCE_TYPES[doc.source_type].label`, omitted if
  no `doc`) in `text-xs text-ink-2`.
- Row 3: the excerpt. `splitSpeaker(cleanText(source.excerpt))`; if a speaker exists show it as a Caption
  line above. Excerpt text in `font-serif text-md text-ink-2`, with `highlight(text, terms)` rendering
  `<mark>`, clamped to 4 lines (`line-clamp-4`). A ghost `sm` Button "Show more" / "Show less" toggles the
  clamp, shown only when the text overflows (compare `scrollHeight` and `clientHeight` in a layout effect
  that sets a ref-backed flag via a `ResizeObserver` callback, not during render). The backend truncates
  excerpts at 300 characters; when `excerpt.length === 300` append `…`.
- Row 4 (only when `doc` matched): a ghost link "In library" (`ChevronRight` on the right) →
  `/library?q={title}`; and for URL imports an IconButton `ExternalLink` "Open the original share link"
  (`target="_blank"`).
- hover: border `line-strong`. `active` (its citation is hovered or it was just focused from a citation):
  `bg-accent-soft` and border `accent`. focus (programmatic): ring. No translate on hover.
- Skeleton variant: same box; rows are `Skeleton` 60% by 14, 30% by 12, then three full-width 12px lines.
- Deleted document (no `doc`): title falls back per `sourceTitle`; row 4 is omitted and row 2 ends with
  "no longer in library" in `text-xs text-ink-3` (only when documents have loaded).

**SeenBefore** — `{ item: { question: string; when: Date | null; href: string }; basis: 'wording' |
'server' }`. A neutral Callout above the answer, icon `History`: "You asked something close to this on
14 Nov 2026" with a secondary `sm` ButtonLink "Open that answer" → `/history/{id}`. Second line in Caption
style when `basis === 'wording'`: "Matched by wording against your recent questions". Rendered when
`findAskedBefore(question, historyBeforeThisRun)` returns an item (computed once at submit time from the
cached history, so the new run never matches itself). `basis: 'server'` is the hook for the Similar Problem
Detector (section 6).

### 4.6 Library (`src/pages/Library.tsx`, `src/components/library/`)

`PageHeader` title "Library", meta `42 documents · 1,318 passages`, action primary `ButtonLink` icon `Plus`
"Import".

**LibraryToolbar** — one row (wraps below `md`): `TextField` (hidden label "Filter by title", leading icon
`Search`, placeholder "Filter by title", width 280, value synced to `?q=`), `SegmentedControl` label
"Type" with options `All`, `Chats`, `Notes`, `PDFs`, `Images` each with its count, and right-aligned
`Select` label "Sort" with `Newest first`, `Oldest first`, `Title A to Z`. Type and sort are kept in
`?type=` and `?sort=` (defaults omitted from the URL).

**DocumentList** — a `surface` card (`rounded-lg border border-line`) containing a header row and rows
separated by hairlines. From `md` it is a real `<table>` with columns: Title (flex), Call number (112),
Passages (88, right-aligned), Imported (120), Status (104), actions (44). Header cells: `text-xs
text-ink-3 font-normal`, height 36, `scope="col"`. Below `md` each row is a two-line block: title, then a
Meta line `GPT-0042 · 34 passages · 14 Nov 2026`, with the status tag and the delete button on the right.

**DocumentRow** — `{ doc: Document; onDelete(doc): void; deleting: boolean }`. Row height 60.
- Title cell: type icon (`ink-3`), then `displayTitle(doc)` (`text-ink truncate`, `title` attribute with
  the full text) and under it `originLabel(doc)` in `text-xs text-ink-3 truncate`; for URL imports the
  origin is a link opening the share page in a new tab.
- Passages: `formatCount(chunk_count)`, Meta style. Imported: `formatDate`, with `title` =
  `formatDateTime`.
- Status: `indexed` → the word "Indexed" as plain `text-xs text-ink-3` text, no tag (the normal case
  stays quiet); `pending` → `Tag` neutral with `Spinner` "Indexing"; `error` → `Tag`
  danger "Failed", and the row gains a third line under the title in `text-xs text-danger`:
  `cleanText(doc.error_message)` or "Indexing failed", followed by "Delete it, then import the file again".
- Actions: IconButton `Trash2` "Delete {title}". From `lg` it is visible on row hover **and** on row
  focus-within (`opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100`);
  below `lg` it is always visible.
- hover: `bg-hover`. The row itself is not clickable. `deleting`: row at `opacity-50`, `aria-busy`, the
  delete button replaced by `Spinner`.
- Delete flow: `ConfirmDialog` tone danger, title `Delete "{title}"?`, body "Its 34 passages are removed
  from the index. Past answers that cited it keep their text. This cannot be undone", confirm "Delete".
  Success: toast success `Deleted "{title}"`. Failure: the dialog shows the error.

Page states:
| State | Render |
|---|---|
| Loading | Header meta skeleton; toolbar disabled; 8 skeleton rows (icon 16, title bar 40% by 14 over 24% by 12, then 64/40/72 px bars in the columns). |
| Empty library | Toolbar hidden. `EmptyState` `Inbox`: "Nothing in your library yet" / "Import ChatGPT or Claude conversations, notes, PDFs or images. They are indexed on this machine" / primary "Import". |
| No filter results | Toolbar stays. Inside the card: `EmptyState` `SearchX`: "No documents match" / `Nothing matches "{q}" in {type label}` / ghost Button "Clear filters". |
| Error | Danger Callout: "The library could not be loaded" + message + secondary "Try again" (refetch). |
| Offline | Shell banner. If cached data exists, show it with every delete button disabled; otherwise `EmptyState` `Unplug`: "Backend offline" / "Your library is stored with the backend. Reconnect to see it". |
| Refreshing in background | No UI change. |

### 4.7 Import (`src/pages/Import.tsx`, `src/components/import/`)

`PageHeader` title "Import", meta "Files and links are parsed and indexed on your machine". Layout from
`lg`: two columns, left (max 560) `Dropzone`, `ShareLinkField`, `FormatsTable`; right (flex) `ImportQueue`.
Below `lg`: Dropzone, ShareLinkField, ImportQueue, FormatsTable.

**Dropzone** — `{ disabled?: boolean }`. A region `rounded-lg border border-dashed border-line-strong
bg-surface p-8` with: `Upload` icon size 20 (`ink-3`), "Drop files here" (`text-md font-medium`),
"Several at once is fine. Each file becomes one document" (`text-sm text-ink-2`), then two buttons:
secondary Button icon `Plus` "Choose files" (opens `<input type="file" multiple
accept=".json,.md,.markdown,.txt,.pdf,.png,.jpg,.jpeg,.gif,.webp,.bmp">`) and ghost Button icon
`FolderOpen` "Choose a folder" (opens `<input type="file" multiple>` with the `webkitdirectory` attribute
set through a ref; files are filtered to `SUPPORTED_EXTENSIONS`, dotfiles dropped). The zone is **not** a
click target itself (two explicit buttons are keyboard-reachable and unambiguous).
- drag-over (files over the zone): `bg-accent-soft border-accent`, text "Release to import".
- hover: none on the zone; buttons have their own. focus: on the buttons.
- disabled/offline: `bg-sunken`, buttons disabled, text "Reconnect to the backend to import".
- A folder with more than 50 supported files opens a `ConfirmDialog`: title "Import 214 files?", body
  "They are indexed one at a time. You can keep using ReFound while it runs", confirm "Import 214 files".
- A folder with no supported files: inline `text-sm text-danger` "No supported files in that folder".

**ShareLinkField** — section label "ChatGPT share link". A `TextField` (hidden label "ChatGPT share link",
leading icon `Link2`, placeholder `https://chatgpt.com/share/…`, `type="url"`, `inputMode="url"`) with a
primary Button "Import link" beside it (stacked below `sm`). Hint: "Use Share, then Copy link, in
ChatGPT". Submit on Enter. Validation runs on submit through `parseShareLink`:
| Input | Inline error |
|---|---|
| empty | (button disabled) |
| not a URL, or not `https` | "Paste a link that starts with https://chatgpt.com/share/" |
| host `claude.ai` (any path) | "Claude share links are not supported yet. Upload your Claude data export (conversations.json) instead" |
| ChatGPT host with path `/c/…` | "That is a private conversation link. In ChatGPT use Share, then Copy link" |
| host not in `chatgpt.com`, `www.chatgpt.com`, `chat.openai.com`, or path not `/share/<id>` or `/s/<id>` | "Only public ChatGPT share links can be imported" |
Valid → `enqueueUrl(url)`, clear the field, keep focus in it. Server-side failures show on the queue item.
States: default, hover, focus, error (as TextField), disabled when offline. There is no Claude-link wording
except the single error above.

**ImportQueue** — section label "This session", with a ghost `sm` Button "Clear finished" when any item is
finished. Above the list, while running: a 4px progress bar (`bg-sunken` track, `bg-ink-2` fill,
`rounded-full`, `role="progressbar"` with `aria-valuenow/max`) and Meta text `3 of 12`. The fill width is
the count of finished items over the total: a real, countable quantity. There is **no per-file percentage**
(`fetch` exposes no upload progress and indexing is one synchronous server call).
- Empty: `text-sm text-ink-3` "Imports from this session appear here".
- The queue lives in `importQueue` store, so it keeps running and stays listed when the user leaves the
  page. It is not persisted across reloads.

**ImportQueueItem** — `{ item }`. Row min-height 52 in a `surface` card with hairlines: type icon, label
(file name, or `originLabel` for a link; `truncate`), detail line, and right-aligned action.
| Status | Detail line | Right side |
|---|---|---|
| `queued` | "Waiting" (`ink-3`) | IconButton `X` "Remove from queue" |
| `working` | `Spinner` + "Reading and indexing" (files) / "Fetching the conversation" (links) | none |
| `done` | `Check` in `text-success` + `Indexed as "{title}" · 34 passages` | ghost link "In library" |
| `duplicate` | `Info` + `Already in your library as "{title}"` | ghost link "In library" |
| `duplicate` and that document's status is `error` | `AlertTriangle` (`text-danger`) + "This failed before. Delete the failed entry in Library, then import again" | ghost link "In library" |
| `failed` | `AlertTriangle` + the `ApiError` message, `text-danger`, wraps up to 3 lines | secondary `sm` Button "Retry" |
| `skipped` | "Skipped: unsupported type (.docx)" (`ink-3`) | IconButton `X` "Dismiss" |
A `role="status"` `sr-only` node announces each completion ("{label}: indexed, 34 passages").

**FormatsTable** — section label "What you can import". A two-column definition list in a `surface` card
(left column 140, `font-medium`; right column `text-ink-2`):
- ChatGPT — "A public share link, or `conversations.json` from a ChatGPT data export"
- Claude — "`conversations.json` from a Claude data export. Share links are not supported yet"
- Notes — "Markdown and plain text: `.md` `.markdown` `.txt`"
- PDF — "`.pdf` files with selectable text"
- Images — "`.png` `.jpg` `.gif` `.webp` `.bmp`, described by Gemini. Needs a Gemini key on the backend"
File extensions are in `font-mono text-sm`. Static; no states.

### 4.8 History (`src/pages/History.tsx`, `src/components/history/`)

`PageHeader` title "History", meta `23 questions` (when the list length equals the request limit of 100:
`Most recent 100 questions`). From `lg`: master-detail, list column 400 and detail column flex (max 680),
gap 40, detail sticky. Below `lg`: `/history` shows the list; `/history/:id` shows the detail with a ghost
`ButtonLink` `ArrowLeft` "History" above it.

**HistoryList** — a `TextField` (hidden label "Filter questions", icon `Search`, placeholder "Filter
questions") then rows grouped under day headings (`formatDayHeading`, section-label style). Arrow Up/Down
move between rows when one is focused.

**HistoryRow** — `{ item: HistoryItem; selected: boolean }`. A router `Link` to `/history/{id}`, min-height
60, `rounded px-3 py-2`: line 1 the question (`text-ink`, clamp 2 lines), line 2 Meta `09:12 · 5 sources ·
2.4 s` (omit parts that are null). hover `bg-hover`; selected `bg-active` with the 2px accent bar at left
and `aria-current="true"`; focus-visible ring.

**HistoryDetail** — `{ item }`. The question as `h2` in Title style; Caption line `formatDateTime`; then
the stored answer rendered through the same `classifyAnswer` → `AnswerSheet` (not streaming) or Callout
path as the Ask page; then `SourceList` (sources matched against current documents; deleted ones are
marked as in 4.5). Actions row under the title: primary `sm` Button `RotateCw` "Ask again" (runs `ask()`
and goes to `/ask`), ghost `sm` Button `Copy` "Copy answer".
- `answer` null or empty: Callout neutral "No answer was saved for this question".
- `sources` null: treated as `[]`.
- When `similar_problems` is a non-empty array, render the provisional `SeenBefore` list (section 6).

Page states:
| State | Render |
|---|---|
| Loading | 6 skeleton rows (two bars each); detail column: title skeleton and 5 text lines. |
| Empty | `EmptyState` `Clock`: "No questions yet" / "Questions you ask are kept here with their answers and sources. They are saved when the backend has a Gemini key" / primary `ButtonLink` "Ask a question" → `/ask`. |
| No filter results | `EmptyState` `SearchX`: "No questions match" / ghost "Clear filter". |
| Nothing selected (`lg`, `/history`) | The first item is shown in the detail column and marked selected (no redirect). |
| `:id` not in the loaded list | Detail column: `EmptyState` `SearchX`: "That question is not in your recent history" / ghost `ButtonLink` "Back to history". |
| Error | Danger Callout "History could not be loaded" + message + "Try again". |
| Offline | Shell banner; cached list stays readable, "Ask again" disabled; with no cache: `EmptyState` `Unplug` "Backend offline" / "History is stored with the backend. Reconnect to see it". |

### 4.9 Settings (`src/pages/Settings.tsx`, `src/components/settings/`)

`PageHeader` title "Settings", meta "Saved in this browser". Max width 720. Sections are separated by 40px
and a hairline; each has an `h2` in Title style and an `id` for deep links (`#appearance`, `#connection`,
`#answers`, `#planned`, `#about`).

**SettingRow** — `{ label: string; description?: ReactNode; children }`. Grid: label and description left
(max 320; label `font-medium`, description `text-sm text-ink-2`), control right. Stacks below `md`.

1. **Appearance** — row "Theme", description "System follows your device". `SegmentedControl` options
   `System` (`Monitor`), `Light` (`Sun`), `Dark` (`Moon`). Applies immediately.
2. **Connection** — a status line: `StatusDot` + "Connected to localhost:8000" / "Offline: nothing answers
   at localhost:8000" / "Checking localhost:8000". Then **ConnectionForm**: `TextField` label "Backend
   address", `type="url"`, hint "Where the ReFound backend runs. The default is http://localhost:8000", and
   a primary Button "Connect". Submit tests the typed address with `healthCheck`; while testing the button
   is `loading` with label "Connecting". Success: `setBackendUrl`, toast success "Connected to {host}".
   Failure: the stored address is **not** changed and the field shows the error "Nothing answered at
   {url}", followed by **ConnectionHelp** (below). Invalid URL: "Enter an address such as
   http://localhost:8000". A ghost Button "Reset to default" appears when the field differs from the
   default.
3. **Answers** — row "Passages per answer", description "How many passages are sent to Gemini and listed
   as sources. More gives broader context and slower answers". `Stepper` min 1, max 10. Stored with
   `setTopK`; used by the next question (this setting is ignored today: fixed in section 7).
4. **Planned** — `PlannedList`, section 6.
5. **About** — plain text block:
   "ReFound keeps your documents and the search index with the backend on this machine, in a SQLite
   database and FAISS index files. When the backend has a Gemini key, each question and the passages
   retrieved for it are sent to Google's Gemini API to write the answer. Without a key nothing leaves this
   machine and you get passages only."
   Then links (`text-accent underline underline-offset-2`): "Source on GitHub" →
   `https://github.com/rayyan-projects/refound`; "Backend API reference" → `{backendUrl}/api/docs` (only
   when online). Then a "Keyboard shortcuts" definition list rendered with `Kbd`: `⌘K` Search or jump ·
   `/` Focus the question box · `Esc` Stop the answer or close a dialog · `g` then `a`/`l`/`i`/`h`/`s` Go
   to Ask, Library, Import, History, Settings. No version number is shown (the frontend, backend and old
   UI each claim a different one).

**ConnectionHelp** — `{ url: string }`. A neutral Callout titled "If the backend is not running" with an
ordered list:
1. "Start it:" followed by a code block (`font-mono text-sm bg-sunken rounded p-3`, with a ghost `sm`
   Button `Copy` "Copy"): `cd backend` / `uvicorn main:app --reload --port 8000`
2. "If it runs on another address or port, enter that address above"
3. Only when `window.location.origin !== 'http://localhost:5173'`: "This page is served from
   {origin}. Set `FRONTEND_ORIGIN={origin}` in `backend/.env` and restart the backend, or the browser will
   block the connection"
4. Only when the page is `https:` and the address is `http:` and not localhost/127.0.0.1: "Browsers block
   an https page from calling an http address. Use localhost, or serve the backend over https"

### 4.10 Welcome (`src/pages/Welcome.tsx`, `src/components/welcome/`)

No shell. `bg-canvas`, min-height `100dvh`. A simple top row (height 56, page padding): wordmark left,
theme `IconButton` right (cycles light/dark; icon `Sun`/`Moon`, label "Switch to dark theme" / "Switch to
light theme"). Content: max width 1120, two columns from `lg` (5/12 and 7/12, gap 64, vertically centred in
the remaining height); stacked below `lg` with the example second.

Left column:
- `h1` Display: "Find what you already worked out"
- Paragraph (`text-md text-ink-2`, max 440): "ReFound searches your past ChatGPT and Claude conversations,
  notes and PDFs, and answers from them with the passages it used. Everything is indexed on your machine"
- **ConnectCard** (24 below): `surface` card, `rounded-lg border border-line p-5`. `TextField` label
  "Backend address" (prefilled from settings) + primary `lg` Button "Connect". Uses the same logic as
  ConnectionForm; on success navigate to `/ask`.
  - checking (first health check on load): the button is `loading`, label "Looking for the backend", field
    read-only.
  - online: `Navigate` to `/ask` (replace). Welcome never flashes for a connected user: while the very
    first check is pending (max 3s timeout already in `healthCheck`), render only the top row and a
    `Skeleton` in place of the columns.
  - offline (default view): field and button enabled; under the field, Caption "No backend found at
    localhost:8000 yet".
  - failed after pressing Connect: field error + `ConnectionHelp`.
- Three facts, 32 below, as a plain list with hairline dividers (`text-sm`; label `font-medium text-ink`,
  text `text-ink-2`): "Imports" — "ChatGPT share links and exports, Claude exports, Markdown, text, PDFs,
  images" · "Answers" — "Written by Gemini from your own passages, with the sources listed" · "Storage" —
  "A local SQLite database and FAISS index. No account"

Right column — **ExampleSheet**: the real `AnswerSheet` and two real `SourceCard`s (non-interactive,
`aria-hidden="true"`, `inert`), composed as on the Ask page at reduced scale (wrap in a container of fixed
width 560 with `pointer-events-none`), under a Caption "Example". Content is hard-coded in
`src/components/welcome/exampleContent.ts` and is deliberately different from the test fixtures:
- Question: "Why did the nightly backup job keep timing out?"
- Answer: "The job was not slow, it was waiting. Your notes from March trace the timeouts to the backup
  running at 02:00, the same minute as the log rotation, so both fought over the disk [1]. You moved the
  backup to 03:30 and added a 15 minute lock timeout, and the failures stopped [2]."
- Source 1: title "Backup job timeouts", call number `GPT-0007`, Strong match, speaker "ChatGPT", excerpt
  "Both cron entries fire at 02:00. Log rotation compresses about 9 GB while the backup reads the same
  volume, which is why the backup stalls rather than fails outright."
- Source 2: title "ops-notes.md", call number `MD-0003`, Partial match, excerpt "Moved backup to 03:30.
  Added flock with a 15 minute timeout so a stuck run cannot block the next night."
Highlight terms come from `queryTerms(question)` like everywhere else. This is the only illustrative content in the production
bundle and it is labelled.

### 4.11 NotFound (`src/pages/NotFound.tsx`)

Inside the shell. `EmptyState` `SearchX`: "This page does not exist" / "The address may be mistyped, or the
page has moved" / primary `ButtonLink` "Go to Ask".

---

## 5. Realistic fixture content

### 5.1 Mechanism (one, and only one)

Fixtures are JSON files in `frontend/fixtures/`, **outside `src`**, served by a small mock backend:
`frontend/scripts/mock-backend.cjs` (Node `http`, no dependencies). The app talks to it over HTTP exactly as
it talks to the real backend, by setting the backend address to `http://127.0.0.1:8787`.

- Nothing under `src/` imports from `fixtures/` or `scripts/`. The production bundle therefore contains no
  fixture data, and no "demo mode" exists in the app. `scripts/check-dist.cjs` enforces this (5.4).
- Uses: local UI development without the Python backend (`npm run mock`, then Connect to
  `http://127.0.0.1:8787`), demos, and the Playwright verification script (`npm run verify`).
- Every fixture JSON file has a top-level `"_fixture": "refound-fixture-data"` key (files are objects with
  a `data` key holding the payload) so the sentinel is greppable. Every payload shown in 5.3 is the value
  of `data`.
- The mock sends `Access-Control-Allow-Origin: *`, answers `OPTIONS` with 204 and the usual allow headers,
  and logs each request to stdout.

`package.json` scripts to add: `"mock": "node scripts/mock-backend.cjs"`, `"verify": "node
scripts/verify.cjs"`, `"check": "node scripts/check-dist.cjs"`.

### 5.2 Mock backend scenarios

Set with `node scripts/mock-backend.cjs --scenario <name>` or at runtime with
`POST /__scenario {"name": "<name>"}`. Default port 8787 (`PORT` env overrides).

| Scenario | Behaviour |
|---|---|
| `default` | All fixtures below. Query streams tokens 40ms apart, then the final line. Import of a file answers after 900ms with `import-ok.json` (title = the uploaded file name without extension); import-url answers with `import-url-ok.json`. Delete answers `{"status":"deleted","document_id":<id>}` and removes the document for the rest of the process. |
| `empty` | Documents `[]`, history `[]`. Query returns the empty-index stream. |
| `empty-index` | Documents and history from `default`; query returns `ask-empty.json` (the composer is enabled, the index answers as empty). |
| `slow` | Every GET is delayed 4000ms (for skeleton screenshots). |
| `error` | `GET /api/documents/` and `GET /api/query/history` answer 500 `{"detail":"database is locked"}`. `POST /api/query/` answers 500 `{"detail":"Internal Server Error"}`. |
| `nokey` | Query streams one token `[GEMINI_API_KEY not set] Top result: ` + the first source's excerpt, then the final line with the default sources. History `[]`. |
| `llm-error` | Query streams one token `Error generating answer: 404 NOT_FOUND. models/gemini-1.5-flash is not found for API version v1beta`, then the final line with the default sources. |
| `stream-hold` | Query sends the first 14 tokens, then keeps the connection open without sending more (until the client aborts). |
| `retrieve-hold` | Query accepts the request and sends nothing (until the client aborts). |
| `weak` | Query returns `ask-weak.json` (all sources weak). |
| `import-fail` | File import answers 422 `{"detail":"Parse error: Expecting value: line 1 column 1 (char 0)"}`; import-url answers 403 `{"detail":"This shared conversation is private or has been deleted"}`. |
| `import-duplicate` | Both imports answer `import-duplicate.json`. |
| `validation` | `POST /api/documents/import-url` answers 422 `{"detail":[{"loc":["body","url"],"msg":"Field required","type":"missing"}]}`. |
| `future` | As `default`, plus the provisional fields of section 6: documents gain `topics` and `summary`, the final stream line and history items gain `similar_problems`. Proves the hidden surfaces render. |

"Offline" needs no scenario: point the app at a closed port (`http://127.0.0.1:8788`).

### 5.3 Fixture files

All dates are naive UTC strings, exactly as the backend emits them. The library belongs to one plausible
person: a backend developer who also keeps a few personal notes.

`fixtures/documents.json` → `data` (12 documents, 784 passages in total, newest first):

```json
[
  { "id": 42, "filename": "https://chatgpt.com/share/6741f3c2-8a14-8005-b6d1-0c9e4f7a21bb", "source_type": "chatgpt_share", "title": "Postgres deadlock on concurrent upserts", "created_at": "2026-11-14T09:12:44.512339", "chunk_count": 34, "status": "indexed", "error_message": null },
  { "id": 41, "filename": "conversations.json", "source_type": "claude", "title": "conversations.json", "created_at": "2026-11-12T18:40:03.118204", "chunk_count": 212, "status": "indexed", "error_message": null },
  { "id": 40, "filename": "designing-data-intensive-applications-ch7.pdf", "source_type": "pdf", "title": "designing-data-intensive-applications-ch7", "created_at": "2026-11-09T21:05:17.650112", "chunk_count": 96, "status": "indexed", "error_message": null },
  { "id": 39, "filename": "docker-notes.md", "source_type": "markdown", "title": "Docker build cache notes", "created_at": "2026-11-03T07:58:29.004871", "chunk_count": 18, "status": "indexed", "error_message": null },
  { "id": 38, "filename": "https://chatgpt.com/share/672b9e10-4c7c-8005-9f3a-5d2e7b1c8842", "source_type": "chatgpt_share", "title": "Why is my FAISS recall dropping after deletes", "created_at": "2026-10-28T14:22:51.337419", "chunk_count": 27, "status": "indexed", "error_message": null },
  { "id": 37, "filename": "whiteboard-auth-flow.png", "source_type": "image", "title": "whiteboard-auth-flow", "created_at": "2026-10-21T10:15:08.902233", "chunk_count": 2, "status": "indexed", "error_message": null },
  { "id": 36, "filename": "interview-prep.txt", "source_type": "txt", "title": "interview-prep.txt", "created_at": "2026-10-19T16:44:10.220915", "chunk_count": 41, "status": "indexed", "error_message": null },
  { "id": 35, "filename": "chatgpt-export-2026-10.json", "source_type": "chatgpt", "title": "Rust lifetimes in async closures", "created_at": "2026-10-12T08:03:55.781002", "chunk_count": 318, "status": "indexed", "error_message": null },
  { "id": 34, "filename": "lease-agreement-2026.pdf", "source_type": "pdf", "title": "lease-agreement-2026", "created_at": "2026-10-05T19:31:02.114760", "chunk_count": 0, "status": "error", "error_message": "No chunks produced from document" },
  { "id": 33, "filename": "sourdough-log.md", "source_type": "markdown", "title": "Sourdough log", "created_at": "2026-09-27T06:20:41.563008", "chunk_count": 12, "status": "indexed", "error_message": null },
  { "id": 32, "filename": "https://chatgpt.com/share/66f1a0b7-2d3c-8005-a1e9-7c4b6d5e3f10", "source_type": "chatgpt_share", "title": "", "created_at": "2026-09-20T22:47:15.090344", "chunk_count": 9, "status": "indexed", "error_message": null },
  { "id": 31, "filename": "nginx-reverse-proxy.md", "source_type": "markdown", "title": "Reverse proxy checklist", "created_at": "2026-09-14T13:02:36.447120", "chunk_count": 15, "status": "indexed", "error_message": null }
]
```

This set deliberately covers: a share link with a real title (id 42), a share link with an empty title
(id 32 → "Shared conversation"), a multi-conversation Claude export whose title is its filename (41), a
failed document (34), an image (37), and a text file whose title equals its filename (36 → no origin line).
Expected call numbers: `GPT-0042`, `CLD-0041`, `PDF-0040`, `MD-0039`, `GPT-0038`, `IMG-0037`, `TXT-0036`,
`GPT-0035`, `PDF-0034`, `MD-0033`, `GPT-0032`, `MD-0031`.

`fixtures/ask-default.json` → `data` (question: `How did I fix the Postgres deadlock?`):

```json
{
  "tokens": ["You fixed it by making every transaction take its row locks in the same order. ", "The deadlock came from two workers upserting the same rows in different orders [Memory 1]. ", "You sorted each batch by primary key before the `INSERT ... ON CONFLICT`, ", "cut the batch size from 5000 to 500, ", "and added a retry on SQLSTATE `40P01` with jitter, three attempts at most [Memory 2].", "\n\n", "Your notes on the book chapter explain why the retry is still needed: ", "the database breaks a lock cycle by aborting one transaction, ", "and the application has to run it again [Memory 3]."],
  "final": {
    "sources": [
      { "source": "Postgres deadlock on concurrent upserts", "filename": "https://chatgpt.com/share/6741f3c2-8a14-8005-b6d1-0c9e4f7a21bb", "score": 6.2143, "excerpt": "[ASSISTANT]\nThe deadlock comes from two transactions upserting the same set of rows in a different order\\. Each takes a row lock the other needs. Sort the batch by primary key before the INSERT ... ON CONFLICT so every transaction acquires its locks in the same order." },
      { "source": "Postgres deadlock on concurrent upserts", "filename": "https://chatgpt.com/share/6741f3c2-8a14-8005-b6d1-0c9e4f7a21bb", "score": 4.0412, "excerpt": "[USER]\nSorting fixed it in staging. I also dropped the batch size from 5000 to 500 and added a retry on SQLSTATE 40P01 with jitter, three attempts max. My pick\\: keep the retry even if the sort holds up." },
      { "source": "designing-data-intensive-applications-ch7", "filename": "designing-data-intensive-applications-ch7.pdf", "score": 1.3077, "excerpt": "Deadlocks arise when transactions wait on each other in a cycle. The database detects the cycle and aborts one of them so that the others can make progress; the aborted transaction must be retried by the application." },
      { "source": "conversations.json", "filename": "conversations.json", "score": -0.4127, "excerpt": "[CLAUDE]\nFor the migration, take an advisory lock first so only one worker runs it. pg_advisory_xact_lock releases at commit, which is what you want here." },
      { "source": "Docker build cache notes", "filename": "docker-notes.md", "score": -5.6402, "excerpt": "Order the Dockerfile so dependency installation comes before copying the source. The lockfile changes rarely, so that layer stays cached." }
    ],
    "duration_ms": 2412.37
  }
}
```

The mock splits each `tokens` entry further into words before streaming, so the stream has about 80 lines.
Expected rendering: match labels Strong, Strong, Strong, Partial, Weak (scores 6.21 and 4.04 are the values
that used to show as `621%`/`404%`; -5.64 as `-564%`); three citation marks; speaker captions ChatGPT, You,
none, Claude, none; no backslashes (`order.` and `My pick:`); highlighted terms `postgres`, `deadlock`
(from the question; note `fixed` is not highlighted in "fix", which is correct).

`fixtures/ask-weak.json` → `data` (question: `What did the lease say about the notice period?`):
tokens `["The memories do not contain enough information to answer this. ", "Nothing retrieved mentions a lease or a notice period."]`,
sources: `{ "source": "interview-prep.txt", "filename": "interview-prep.txt", "score": -7.9031, "excerpt": "Notice how the question asks for trade-offs, not a single answer. Give a period of thinking time before you start drawing." }`
and `{ "source": "Sourdough log", "filename": "sourdough-log.md", "score": -9.1158, "excerpt": "Day 6. Fed at 08:10, 1:5:5. Doubled in a little under five hours at 24 C. Rest period before shaping was too short again." }`,
`duration_ms` 1876.02.

`fixtures/ask-empty.json` → tokens `["No relevant memories found. Import some documents first."]`, final
`{ "sources": [], "duration_ms": 41.8 }`.

`fixtures/history.json` → `data` (newest first):

```json
[
  { "id": 118, "query_text": "How did I fix the Postgres deadlock?", "answer": "<the joined tokens of ask-default.json>", "sources": "<the sources of ask-default.json>", "similar_problems": [], "created_at": "2026-11-15T20:14:09.441208", "duration_ms": 2412.37 },
  { "id": 117, "query_text": "What was the trick for keeping the Docker layer cache warm?", "answer": "Install dependencies before you copy the source. Your notes say the lockfile changes rarely, so the dependency layer stays cached and only the final copy and build re-run [Memory 1]. You also pinned the base image by digest so a new upstream tag would not invalidate everything [Memory 2].", "sources": [ { "source": "Docker build cache notes", "filename": "docker-notes.md", "score": 7.0518, "excerpt": "Order the Dockerfile so dependency installation comes before copying the source. The lockfile changes rarely, so that layer stays cached." }, { "source": "Docker build cache notes", "filename": "docker-notes.md", "score": 3.3391, "excerpt": "Pin the base image by digest, not by tag. A moving tag silently busts every layer above it." } ], "similar_problems": [], "created_at": "2026-11-15T08:02:31.207754", "duration_ms": 1630.9 },
  { "id": 116, "query_text": "why does faiss recall drop after I delete documents", "answer": "Because the index was rebuilt and the row numbers shifted while your code still used the old ones. The conversation concludes that a flat index has no in-place delete, so every delete rebuilds it, and any stored row id goes stale [Memory 1]. The fix you settled on was to keep a separate list that maps each row to a chunk id and rebuild that list together with the index.", "sources": [ { "source": "Why is my FAISS recall dropping after deletes", "filename": "https://chatgpt.com/share/672b9e10-4c7c-8005-9f3a-5d2e7b1c8842", "score": 5.4876, "excerpt": "[ASSISTANT]\nIndexFlatIP cannot remove vectors in place. If you rebuild it without the deleted rows, every later row moves up, so any row number you stored earlier now points at a different vector." } ], "similar_problems": [], "created_at": "2026-11-13T17:45:52.918340", "duration_ms": 2048.44 },
  { "id": 115, "query_text": "What did the lease say about the notice period?", "answer": "The memories do not contain enough information to answer this. Nothing retrieved mentions a lease or a notice period.", "sources": "<the sources of ask-weak.json>", "similar_problems": [], "created_at": "2026-11-13T17:31:07.330019", "duration_ms": 1876.02 },
  { "id": 114, "query_text": "Rust: why can't I borrow across an await", "answer": "Error generating answer: 503 UNAVAILABLE. The model is overloaded. Please try again later.", "sources": [ { "source": "Rust lifetimes in async closures", "filename": "chatgpt-export-2026-10.json", "score": 4.7702, "excerpt": "[ASSISTANT]\nA future has to own or outlive everything it touches across an await point, because it may be moved to another thread and resumed later. A borrow of a local that ends before the await is fine; one that spans it is not." } ], "similar_problems": [], "created_at": "2026-11-08T11:19:40.602771", "duration_ms": 912.5 },
  { "id": 113, "query_text": "Summarise my interview prep on system design", "answer": null, "sources": null, "similar_problems": null, "created_at": "2026-11-02T19:03:26.158093", "duration_ms": null }
]
```

(In the real file write the referenced answer and sources out in full; the angle-bracket placeholders above
only avoid repeating them in this plan.) This set covers: a normal answer, an all-weak answer (115), a stored
Gemini error (114), a row with nulls (113), and three different days for the day headings.

`fixtures/import-ok.json` → `{ "status": "ok", "document_id": 43, "title": "release-checklist", "source_type": "markdown", "chunks": 11 }`.
`fixtures/import-url-ok.json` → `{ "status": "ok", "document_id": 44, "title": "Choosing a queue for the email worker", "source_type": "chatgpt_share", "chunks": 22 }`.
`fixtures/import-duplicate.json` → `{ "status": "duplicate", "document_id": 39, "title": "Docker build cache notes", "source_type": "markdown", "chunks": 18 }`.

`future` scenario additions: documents 42, 39 and 35 gain `"topics"` (`["Postgres", "Locking",
"Concurrency"]`, `["Docker", "Build caching"]`, `["Rust", "Async"]`) and document 39 gains `"summary":
"Notes on ordering Dockerfile steps so the dependency layer stays cached, and on pinning base images by
digest."`; the final stream line and history item 118 gain `"similar_problems": [{ "history_id": 116,
"query_text": "why does faiss recall drop after I delete documents", "created_at":
"2026-11-13T17:45:52.918340", "similarity": 0.83 }]`.

Sample file names to use when a file input is needed in verification: `release-checklist.md`,
`standup-notes-2026-11.txt`, `quarterly-plan.docx` (unsupported → skipped).

### 5.4 `scripts/check-dist.cjs`

Runs after `npm run build`. Exits non-zero when any of these fail, printing the measured numbers:
- No file in `dist/` contains `refound-fixture-data`, `Postgres deadlock on concurrent upserts`,
  `fonts.googleapis.com`, `fonts.gstatic.com`, `unpkg.com`, `jsdelivr.net` or `cdnjs`.
- `dist/404.html` does not exist; `dist/index.html` exists.
- The entry JS chunk referenced by `dist/index.html` is at most **125 kB gzip**; all JS in `dist/assets`
  together is at most **180 kB gzip**; all CSS at most **12 kB gzip**. (Measured starting point: the
  dependency set alone is 88 kB gzip in the entry plus 36 kB for the lazy markdown chunk. Today's bundle is
  125 kB, so the entry may not grow.)

---

## 6. Features the backend does not have yet

### 6.1 The policy

**Hidden until the API returns it, and listed once.**

1. A feature without a working backend has **no control, no nav item, no disabled button, no "coming soon"
   badge and no sample output** anywhere in the working UI.
2. Its surface is designed and built now as a normal component, but that component renders **only when real
   data for it is present** in an API response (a runtime type guard on an optional field). Today the
   backend never sends those fields, so the surfaces never appear. The day the backend ships a field, the
   surface lights up without a frontend release.
3. The single place these features are named is **Settings → Planned**, a plain list with the status "Not
   built yet". That list has no interactive elements.
4. Provisional field shapes live in `src/types/provisional.ts` with a comment that they are guesses to be
   replaced by the real contract. Guards ignore anything that does not match; they never throw.

### 6.2 Per feature

| Feature | Works today (real) | Hidden surface, ready to wire | Provisional contract |
|---|---|---|---|
| Similar Problem Detector | `SeenBefore` with `basis: 'wording'`: a client-side match of the new question against the loaded history (near-identical wording only), labelled as exactly that. | `SeenBefore` with `basis: 'server'`: on Ask (above the answer) and in `HistoryDetail`, one Callout per item, text `You solved something similar on {date}: "{query_text}"`, link "Open that answer". Shown instead of the wording match when present. Max 3. | `similar_problems: { history_id: number; query_text: string; created_at: string; similarity: number }[]` on the final stream line and on history items. |
| Settings API | Settings persist in localStorage; the page says "Saved in this browser". | None. All persistence is inside `src/state/settings.ts`; wiring means replacing its load/save functions. | `GET/PUT /api/settings` (unknown). |
| Auto topic tags | Nothing. | `TopicTags { topics: string[] }`: up to 3 neutral `Tag`s on the document row's second line, then `+2` in Meta style. And a `Select` "Topic" in `LibraryToolbar`, rendered only when at least one document has topics. | `topics?: string[]` on `Document`. |
| Memory summaries | Nothing. | `SummaryBlock { text: string }`: in `DocumentRow`, a third line in `font-serif text-md text-ink-2` clamped to 2 lines, with "Show more". | `summary?: string` on `Document`. |
| Bulk / folder import | **Works now**: several files at once and a folder picker, uploaded one at a time through the existing endpoint, each with its own result. Not listed under Planned. | None needed. | None. |
| Export / backup | Nothing. | None rendered. When an endpoint exists, add a "Data" section to Settings with a `SettingRow` "Export library" and a secondary Button "Download backup". The section does not exist until then. | Unknown. |
| Claude share links | Rejected with a clear message in `ShareLinkField`. | Extend `parseShareLink` to accept `claude.ai/share/<uuid>` and remove the error row. | Existing `import-url`. |

**PlannedList** (`src/components/settings/PlannedList.tsx`), data in `src/lib/planned.ts`. Intro line:
"These are on the roadmap and do not work yet". Rows (name in `font-medium`, description `text-sm
text-ink-2`, right-aligned `Tag` neutral "Not built yet"), separated by hairlines:
1. Similar problem detection — "Recognise when a new question matches something you solved before, by
   meaning. Today ReFound only notices near-identical wording"
2. Topic tags — "Label each document with a few topics on import and filter the library by them"
3. Summaries — "A short summary of a document"
4. Synced settings — "Keep these settings with the backend instead of this browser"
5. Export and backup — "Download your library and index as one file"
6. Claude share links — "Import a Claude conversation from its share link. Claude exports already work"

The `future` mock scenario is the proof that the hidden surfaces are built: under it the verification script
screenshots them.

---

## 7. Bugs folded into this work

The four from `TASKS.md`:

| # | Bug | Fix | Where |
|---|---|---|---|
| 1 | Import page accepts and advertises Claude share links (disabled in the backend) | `parseShareLink` mirrors the backend allowlist; `claude.ai` gets its own error; no other Claude-link wording. Claude **export** wording stays. | `src/lib/shareLink.ts`, `ShareLinkField`, `FormatsTable` |
| 2 | Error toasts show raw JSON `{"detail": ...}` | `readError` parses `detail` (string or validation array) into `ApiError.message`; raw bodies are never shown. | `src/services/api.ts` |
| 3 | Source scores show `404%` / `-564%` | Scores are cross-encoder logits. `relevance()` maps `sigmoid(score)` to Strong / Partial / Weak with a three-bar meter; the raw score is only in the `title`. No percentages. | `src/lib/relevance.ts`, `RelevanceMeter` |
| 4 | Library and sources show the share URL instead of the title | `displayTitle` / `sourceTitle` use `Document.title` and `Source.source`; the URL appears only as a shortened origin link. | `src/lib/documents.ts`, `DocumentRow`, `SourceCard` |

Found while reading the code (fix all):

| # | Bug | Fix |
|---|---|---|
| 5 | Imported text keeps markdown backslashes (`My pick\:`) | Display-side `cleanText()` on every excerpt. (The stored text is a backend matter and stays as is.) |
| 6 | History reads `item.query`; the API field is `query_text`, so every row title is blank | Correct `HistoryItem` type. |
| 7 | History calls `.length` on `answer` and `.toFixed` on `duration_ms`, both nullable → crash | Null-safe formatters and the "No answer was saved" state. |
| 8 | `Document.status` typed `'indexed' \| 'failed'`; the backend sends `pending \| indexed \| error`, so failed imports show no status and no error | Correct type; Failed and Indexing row states. |
| 9 | A `duplicate` import response is announced as "Imported" | Queue status `duplicate` with its own copy, including the failed-before case. |
| 10 | Timestamps are naive UTC but parsed as local time (off by the UTC offset) | `parseServerDate`. |
| 11 | Backend sentinel texts (`[GEMINI_API_KEY not set] ...`, `No relevant memories found...`, `Error generating answer: ...`) are rendered as if they were answers | `classifyAnswer` and the three designed states. |
| 12 | Settings "Results per query" is never sent; Search hard-codes `5` | `ask()` reads `topK` from the settings store. |
| 13 | Stream reader appends unparseable lines to the answer, drops the final buffered line, and checks stale `state`/`answer` closures after the loop | `readNdjson` + the `askStore` state machine. |
| 14 | `Landing` calls `navigate()` during render | `<Navigate replace>` in `Welcome`. |
| 15 | `useBackend` holds separate state per component, so the nav, the modal and Settings disagree; each mounts its own ping; the status dot pulses forever, including when offline | One health query shared through React Query; static dot. |
| 16 | Theme flashes dark on load, each `useTheme` instance has its own state, and "System" just toggles once | Inline head script + settings store with a real `system` preference. |
| 17 | Fonts load from Google Fonts at runtime (not local-first; breaks offline) | Self-hosted `@fontsource` packages. |
| 18 | Type classes (`text-display`, `text-body`, ...) are not defined in Tailwind, so the type scale silently does nothing | Real `fontSize` scale in the config. |
| 19 | Delete is reachable only by mouse hover (not by keyboard or touch) and deletes without confirmation | Focus-visible / always-visible delete button and `ConfirmDialog`. |
| 20 | Emoji used as icons (`📄`, `☀️`, `🌙`, `⚠️`, `✕`, `✓`) | `lucide-react` through `Icon`. |
| 21 | Settings says "No cloud, no tracking" although questions and passages go to Gemini when a key is set; the GitHub link points to `https://github.com` | Accurate About text; correct repository link. |
| 22 | Landing shows invented figures (`24 docs / 186 chunks`, scores `0.94`) as if live | Removed. The one illustration left is labelled "Example". |
| 23 | Search page shows "Loading..." forever when the documents request fails; errors are swallowed | Explicit loading, error and offline states on every page. |
| 24 | Dropping several files imports only the first, silently; unsupported files are sent and indexed as plain text | Import queue; client-side `skipped` state. |
| 25 | `BackendModal` has no focus trap, no `Esc`, no `role="dialog"`; toasts vanish after 3s with no `role` | Native `<dialog>`; `Toaster` roles and timings. |
| 26 | Search suggestions are hard-coded (`"Find where I mentioned Docker"`) and unrelated to the user's data | `RecentQuestions` from real history. |
| 27 | `frontend/Dockerfile` copies a `nginx.conf` that is not in its build context | Add `frontend/nginx.conf` (Phase 0). |
| 28 | `npm run lint` fails with 9 errors | Resolved by the rewrite; the patterns in 4.1 keep it clean. |

---

## 8. Dependencies

Run in `frontend/`. Both commands were dry-run against a copy of this repo on 2026-11-16 and resolve.

```bash
npm uninstall three @react-three/drei @react-three/fiber @react-three/rapier meshline ogl motion @types/three

npm install --save-exact \
  lucide-react@1.73.0 \
  @fontsource/ibm-plex-sans@5.3.0 \
  @fontsource/ibm-plex-mono@5.3.0 \
  @fontsource-variable/newsreader@5.3.0 \
  @tanstack/react-query@5.107.1 \
  react-markdown@10.1.0 \
  clsx@2.1.1
```

| Package | Decision | Why |
|---|---|---|
| `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/rapier`, `meshline`, `ogl`, `@types/three` | **Remove** | Imported nowhere. A 3D scene has no place in the Card Index direction, and they add install weight and audit surface. |
| `motion` | **Remove** | Used only for effects this plan deletes (curtain, boot overlay, per-letter headings, scroll reveals, card stagger). Everything that remains is a CSS transition or keyframe. Saves roughly 40 kB gzip. |
| `lucide-react` 1.73.0 | Add | The one icon set. Tree-shaken per icon. |
| `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` 5.3.0 | Add | Self-hosted UI and mono faces (woff2: 23 + 24 + 15 + 15 kB). |
| `@fontsource-variable/newsreader` 5.3.0 | Add | Self-hosted reading serif (Latin woff2 58 kB; italic loaded only if rendered). |
| `@tanstack/react-query` 5.107.1 | Add | Shared, cached server state with loading/error/refetch built in. Removes every fetch-in-effect (the source of the lint failures and of the per-component connection state bug). |
| `react-markdown` 10.1.0 | Add, lazy-loaded | Gemini answers are markdown. Safe by default (no raw HTML). 36 kB gzip in its own chunk. |
| `clsx` 2.1.1 | Add | Class composition (0.3 kB). |
| `react`, `react-dom` 19.2.x, `react-router-dom` 7.18.0, `vite` 8, `typescript` 6.0, `tailwindcss` 3.4.19, `postcss`, `autoprefixer`, ESLint stack | Keep as locked | No upgrades in this work. |

Not added, on purpose: a component library or Radix (native `<dialog>` covers modals, and there are no
menus or popovers in this design), `cmdk` (the palette is one small listbox), a state library (the 25-line
store is enough), a date library (`Intl` is enough), any animation library.

Also: delete the stray **root** `package.json` and `package-lock.json` (Phase 9). They list the 3D packages
and Tailwind `^4.3.1`, are not used by any build (Cloudflare and Docker both build from `frontend/`), and
invite someone to run `npm install` in the wrong directory.

`frontend/.gitignore`: add `.shots`. `frontend/eslint.config.js`: change `globalIgnores(['dist'])` to
`globalIgnores(['dist', '.shots'])`; no other lint config changes, and no `eslint-disable` comments in
`src`.

---

## 9. Build phases

Each phase is one commit (message given), leaves `npm run build` and `npm run lint` passing unless stated,
and has its own check. Work in order. All commands run in `frontend/`.

Target file tree at the end:

```
frontend/
  nginx.conf                      (new, copy of ../nginx/nginx.conf)
  index.html
  tailwind.config.js
  fixtures/                       documents.json, history.json, ask-default.json, ask-weak.json,
                                  ask-empty.json, import-ok.json, import-url-ok.json, import-duplicate.json
  scripts/                        mock-backend.cjs, verify.cjs, check-dist.cjs
  public/favicon.svg
  src/
    main.tsx  App.tsx  index.css
    styles/tokens.css
    services/api.ts  services/stream.ts
    types/provisional.ts
    lib/        store.ts format.ts documents.ts relevance.ts text.ts answer.ts similar.ts shareLink.ts
                planned.ts hotkeys.ts
    state/      settings.ts queryClient.ts ask.ts importQueue.ts toasts.ts
    hooks/      useStore.ts useBackendStatus.ts useDocuments.ts useHistory.ts useHotkeys.ts
    components/
      ui/       Icon Button IconButton TextField Select SegmentedControl Stepper Kbd Spinner Skeleton
                StatusDot Tag CallNumber RelevanceMeter Callout EmptyState Dialog ConfirmDialog Toaster
      shell/    AppShell Sidebar TopBar TabBar ConnectionStatus OfflineBanner PageHeader CommandPalette
                DropOverlay PageLoading
      ask/      AskComposer RecentQuestions AnswerSheet AnswerBody CitationMark SourceList SourceCard
                SeenBefore
      library/  LibraryToolbar DocumentList DocumentRow TopicTags SummaryBlock
      import/   Dropzone ShareLinkField ImportQueue ImportQueueItem FormatsTable
      history/  HistoryList HistoryRow HistoryDetail
      settings/ SettingRow ConnectionForm ConnectionHelp PlannedList
      welcome/  ConnectCard ExampleSheet exampleContent.ts
    pages/      Welcome Ask Library Import History Settings NotFound
```

Deleted by the end: `src/App.css`, `src/assets/`, `public/icons.svg`, `src/hooks/useBackend.ts`,
`src/hooks/useTheme.ts`, `src/hooks/useQueryState.ts`, `src/components/layout/`, every old file in
`src/components/ui/`, `src/pages/Landing.tsx`, `src/pages/app/`.

Lint guardrails for all phases: a file exports either components or non-components, never both (hooks,
stores, constants and helpers live in their own `.ts` files); no `any`; no `setState` inside an effect body
(derive during render, use the stores, or use React Query); when importing the lucide `History` or `Image`
icon into a file that has a same-named component or global, alias it (`History as HistoryIcon`).

### Phase 0 — Clean the ground
1. Run the `npm uninstall` and `npm install` commands from section 8.
2. Delete `src/App.css`, `src/assets/`, `public/icons.svg`. Replace `public/favicon.svg` (2.9).
3. `index.html`: remove the Google Fonts tags; add the theme script and meta tags (2.9).
4. Add `frontend/nginx.conf` with the exact contents of `nginx/nginx.conf`.
5. Add the `.shots` ignores (section 8). Add the three npm scripts (5.1).
6. Replace `frontend/README.md` with a short real one: what the frontend is, `npm install`, `npm run dev`,
   `npm run build`, `npm run lint`, `npm run mock`, `npm run verify`, `npm run check`, and the rule that
   fixtures never enter `src`.
- Check: `npm run build` passes (the old pages still compile except for `motion` imports: in this phase
  also delete `CurtainTransition`, `PageTransition`, `SplitText`, `ScrollReveal` and their usages, replacing
  `motion.*` elements with plain elements, so the old UI keeps building until it is replaced). Lint may
  still fail on the old files; that is expected until Phase 5.
- Commit: `chore(frontend): drop unused 3D and animation deps, self-host fonts, fix docker nginx.conf`

### Phase 1 — Tokens and theme
1. Write `src/styles/tokens.css` (2.1), `tailwind.config.js` (2.2), `src/index.css` (2.4), font imports in
   `main.tsx` (2.3).
2. The old pages will lose their colours (old colour names are gone). Do not patch them; they are replaced
   in Phases 4 and 5. To keep the build green, old class names simply produce no CSS.
- Check: `npm run build`; open the dev server and confirm in DevTools that `<html data-theme>` flips with
  the OS setting and that the three font families load from `/assets` (no request leaves the origin).
- Commit: `feat(frontend): design tokens, type scale and theme bootstrap`

### Phase 2 — Foundation (no UI)
1. `src/lib/*`, `src/state/*`, `src/hooks/*`, `src/services/api.ts`, `src/services/stream.ts`,
   `src/types/provisional.ts` exactly as in 4.1 and 6.
2. Write `fixtures/*.json` (5.3) and `scripts/mock-backend.cjs` (5.2).
- Check: `npm run build`. Then `npm run mock` and, in another shell,
  `curl -s localhost:8787/api/documents/ | head -c 200` returns the fixture list and
  `curl -sN -X POST localhost:8787/api/query/ -H 'content-type: application/json' -d '{"query":"x","top_k":5}'`
  prints token lines followed by one sources line. Also sanity-check the pure helpers in a Node one-liner or
  a scratch file that is not committed: `relevance(4.04).label === 'Strong match'`,
  `relevance(-5.64).label === 'Weak match'`, `parseServerDate('2026-11-14T09:12:44.512339').toISOString()
  === '2026-11-14T09:12:44.512Z'`, `cleanText('My pick\\:') === 'My pick:'`.
- Commit: `feat(frontend): typed API client, stores, helpers and mock backend`

### Phase 3 — Primitives
Build everything in `src/components/ui/` (4.2). To exercise them, temporarily render them on a scratch route
`/dev/kit` that exists **only** behind `import.meta.env.DEV` (the route element is `import.meta.env.DEV ?
<Kit /> : <NotFound />` with `Kit` lazy-loaded, so it is absent from production builds). Remove the route
and the file in Phase 8.
- Check: at `/dev/kit` in light and dark, every primitive shows default, hover, focus-visible (Tab through
  everything), disabled and loading states matching 4.2; a Dialog traps focus, closes on `Esc` and on
  backdrop click, and returns focus.
- Commit: `feat(frontend): UI primitives`

### Phase 4 — App shell and Welcome
`App.tsx` routes (3.1), `AppShell`, `Sidebar`, `TopBar`, `TabBar`, `ConnectionStatus`, `OfflineBanner`,
`PageHeader`, `PageLoading`, `Toaster`, `Welcome` with `ConnectCard`, `ConnectionHelp`, `ExampleSheet`
(build minimal `AnswerSheet` and `SourceCard` now; they are completed in Phase 5), `NotFound`, the `/app/*`
redirects. Pages not built yet render a `PageHeader` with their title only. Delete `Landing.tsx`,
`NavCapsule`, `BackendModal`, `PageLayout`.
- Check: with the mock running and the address set to it, `/` redirects to `/ask`; with nothing running,
  `/` shows Welcome and Connect produces the inline error and help. Resize from 1440 to 390: sidebar gives
  way to top bar and tab bar at 1024; no horizontal scroll. Stop the mock while on `/library`: the offline
  banner appears within 5 seconds; restart it: the banner leaves and "Reconnected" is toasted.
- Commit: `feat(frontend): app shell, connection states and welcome screen`

### Phase 5 — Pages
One commit per page, in this order, each with all states from section 4:
1. Ask (4.5) — `feat(frontend): ask page with streamed answers and sources`
2. Library (4.6) — `feat(frontend): library page`
3. Import (4.7) with `DropOverlay` — `feat(frontend): import queue, folder import and share links`
4. History (4.8) — `feat(frontend): history page`
5. Settings (4.9) — `feat(frontend): settings page`
Delete the old `src/pages/app/*` file and old `src/components/ui/*` files as each is replaced.
- Check after each: drive the page against the mock in every scenario that applies (5.2) and compare with
  the state tables. After the fifth: `npm run lint` passes with zero errors and zero warnings.

### Phase 6 — Command palette and keyboard
`CommandPalette` (4.4), `useHotkeys` and the shortcuts in 3.4, skip link, focus management on route change.
- Check: with the mouse unplugged in spirit: reach every control on every page with Tab; open the palette
  with `⌘K`/`Ctrl+K`, run a question, jump to a document, switch theme; `Esc` stops a streaming answer.
- Commit: `feat(frontend): command palette and keyboard navigation`

### Phase 7 — Verification script
Write `scripts/verify.cjs` and `scripts/check-dist.cjs` (5.4).

`verify.cjs` (CommonJS, `const { chromium } = require('playwright')`):
1. Requires an existing `dist/` (exit with a clear message otherwise). Spawns `npx vite preview --port 4173
   --strictPort` and `node scripts/mock-backend.cjs`, waits for both ports, and kills both on exit.
2. For each scene below, for each theme (`light`, `dark`) and viewport (`1440x900`, `390x844`): new context
   with `colorScheme` set to the theme, `addInitScript` that sets `localStorage.refound_theme` and
   `localStorage.refound_backend_url` (`http://127.0.0.1:8787`, or `:8788` for offline scenes), POST the
   scenario to the mock, go to the route, perform the steps, wait for the expectation, screenshot to
   `.shots/<scene>--<theme>--<width>.png`.
3. Records every `console` error and `pageerror`. In scenes marked "net errors expected", messages matching
   `/Failed to load resource|ERR_CONNECTION_REFUSED|net::ERR/` are ignored. Any other error fails the run.
4. After each scene asserts `document.documentElement.scrollWidth <= window.innerWidth` (no horizontal
   overflow).
5. Extra checks, run once at 1440 light: (a) keyboard: on `/ask`, first `Tab` focuses the skip link;
   `Control+K` opens the palette and `Escape` closes it with focus back on the trigger; on `/library`,
   tabbing reaches a row's delete button and `Enter` opens the confirm dialog with focus on Cancel.
   (b) reduced motion: with `reducedMotion: 'reduce'`, during `stream-hold` the caret's computed
   `animation-duration` is `0.01ms` or less than `1ms`. (c) no request during any scene goes to a host other
   than `localhost` / `127.0.0.1`. (d) on `/ask` in the `default` scenario the page text contains no `%`
   after the answer completes and no `\:`; the first source card's title is `Postgres deadlock on concurrent
   upserts` and no visible text starts with `https://chatgpt.com/share/`.
6. Prints a table of scenes with pass/fail and exits non-zero on any failure.

Scenes:

| Scene id | Route | Scenario | Steps → expectation | Net errors expected |
|---|---|---|---|---|
| `welcome` | `/` | offline port | wait for heading "Find what you already worked out" | yes |
| `welcome-failed` | `/` | offline port | click Connect → field error visible | yes |
| `ask-idle` | `/ask` | `default` | heading "Ask your library", recent questions listed | no |
| `ask-idle-loading` | `/ask` | `slow` | meta skeleton visible | no |
| `ask-empty-library` | `/ask` | `empty` | "Your library is empty" | no |
| `ask-retrieving` | `/ask` | `retrieve-hold` | submit "How did I fix the Postgres deadlock?" → "Searching your library" | no |
| `ask-streaming` | `/ask` | `stream-hold` | submit → "Writing", partial text, Stop button | no |
| `ask-stopped` | `/ask` | `stream-hold` | submit, press Escape → "Stopped" | no |
| `ask-done` | `/ask` | `default` | submit → five source cards, three citation marks | no |
| `ask-done-focus` | `/ask` | `default` | submit, Tab to the first citation → focus ring visible | no |
| `ask-weak` | `/ask` | `weak` | submit → "Nothing in your library matches this closely" | no |
| `ask-no-key` | `/ask` | `nokey` | submit → "No written answer" | no |
| `ask-llm-error` | `/ask` | `llm-error` | submit → "The answer could not be written" | no |
| `ask-empty-index` | `/ask` | `empty-index` | submit → "Nothing to search yet" | no |
| `ask-failed` | `/ask` | `error` | submit → "The question could not be sent" | yes |
| `ask-offline` | `/ask` | offline port | offline banner, composer disabled | yes |
| `ask-seen-before` | `/ask` | `default` | submit "How did I fix the postgres deadlock" → "You asked something close to this" | no |
| `library` | `/library` | `default` | 12 rows; row 9 shows Failed and its message | no |
| `library-loading` | `/library` | `slow` | skeleton rows | no |
| `library-empty` | `/library` | `empty` | "Nothing in your library yet" | no |
| `library-filtered` | `/library?q=docker` | `default` | one row | no |
| `library-no-results` | `/library?q=zzzz` | `default` | "No documents match" | no |
| `library-row-focus` | `/library` | `default` | Tab to first delete button → button and ring visible | no |
| `library-delete-confirm` | `/library` | `default` | click delete on row 1 → dialog `Delete "Postgres deadlock on concurrent upserts"?` | no |
| `library-error` | `/library` | `error` | "The library could not be loaded" | yes |
| `library-offline` | `/library` | offline port | "Backend offline" | yes |
| `import` | `/import` | `default` | dropzone, link field, formats table, empty queue text | no |
| `import-queue` | `/import` | `default` | set files `release-checklist.md`, `standup-notes-2026-11.txt`, `quarterly-plan.docx` on the file input → one Indexed, one working or queued, one Skipped (screenshot at 1200ms) | no |
| `import-link-claude` | `/import` | `default` | type `https://claude.ai/share/0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b`, submit → Claude error text | no |
| `import-failed` | `/import` | `import-fail` | set file `release-checklist.md` → Failed with "Parse error: Expecting value: line 1 column 1 (char 0)" and no `{` character in the item | yes |
| `import-duplicate` | `/import` | `import-duplicate` | set file `docker-notes.md` → "Already in your library" | no |
| `import-validation` | `/import` | `validation` | submit a valid ChatGPT link → item shows "Field required" | yes |
| `history` | `/history` | `default` | six rows under three day headings; first selected at 1440 | no |
| `history-detail` | `/history/117` | `default` | question, answer, two sources | no |
| `history-null` | `/history/113` | `default` | "No answer was saved for this question" | no |
| `history-llm-error` | `/history/114` | `default` | "The answer could not be written" | no |
| `history-empty` | `/history` | `empty` | "No questions yet" | no |
| `history-loading` | `/history` | `slow` | skeleton rows | no |
| `history-error` | `/history` | `error` | "History could not be loaded" | yes |
| `settings` | `/settings` | `default` | five sections; Planned shows six rows | no |
| `settings-connect-failed` | `/settings` | `default` | type `http://127.0.0.1:8788`, Connect → "Nothing answered at" | yes |
| `palette` | `/ask` | `default` | `Control+K`, type `docker` → Ask row, one document, one recent question | no |
| `toast` | `/library` | `default` | delete row 1 and confirm → toast `Deleted "Postgres deadlock on concurrent upserts"` | no |
| `drop-overlay` | `/library` | `default` | dispatch a `dragenter` with a `Files` DataTransfer on `window` → "Drop to import" | no |
| `not-found` | `/nope` | `default` | "This page does not exist" | no |
| `redirect` | `/app/search` | `default` | URL becomes `/ask` | no |
| `future-surfaces` | `/library` then `/history/118` | `future` | topic tags and a summary visible; "You solved something similar" visible | no |


- Check: `npm run build && npm run check && npm run verify` all exit 0; look through `.shots/` by eye
  against sections 2 to 4 (spacing on the 4px grid, one accent, no emoji, no clipped text at 390).
- Commit: `test(frontend): playwright verification script and bundle checks`

### Phase 8 — Polish pass
Remove `/dev/kit`. Then go through every screenshot and fix: uneven spacing, misaligned columns (icons in
one column, numbers right-aligned in one column), any text under 12px, any truncated label without a
`title`, any colour not from tokens (`grep -rnE "#[0-9a-fA-F]{3,8}|rgba?\(" src --include=*.tsx
--include=*.ts` must return nothing outside `exampleContent.ts` comments; `grep -rn "\[.*px\]" src` should
return nothing), any leftover uppercase tracked label, exclamation mark or trailing period on a label.
Run the template test: would this screen still fit if the product name were swapped for another product's?
The call numbers, highlighter marks, match meters and reading sheet should make the answer no.
- Check: the Phase 7 commands again.
- Commit: `polish(frontend): spacing, alignment and copy pass`

### Phase 9 — Docs and housekeeping
- `TASKS.md`: mark done the "Remove Claude link wording" item and the four small UI bugs; add a line under
  Done: "Frontend redesign (Card Index): new shell, Library page, import queue with multi-file and folder
  import, honest handling of features that are not built"; note under "Bulk / folder import" that the
  frontend now covers it through the existing endpoint; add "Dockerfile nginx.conf fixed".
- `KEY_INFO.md`: add a short "Frontend" section: design system location, the store pattern, the
  hidden-until-real policy and `src/types/provisional.ts`, the mock backend and scripts, the rule that
  fixtures never enter `src`, the answer sentinels the UI detects (so backend changes to those strings are
  known to affect the UI), the `relevance()` thresholds, and the localStorage keys. Remove the frontend
  entries from section 6 that are now fixed and the Claude-wording TODO list in section 4.
- `EXPLAINER.md`: update "Small known problems" (the first three are fixed; the backslash one is fixed for
  display) and the Claude-link to-do.
- `readme.md`: fix the frontend part of the project structure listing.
- Delete the root `package.json` and `package-lock.json` (section 8).
- Commit: `docs: record the frontend redesign and close fixed UI bugs`

---

## 10. Acceptance checklist

Build and tooling
- [ ] `cd frontend && npm ci && npm run build` exits 0 on Node 20 (`tsc -b && vite build`, output `dist/`).
- [ ] `npm run lint` exits 0 with no warnings and no `eslint-disable` comments in `src`.
- [ ] `npm run check` exits 0: entry JS ≤ 125 kB gzip, all JS ≤ 180 kB gzip, CSS ≤ 12 kB gzip, no fixture
      sentinel and no CDN host in `dist`, no `dist/404.html`.
- [ ] `npm run verify` exits 0: every scene in Phase 7 passes in light and dark at 1440 and 390, with no
      unexpected console error and no horizontal overflow.
- [ ] `package.json` no longer lists `three`, `@react-three/*`, `meshline`, `ogl`, `motion`,
      `@types/three`; Playwright is not listed.
- [ ] `frontend/Dockerfile` and `nginx/nginx.conf` are unchanged; `frontend/nginx.conf` exists and is
      identical to `nginx/nginx.conf`. If Docker is available, `docker build frontend` succeeds and a
      request for `/library` on the container returns `index.html`.
- [ ] `vite preview` serves `/ask`, `/library`, `/import`, `/history`, `/history/117`, `/settings` on a hard
      reload (SPA fallback), and `/app/search` lands on `/ask`.

Design system
- [ ] No hex or rgb colour and no arbitrary pixel value in any `.tsx`/`.ts` under `src` (greps in Phase 8).
- [ ] Only weights 400 and 500; three font families, all served from `/assets`; no network request leaves
      localhost during the verify run.
- [ ] Every icon comes from `lucide-react` through `Icon`; no emoji anywhere in `src`
      (`grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" src` returns nothing).
- [ ] No `transition-all`, `animate-pulse`, `animate-ping`, `hover:scale`, `blur`, `backdrop-blur` or
      gradient class in `src`.
- [ ] Theme: System, Light and Dark work, persist across reloads, and there is no flash of the wrong theme
      on a hard reload (verify by throttling CPU 6x and reloading in dark).

States (each is a screenshot in `.shots/`)
- [ ] Ask: idle, idle-loading, empty library, retrieving, streaming, stopped, done, weak match, no key,
      Gemini error, empty index, request failed, offline, asked-before.
- [ ] Library: default, loading, empty, filtered, no results, row focus, delete confirm, error, offline.
- [ ] Import: default, running queue with done/working/skipped, Claude link rejected, failed, duplicate,
      validation error.
- [ ] History: default, detail, null answer, stored Gemini error, empty, loading, error.
- [ ] Settings: default, connection failed. Welcome: default, connection failed.
- [ ] Global: command palette, toast, drop overlay, not found, future surfaces.

Bug fixes (section 7)
- [ ] Pasting a `claude.ai/share/...` link shows the Claude-specific message and sends no request; the word
      "Claude" appears on the Import page only for exports and that one message.
- [ ] No UI text ever contains `{"detail"`; a 422 validation array renders as its `msg` text.
- [ ] No `%` next to any source; scores 6.2143, 4.0412, 1.3077, -0.4127, -5.6402 render as Strong, Strong,
      Strong, Partial, Weak.
- [ ] No row or source card shows a raw `https://chatgpt.com/share/...` as its title; document 32 shows
      "Shared conversation".
- [ ] History rows show their question text; `/history/113` renders without an exception.
- [ ] A timestamp `2026-11-14T09:12:44.512339` shows as 09:12 UTC converted to the viewer's zone (in the
      verify run, with `timezoneId: 'Asia/Karachi'`, the Library tooltip reads `14 Nov 2026, 14:12`).
- [ ] Changing "Passages per answer" to 3 makes the next `POST /api/query/` body carry `"top_k": 3` (the
      mock logs it) and shows three skeleton cards.

Accessibility
- [ ] Every interactive element is reachable and operable by keyboard, with a visible 2px focus ring; the
      Library delete action is reachable without a mouse.
- [ ] Dialogs and the palette trap focus, close on `Esc`, and return focus to their trigger.
- [ ] One `h1` per page; focus moves to it on navigation; page titles follow 3.1.
- [ ] Icon-only buttons have accessible names; form fields have labels; errors are tied with
      `aria-describedby`; status changes are announced through `role="status"`/`role="alert"`.
- [ ] Text contrast meets AA in both themes (the table in 2.1); nothing relies on colour alone (match
      strength has a label, status has text, the current nav item has weight and a bar).
- [ ] With `prefers-reduced-motion: reduce` nothing animates.
- [ ] At 390px: no horizontal scroll, touch targets at least 44px, inputs at 16px text.

Honesty
- [ ] With the real backend as it is today, no control exists for similar-problem detection (beyond the
      labelled wording match), topics, summaries, synced settings or export; Settings → Planned lists them
      as "Not built yet" and contains no interactive element.
- [ ] The only illustrative content in the production build is the Welcome example, labelled "Example".
- [ ] The About text states plainly what is sent to Gemini.

Docs
- [ ] `TASKS.md`, `KEY_INFO.md`, `EXPLAINER.md`, `readme.md` and `frontend/README.md` are updated as in
      Phase 9.

---

## Direction 2 addendum (17 Nov 2026)

The user approved "direction 2" (spec: `docs/direction-2/prototype.html` and `docs/direction-2/copy.md`). It is built
into the app on this branch and **replaces** these parts of the plan above. Everything not named here still applies.

| Replaced | Now |
|---|---|
| 1 Design direction (wordmark, call-number look) and 2.3 Typography | Syne (700/800) for display and titles, Familjen Grotesk (400/500/600) for everything else, both self-hosted via `@fontsource` 5.3.0. Newsreader and IBM Plex are removed. Mono (system stack) is for code inside answers only; numbers are tabular sans |
| 2.1 Colour tokens | Retinted to the darkroom: dark = room `#0E0B0A`, paper `#EFE7DA`, amber `#E39A3D`; light = a paper-and-ink print. All text pairs AA. Extra tokens: `bar`, `tab`, `flag`, `tray`, `print*`, `drawer-*`. Dark tokens also apply to any `[data-theme='dark']` subtree (the landing page is always dark) |
| 2.6 Elevation, cards and boxes | Fewer boxes: answer, sources, lists, callouts and settings use type, whitespace and hairlines. The only objects are the landing print and the 3D cards |
| 2.8 Motion | Springs are allowed: the guide-tab plate (JS spring, `src/lib/spring.ts`), tab hover lift (2px, overshoot curve), the tray and drawer. All snap under reduced motion |
| 3.1 `/` and Welcome | `/` always renders the landing page (no redirect, no connect gate). Connecting lives only in Settings → Connection; the offline banner links there |
| 3.2 Shell (sidebar, mobile top bar and tab bar) | One top bar on every route and width: index-card guide tabs (Ask, Library, Import, History) with counts, wordmark home link, `Ctrl K` keycap, connection dot and text, Settings. The current tab stands proud and joins the page; one shared plate springs between tabs; arrow keys move between tabs |
| 4.10 Welcome page | Landing page: WebGL2 Latent Image tray (`components/landing/HeroTray.tsx`, real DOM h1 kept, transparent while GL paints), static developed print without WebGL, on context loss or under reduced motion; drawer teaser (labelled "Example"), How it works, Where your data goes. Lenis smooth scroll on this page only |
| 8 Dependencies ("no 3D, no animation library") | `three@0.170.0` (+ `@types/three`) in one lazy chunk (`CardDrawer3D-*.js`) and `lenis@1.1.13` (landing only). No CDNs |
| 5.4 check-dist budgets | Entry stays 125 kB gzip. The 3D drawer chunk has its own budget (150 kB). Other JS 190 kB (was 180) for the landing page and Lenis |
| 10 "no blur, no gradients" greps | The developing answer words blur in (`develop` keyframes) and the static print uses a radial gradient (`.print-static`); both are part of the approved prototype |
| No hex values in `src` | One named exception: `src/components/drawer/drawerPalette.ts` (canvas 2D and three.js take literal colours) |

The drawer (`components/drawer/`): Ask riffles it while retrieving, then builds it from the returned sources and flags
the cited ones; Library builds it from real documents split by divider cards, windowed to 40 cards; the DOM lists stay
the accessible layer. Without WebGL2 or with reduced motion a designed still (`StaticDrawer`) is shown, never a blank.
`verify.cjs` stubs WebGL off for most scenes and runs a few GL scenes (`landing-gl`, `ask-done-gl`, `library-gl`) with
long timeouts; the `nav-offline` and `nav-mock` scenes walk every route by clicks from `/` and back.
