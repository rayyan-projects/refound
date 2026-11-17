# KEY_INFO — agent context for ReFound (repo: rayyan-projects/refound)

Read this before starting work. Keep it current: when you make an intentional/architectural
decision or discover a gotcha, add it here in the same terse style.

## 1. What this is
- Local-first "memory retrieval": import chats/notes → chunk → embed → FAISS → rerank → Gemini answer with citations.
- Product name in code/UI: **ReFound**. Repo: `rayyan-projects/refound` (moved from `mrkhan3870/Memory-Trace-`; old URLs redirect).
- Backend: FastAPI (Python 3.12+, tested on 3.13), `backend/`. Frontend: React+Vite+TS+Tailwind, `frontend/`.
- Human-facing overview: `EXPLAINER.md`. Task board: `TASKS.md`. Keep all three in sync when status changes.

## 2. Layout (backend)
```
main.py                 create_app(); lifespan loads EmbeddingEncoder + FAISSIndex into app.state
config.py               pydantic-settings Settings, get_settings() is @lru_cache (restart to pick up .env changes)
app/api/routes/         documents.py (import/list/delete), query.py (stream), settings.py (stub), health.py
app/parsers/            one parser per source_type; __init__.py = PARSER_MAP, EXT_MAP, detect_source_type
app/parsers/conversation.py   Chat (ChatPeek) → ParsedDocument; shared section layout for all chat sources
app/parsers/url_fetcher.py    share-URL allowlist + fetch + parse (blocking)
app/vendor/chatpeek.py  VENDORED third-party (MIT). Do not edit. See §4.
app/processors/         cleaner.py, chunker.py (sentence-aware sliding window, chunk_size/overlap in chars)
app/embeddings/         BAAI/bge-small-en-v1.5; query gets BGE prefix (asymmetric search)
app/retrieval/index.py  FAISS IndexFlatIP + parallel _ids list (row → Chunk.id), persisted to faiss_index.{index,ids.npy}
app/reranker/           cross-encoder ms-marco-MiniLM-L-6-v2, lazy singleton
app/llm/gemini.py       GeminiClient: synthesize (stream/non-stream), describe_image, summarize_memories, generate_topics
app/database/           SQLAlchemy models Document, Chunk, QueryHistory; init_db() = create_all (no migrations run)
tests/                  pytest; fixtures/ holds synthetic share pages (see §5)
```

## 3. Data contracts
- Parser output: `ParsedDocument(title, raw_text, source_type, metadata, sections=[{"heading","text"}])`.
  Chunker iterates `sections` (falls back to raw_text); `heading` → `Chunk.metadata["section"]`.
- File parsers: `parse(file_bytes, filename)`. Share parsers: `parse(body: str, url)` (body = HTML for ChatGPT, snapshot JSON for Claude).
- Conversation section layout (all chat sources): heading `"USER — <first 60 chars>"`, text `"[USER]\n<turns joined by \n\n>"`.
  Consecutive same-speaker replies are merged. Speakers: USER / ASSISTANT (ChatGPT) / CLAUDE / TOOL.
  Multi-conversation Claude exports prefix headings with `"[<conversation name>] "`.
- Dedup: `Document.file_hash` unique. Files: sha256(bytes). Share links: sha256(f"{source_type}:{share_id}") so
  query strings / trailing slashes don't create duplicates.
- source_type values: chatgpt, chatgpt_share, claude, markdown, txt, pdf, image (claude_share disabled).
- `.json` uploads: `_detect_json_type` → "claude" if first object has `chat_messages`, else "chatgpt".

## 4. ChatGPT / Claude parsing (decisions — do not regress)
- ChatGPT-share and Claude parsing goes through **vendored ChatPeek** (`app/vendor/chatpeek.py`), plus one
  ReFound fallback for ChatGPT's newest page format (below).
  - Kept byte-identical to upstream below its license header, including unused CLI/`save_markdown` code,
    so updating = paste new upstream over it. ReFound glue lives in `conversation.py`, the parsers, `url_fetcher.py`.
  - Upstream repo URL/copyright holder was not recorded when vendored — fill it into the header when known.
  - Maintenance: check upstream ~weekly / whenever a share import starts failing. Share page formats change without notice.
- ChatGPT share: `parse_share_html` handles React Router stream (`streamController.enqueue`), post shares (`/s/<id>`),
  and legacy `__NEXT_DATA__`. Follows `linear_conversation` → correct order, no abandoned branches.
  System msgs, tool-addressed msgs, reasoning, tool output are excluded (ExportOptions defaults). Intentional: noise hurts retrieval.
