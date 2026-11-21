# ReFound frontend

The web interface for ReFound: a React 19 + Vite + Tailwind CSS app that talks to the ReFound backend
over HTTP (`http://localhost:8000` by default; the address is set in the app and saved in the browser).

## Commands

Run everything from this directory.

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start the dev server at http://localhost:5173 |
| `npm run build` | Type-check and build to `dist/` |
| `npm run lint` | Run ESLint (must pass with zero errors and warnings) |
| `npm run mock` | Start the mock backend at http://127.0.0.1:8787 (`--scenario <name>` to pick a scenario) |
| `npm run verify` | Build first, then drive every page and state with Playwright against the mock and save screenshots to `.shots/` |
| `npm run check` | After a build: check bundle sizes and that `dist/` has no fixture data or CDN references |

`npm run verify` needs Playwright and Chromium installed globally (it uses `require('playwright')`; Playwright is not a
dependency of this package). `SHOTS_DIR` changes where screenshots go and `SCENES=ask-idle,library` runs only some
scenes. The plan behind the design, with every page state, is `docs/FRONTEND_REDESIGN_PLAN.md`; its "Direction 2 addendum" covers
the landing page, the guide-tab bar and the three.js drawer. Most verify scenes run with WebGL stubbed off; the `*-gl`
scenes use software GL and need long timeouts.

To work on the UI without the Python backend: run `npm run mock`, start `npm run dev`, open the app and
connect to `http://127.0.0.1:8787`.

## Fixtures never enter `src`

Fixture data lives in `fixtures/` and is served only by `scripts/mock-backend.cjs`. Nothing under `src/`
imports from `fixtures/` or `scripts/`, there is no demo mode in the app, and `npm run check` fails if
fixture data ends up in the production build.
