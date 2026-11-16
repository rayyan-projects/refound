# TASKS — what's done, in progress, and left

The single place for task status. Update it in the same PR that changes a task's state.
- `KEY_INFO.md` = architecture decisions and repo knowledge (for AI agents).
- `EXPLAINER.md` = plain-language overview (for people).
- This file = the to-do board.

Status: ✅ done · 🔄 in progress / half-done · ⏸ blocked · ⬜ not started

## 🗺 Big picture: from today to a finished ReFound

**Finished means** every feature in the README vision works for a real user:
1. Import ChatGPT/Claude chats, Markdown, TXT, PDF and images.
2. Semantic search over everything imported.
3. Memory Assistant: Gemini writes the answer from the matches.
4. Similar Problem Detector: "you solved this before".
5. Source citations on every answer.
6. Everything stored locally (SQLite + FAISS).

**Agreed approach:** most "implemented" features were reported as not working, so first make what exists actually
work, one feature at a time, tested from a user's point of view. Only then build what's missing.

| Phase | Goal | Status |
|---|---|---|
| 0. Tooling | PR previews + combined UAT site so every change can be tested live before merging | ⏸ waiting on Cloudflare (details below) |
| 1. Make existing features work | Verify and fix each one as a user would use it | 🔄 started |
| 1a | Chat share-link imports | ✅ ChatGPT done; Claude links disabled |
| 1b | File uploads: ChatGPT/Claude exports, Markdown, TXT, PDF, duplicate check | ⬜ |
| 1c | Processing: chunking, embeddings, FAISS save/delete, reranking | ⬜ |
| 1d | Asking: streamed Gemini answers with source citations | ⬜ |
| 1e | Query history | ⬜ |
| 1f | Image import (Gemini vision) | ⬜ |
| 1g | Test suite green (fix the 10 already-failing tests) | ⬜ |
| 1h | Small UI bugs found along the way | ✅ fixed in the frontend redesign |
| 2. Core missing features | Similar Problem Detector (headline feature) → Settings API | ⬜ |
| 3. Expose what half-exists | Auto topic tags on import → Memory summaries endpoint + UI | ⬜ |
| 4. Extensions | Bulk/folder import → Export/backup | ⬜ |

**Deferred (revisit later):**
- Re-enable Claude share links once a working fetch method exists.
- Only include PRs with passing tests in UAT (skipped for now to avoid CI costs).
- A hosted backend, so testers don't need to run it locally (needs a free or cheap server).

The sections below track the detailed steps of the current work.

## 🔄 In progress / half-done

### ⏸ UAT and PR preview sites (Cloudflare Pages)
Branch `ci/frontend-previews-and-uat` (not merged). Guide: `docs/DEPLOYMENT.md` on that branch.
- ✅ Workflow + script that builds the `uat` branch (main + all open PRs, newest push wins), banner, CORS, tests.
- ✅ Fork demo (`AnserAliKhan/Memory-Trace` → `refound-24j.pages.dev`) proved build + deploy work.
  It did **not** test PR merging (the fork had no open PRs).
- ✅ Repo moved to the `rayyan-projects` org (Cloudflare needs an org owner to connect it).
- ⏸ **Teammate:** accept org invite → Cloudflare: connect Pages to `rayyan-projects/refound`
  (root `frontend`, build `npm run build`, output `dist`, `NODE_VERSION=20`, previews for all branches) →
  share the `*.pages.dev` project name.
- ⬜ Repo variable `PAGES_PROJECT` = project name (this also switches the workflow on); create `uat` label.
- ⬜ If the name isn't `refound-24j`: update `cors_origin_regex` default in `backend/config.py`.
- ⬜ Merge `ci/frontend-previews-and-uat`, run **Actions → UAT → Run workflow** once.
- ⬜ Live test: 2 throwaway PRs editing the same line → UAT shows the newest push; check the PR status marks.

### 🔄 Chat imports (merged in #18)
- ✅ ChatGPT share links, incl. ChatGPT's new (Nov 2026) page format. Verified with a real link.
- ✅ Claude JSON export uploads (tested with sample files only).
- ⛔ Claude share links **disabled** (failed in real testing). Re-enable steps: `backend/app/parsers/claude_share_parser.py`.
- ✅ Remove "Claude link" wording from the UI until it works. The Import page now rejects `claude.ai` links with
  one clear message (`frontend/src/lib/shareLink.ts`); Claude **export** wording stays. `EXPLAINER.md` updated.
- ⬜ Live-test a long ChatGPT share (40+ messages) and one containing an image.
- ⬜ Test a real Claude data export file (`conversations.json`).
- ⬜ Find ChatPeek's upstream repo URL (not recorded) and check if it now supports ChatGPT's new format.

## ✅ Small bugs found while testing (fixed in the frontend redesign)
- ✅ Error toasts show raw JSON (`{"detail": ...}`) instead of the message (`frontend/src/services/api.ts`).
- ✅ Search source scores show as `404%` / `-564%` (rerank scores aren't 0–1). Now Strong / Partial / Weak match.
- ✅ Library and search sources show the share URL instead of the conversation title.
- ✅ Imported ChatGPT text keeps markdown backslashes (`My pick\:`). Fixed for display; the stored text is unchanged.

## ⬜ Backend audit: verify and fix "implemented" features (one at a time)
Most were reported as not working, or not correctly.
1. ⬜ File uploads: ChatGPT export, Markdown, TXT, PDF, duplicate check.
2. ⬜ Chunking quality, embeddings, FAISS persistence/delete (`Chunk.faiss_id` goes stale), reranking.
3. ⬜ Ask a question → streamed Gemini answer (default model `gemini-1.5-flash` is probably retired).
4. ⬜ Query history (only saved when a Gemini key is set).
5. ⬜ Image import end to end (Gemini vision).
6. ⬜ Fix the 10 already-failing tests: 8 in `test_api.py` (app never starts in tests), 2 image tests.

## ⬜ Features not built yet
1. ⬜ Similar Problem Detector ("you solved this before"): the headline feature.
2. ⬜ Settings API (backend is a stub; the frontend only uses localStorage).
3. ⬜ Auto topic tags (`generate_topics` exists, never called).
4. ⬜ Memory summaries endpoint (`summarize_memories` exists, not exposed).
5. 🔄 Bulk / folder import. The frontend now covers it through the existing endpoint: several files at once and a
   folder picker, uploaded one at a time with a result per file. No backend bulk endpoint.
6. ⬜ Export / backup.

## ⬜ Repo housekeeping
- ⬜ Delete branch `claude/cool-pascal-uzoygj` (superseded by #18).
- ⬜ Optionally delete merged branches: `stage-1` … `stage-7`, `frontend/dev`, `feat/landing-v2-base`.
- ⬜ README says `cp ../.env.example`, but the file is `backend/.env.example`; `backend/test.txt` is a stray file.

## ✅ Done (recent)
- ✅ Frontend redesign (Card Index): new shell, Library page, import queue with multi-file and folder import, honest
  handling of features that are not built. Plan: `docs/FRONTEND_REDESIGN_PLAN.md`.
- ✅ Dockerfile nginx.conf fixed (`frontend/nginx.conf` added; it was missing from the build context).
- ✅ #18: ChatGPT share import via vendored ChatPeek + new-format fallback; Claude share links disabled.
- ✅ Repo moved to `rayyan-projects/refound` (old URLs redirect).
- ✅ `KEY_INFO.md`, `EXPLAINER.md`, `TASKS.md` created.

## Conventions
- Branch names describe the work: `feat/...`, `fix/...`, `ci/...`, `docs/...`.