- ChatGPT "octane" share pages (seen from Nov 2026; ChatPeek doesn't know them): if ChatPeek finds nothing,
  `chatgpt_share_parser.parse_octane_share` reads `<script id="__WEB_MOBILE_DATA__">` → `conversation.messages`
  (`role`, markdown `content`; user/assistant only). Raises if fewer user turns than `conversation.userMessageCount`
  (never index a partial chat). Verified on one real short text-only share; long/multimodal shares not yet checked.
  Docs from this path still carry `metadata.method == "chatpeek"` (set by `chat_to_document`).
- **Claude share links: DISABLED (Nov 2026).** Failed from a home connection too, not just cloud IPs.
  `resolve_share_url` rejects `claude.ai/share/<uuid>` with "Claude share links aren't supported yet" (HTTP 422);
  the parser is commented out in `app/parsers/claude_share_parser.py` (re-enable steps in its docstring).
  Claude JSON *export* uploads are unaffected and still supported.
  The frontend rejects `claude.ai` links client-side with its own message (`frontend/src/lib/shareLink.ts`, which
  mirrors this allowlist); "Claude export" wording stays because exports work.
- (Historical) Claude share: page HTML is an empty shell. We fetched `https://claude.ai/api/chat_snapshots/<uuid>` JSON directly.
  Cloudflare may 403 from cloud/VPN IPs → surfaces as ShareAccessError (HTTP 403 to the client). Not fixable server-side.
  Live attempts: cloud session got the bot challenge; the user's home test also failed → feature disabled (above).
- Claude JSON export: reuses `parse_claude_snapshot` per conversation (same message shape). Prefers `content[]`,
  falls back to `text`; null-safe; artifacts included, thinking excluded; empty conversations skipped.
- **Fail loudly**: no conversation found / zero readable messages → ValueError → HTTP 422. Never fall back to
  scraping page text (old behaviour indexed login-page junk).
- URL import is an **allowlist**, not a generic webpage fetcher (SSRF guard):
  `https://chatgpt.com|www.chatgpt.com|chat.openai.com` + `/share/<id>` or `/s/<id>`. (Claude share links: disabled.)
  `/c/<id>` (private ChatGPT chat) gets a specific error. Generic webpage import was intentionally dropped
  (frontend already only accepts share links). bs4/lxml removed from deps.
- Fetch is blocking `requests` → route calls `import_url` via `run_in_threadpool`. 2 attempts, 20s timeout (ChatGPT),
  25M-char post-fetch size cap (hosts are allowlisted, so no streaming cap).
- `/import-url` error mapping: ValueError→422, ShareAccessError→403, upstream 404→404, other HTTPError→502,
  Timeout→504, other RequestException→502.

## 5. Testing
- `cd backend && python -m pytest -q` (needs requirements installed; sentence-transformers pulls torch).
- `tests/test_share_parsers.py` covers all chat parsers, URL allowlist, import_url, and /import-url error mapping
  (fetchers monkeypatched on `app.parsers.url_fetcher`; no network).
- Fixtures in `tests/fixtures/` are **synthetic** (CI/agent sandboxes can't reach chatgpt.com/claude.ai).
  Regenerate: `python -m tests.fixtures.build_fixtures`. When you capture a real saved page, add it + a test.
- Agent sandbox: outbound proxy blocks chatgpt.com and 403s claude.ai — do not try live share fetches there.
- Pre-existing failures (not caused by parser work, unfixed as of this writing):
  - `test_api.py` 8 failures: `TestClient(app)` without `with` → lifespan never runs → no tables, no `app.state.encoder`.
    Fix needs `with TestClient(...)` + test DB/encoder override (and the encoder downloads a HF model).
  - `test_parsers.py::TestImageParser` 2 failures: `monkeypatch.setattr(Settings, "gemini_api_key", "")` fails on
    pydantic v2 classes; also `get_settings()` is cached so it'd need `get_settings.cache_clear()` / patching the function.

## 6. Known issues / traps (verified by reading code unless noted)
- Settings API: `GET /api/settings` returns `{"message": "not implemented"}`; frontend Settings uses localStorage only.
- Similar Problem Detector: `QueryHistory.similar_problems` column never written; nothing computes it.
- `generate_topics` / `summarize_memories` exist in GeminiClient but nothing calls them; no topics column.
- Query history persisted only on the Gemini path; no-API-key path never saves history.
- Query route iterates a sync Gemini stream inside an async generator, and import does embedding synchronously in
  async routes → blocks the event loop under load.
- `history persisted in StreamingResponse finally` uses the request's DB session; with FastAPI ≥0.106 the dependency
  may already be closed by then (unverified — test it).
- `Chunk.faiss_id` goes stale after any delete (index is rebuilt and rows shift). Search uses the in-memory `_ids`
  map, so results are correct; just don't trust `faiss_id`.
- Default `gemini_model = "gemini-1.5-flash"` is likely retired → synthesis may fail until updated (unverified).
- ChatGPT octane `content` is markdown with escapes, so chunks keep backslashes (`My pick\:`, `4\.`). The frontend
  strips them for display (`cleanText`); the stored text still has them.
- README says `cp ../.env.example`; the file is `backend/.env.example`. `backend/test.txt` is a stray UTF-16 file.
- No Alembic migrations despite alembic in requirements; schema changes need create_all on a fresh DB or a migration.

## 7. Frontend (Card Index redesign, Nov 2026)
- Plan and spec: `docs/FRONTEND_REDESIGN_PLAN.md`. Design tokens: `frontend/src/styles/tokens.css` (CSS variables, light +
  `[data-theme='dark']`), exposed to Tailwind 3 in `frontend/tailwind.config.js`. No hex/rgb or arbitrary px values in `src`.
  Fonts are self-hosted (`@fontsource`, imported in `main.tsx`); nothing loads from a CDN. Icons: `lucide-react` via `components/ui/Icon.tsx`.
- State: tiny external stores (`src/lib/store.ts` + `hooks/useStore.ts`, `useSyncExternalStore`) for settings, the current
  question (`state/ask.ts`, survives navigation), the import queue and toasts. Server data goes through React Query
  (`state/queryClient.ts`); one shared health query (`hooks/useBackendStatus.ts`, 30s poll online, 5s offline). No
  context providers, no `setState` in effects (keeps `react-hooks` lint clean).
- Unbuilt features are **hidden until the API returns them**: provisional shapes and guards in `src/types/provisional.ts`
  (`similar_problems`, `Document.topics`, `Document.summary`). The surfaces render only when real data is present; they
  are named once, in Settings → Planned (`src/lib/planned.ts`). Replace the guesses when the backend contract exists.
- Mock backend: `frontend/scripts/mock-backend.cjs` serves `frontend/fixtures/*.json` (scenarios via `--scenario` or
  `POST /__scenario`). `npm run verify` drives every page/state with Playwright (global install, not a dependency) and
  screenshots to `.shots/`; `npm run check` enforces bundle budgets and scans `dist/`. **Fixtures never enter `src`.**
- The UI detects backend answer sentinels by prefix (`src/lib/answer.ts` `classifyAnswer`); changing these strings in
  `query.py` changes the UI: `No relevant memories found` (empty index), `[GEMINI_API_KEY not set]` (no key),
  `Error generating answer:` (Gemini failure). Answers cite `[Memory N]`, turned into links to source cards.
- Source relevance (`src/lib/relevance.ts`): `p = sigmoid(score)`; `p >= 0.7` Strong, `>= 0.3` Partial, else Weak.
  The raw score is only in a tooltip. No percentages.
- Naive UTC timestamps from the backend are parsed as UTC (`parseServerDate` appends `Z`).
- localStorage keys: `refound_backend_url` (default `http://localhost:8000`), `refound_theme` (`system|light|dark`,
  read by the inline script in `index.html` before first paint), `refound_top_k` (1..10, default 5, sent as `top_k`).
- Routes: `/` Welcome (redirects to `/ask` when the backend answers), `/ask`, `/library`, `/import`, `/history[/:id]`,
  `/settings`; old `/app/*` paths redirect. No `public/404.html` (Cloudflare Pages SPA fallback needs it absent).
- `frontend/nginx.conf` is a copy of `nginx/nginx.conf` so the frontend Docker build context has it. Keep them identical.

### Direction 2 (Nov 2026; overrides parts of the above, see the addendum in the plan)
- Type: Syne (display) + Familjen Grotesk (text), self-hosted. Palette: darkroom tokens; `[data-theme='dark']` also
  works on a subtree (the landing page is always dark).
- Navigation: `components/shell/GuideBar.tsx` (index-card guide tabs) in `RootLayout` on every route, including `/`.
  `/` always renders `pages/Landing.tsx`; there is no connect gate. Connect from Settings → Connection.
- WebGL: `HeroTray` (WebGL2 shaders in `trayShaders.ts`) and `components/drawer/CardDrawer3D.tsx` (three.js r170,
  lazy chunk, disposes everything on unmount, renders only while moving). Both probe WebGL2 themselves and fall back
  to static versions (`print-static`, `StaticDrawer`) without WebGL, on context loss or under reduced motion.
- Drawer decks: `components/drawer/decks.ts` (`answerDeck` flags the `[Memory N]`-cited sources; `libraryDeck`
  groups by type with divider cards, max 40 cards). Colour literals for canvas/three live only in `drawerPalette.ts`.
- Budgets (`npm run check`): entry 125 kB, 3D chunk 150 kB, other JS 190 kB, CSS 12 kB (gzip).
- Software GL in headless Chromium blocks the main thread long enough for the 3s health check to time out, so GL
  scenes may show "Offline"; `verify.cjs` runs most scenes with WebGL stubbed off.

## 8. Tasks and status
Moved to `TASKS.md` (the to-do board: done / in progress / blocked / not started). Keep this file for
decisions and repo knowledge only.

## 9. Conventions
- Branch names describe the work: `feat/...`, `fix/...`, `ci/...`, `docs/...`, never generated ones.
- Update `TASKS.md` in the same PR that changes a task's state; update this file when a decision changes.
