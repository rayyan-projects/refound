#!/usr/bin/env node
/*
 * ReFound UI verification: drives every page and state against the mock backend with Playwright and saves a
 * screenshot per scene, theme and viewport. Run `npm run build` first, then `npm run verify`.
 *
 * Env: SHOTS_DIR (default .shots), SCENES (comma-separated scene ids to run), SKIP_EXTRAS=1 (skip extra checks).
 * Playwright comes from the machine's global install (require('playwright')); it is not a dependency.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SHOTS = path.resolve(ROOT, process.env.SHOTS_DIR || '.shots');
const APP = 'http://localhost:4173';
const MOCK = 'http://127.0.0.1:8787';
const OFFLINE = 'http://127.0.0.1:8788';
const THEMES = ['light', 'dark'];
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];
const NET_ERROR = /Failed to load resource|ERR_CONNECTION_REFUSED|net::ERR/;
const QUESTION = 'How did I fix the Postgres deadlock?';

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('verify: dist/ not found. Run `npm run build` first.');
  process.exit(1);
}
fs.mkdirSync(SHOTS, { recursive: true });

// ---------------------------------------------------------------- processes

const children = [];
let mockLog = '';
function start(cmd, args, env, onOut) {
  const child = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (d) => onOut && onOut(String(d)));
  child.stderr.on('data', (d) => onOut && onOut(String(d)));
  children.push(child);
  return child;
}
function stopAll() {
  for (const c of children) {
    try {
      c.kill('SIGTERM');
    } catch {
      /* already gone */
    }
  }
}
process.on('exit', stopAll);
process.on('SIGINT', () => process.exit(130));

function get(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', () => resolve(0));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(0);
    });
  });
}
async function waitFor(url, label) {
  for (let i = 0; i < 100; i++) {
    if ((await get(url)) > 0) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`verify: ${label} did not start (${url})`);
}
function post(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
      res.resume();
      res.on('end', resolve);
    });
    req.on('error', reject);
    req.end(data);
  });
}

// ---------------------------------------------------------------- helpers

async function submit(page, text = QUESTION) {
  const box = page.getByRole('textbox', { name: 'Question' });
  await box.waitFor();
  await page.waitForFunction(() => {
    const el = document.querySelector('#ask-composer');
    return el && !el.disabled;
  });
  await box.fill(text);
  await box.press('Enter');
}
const text = (page, t, opts = {}) => page.getByText(t, opts).first().waitFor({ timeout: 15000 });
async function setFiles(page, names) {
  const files = names.map((name) => ({
    name,
    mimeType: name.endsWith('.md') ? 'text/markdown' : name.endsWith('.txt') ? 'text/plain' : 'application/octet-stream',
    buffer: Buffer.from(`# ${name}\n\nFixture file for verification.\n`),
  }));
  await page.locator('input[type=file][accept]').setInputFiles(files);
}
function expect(cond, message) {
  if (!cond) throw new Error(message);
}

// ---------------------------------------------------------------- scenes

const SCENES = [
  { id: 'welcome', route: '/', offline: true, net: true, run: (p) => p.getByRole('heading', { name: 'Find what you already worked out' }).waitFor() },
  {
    id: 'welcome-failed', route: '/', offline: true, net: true,
    run: async (p) => {
      await p.getByRole('heading', { name: 'Find what you already worked out' }).waitFor();
      await p.getByRole('button', { name: 'Connect' }).click();
      await text(p, 'Nothing answered at');
    },
  },
  {
    id: 'ask-idle', route: '/ask', scenario: 'default',
    run: async (p) => {
      await p.getByRole('heading', { name: 'Ask your library' }).waitFor();
      await text(p, 'Recent questions');
      await text(p, 'What was the trick for keeping the Docker layer cache warm?');
    },
  },
  { id: 'ask-idle-loading', route: '/ask', scenario: 'slow', run: (p) => p.locator('main [aria-hidden="true"].animate-breathe').first().waitFor() },
  { id: 'ask-empty-library', route: '/ask', scenario: 'empty', run: (p) => text(p, 'Your library is empty') },
  { id: 'ask-retrieving', route: '/ask', scenario: 'retrieve-hold', run: async (p) => { await submit(p); await text(p, 'Searching your library'); } },
  {
    id: 'ask-streaming', route: '/ask', scenario: 'stream-hold',
    run: async (p) => {
      await submit(p);
      await text(p, 'Writing', { exact: true });
      await text(p, 'You fixed it by');
      await p.getByRole('button', { name: 'Stop' }).waitFor();
    },
  },
  {
    id: 'ask-stopped', route: '/ask', scenario: 'stream-hold',
    run: async (p) => {
      await submit(p);
      await text(p, 'You fixed it by');
      await p.keyboard.press('Escape');
      await text(p, 'Stopped', { exact: true });
    },
  },
  {
    id: 'ask-done', route: '/ask', scenario: 'default',
    run: async (p) => {
      await submit(p);
      await text(p, 'Copy');
      await p.locator('#source-5').waitFor();
      expect((await p.locator('li[id^="source-"]').count()) === 5, 'expected five source cards');
      expect((await p.locator('article a[href^="#source-"]').count()) === 3, 'expected three citation marks');
    },
  },
  {
    id: 'ask-done-focus', route: '/ask', scenario: 'default',
    run: async (p) => {
      await submit(p);
      await p.locator('#source-5').waitFor();
      await p.locator('h1').focus();
      for (let i = 0; i < 40; i++) {
        await p.keyboard.press('Tab');
        if (await p.evaluate(() => document.activeElement?.getAttribute('href') === '#source-1')) break;
      }
      expect(await p.evaluate(() => document.activeElement?.getAttribute('href') === '#source-1'), 'Tab did not reach the first citation');
      const outline = await p.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
      expect(outline === 'solid', `no focus ring on the citation (outline ${outline})`);
    },
  },
  { id: 'ask-weak', route: '/ask', scenario: 'weak', run: async (p) => { await submit(p, 'What did the lease say about the notice period?'); await text(p, 'Nothing in your library matches this closely'); } },
  { id: 'ask-no-key', route: '/ask', scenario: 'nokey', run: async (p) => { await submit(p); await text(p, 'No written answer'); await p.locator('#source-5').waitFor(); } },
  { id: 'ask-llm-error', route: '/ask', scenario: 'llm-error', run: async (p) => { await submit(p); await text(p, 'The answer could not be written'); await p.locator('#source-5').waitFor(); } },
  { id: 'ask-empty-index', route: '/ask', scenario: 'empty-index', run: async (p) => { await submit(p); await text(p, 'Nothing to search yet'); } },
  { id: 'ask-failed', route: '/ask', scenario: 'error', net: true, run: async (p) => { await submit(p); await text(p, 'The question could not be sent'); } },
  {
    id: 'ask-offline', route: '/ask', offline: true, net: true,
    run: async (p) => {
      await text(p, 'is not answering');
      await p.waitForFunction(() => document.querySelector('#ask-composer')?.disabled === true);
    },
  },
  { id: 'ask-seen-before', route: '/ask', scenario: 'default', run: async (p) => { await submit(p, 'How did I fix the postgres deadlock'); await text(p, 'You asked something close to this'); await p.locator('#source-5').waitFor(); } },
  {
    id: 'library', route: '/library', scenario: 'default',
    run: async (p) => {
      await text(p, 'Postgres deadlock on concurrent upserts');
      const rows = p.locator('[data-doc-row]');
      await rows.nth(11).waitFor();
      expect((await rows.count()) === 12, `expected 12 rows, got ${await rows.count()}`);
      const row9 = rows.nth(8);
      expect((await row9.innerText()).includes('Failed'), 'row 9 does not show Failed');
      expect((await row9.innerText()).includes('No chunks produced from document'), 'row 9 does not show its message');
    },
  },
  { id: 'library-loading', route: '/library', scenario: 'slow', run: (p) => p.locator('[data-doc-skeleton]').first().waitFor() },
  { id: 'library-empty', route: '/library', scenario: 'empty', run: (p) => text(p, 'Nothing in your library yet') },
  {
    id: 'library-filtered', route: '/library?q=docker', scenario: 'default',
    run: async (p) => {
      await text(p, 'Docker build cache notes');
      expect((await p.locator('[data-doc-row]').count()) === 1, 'expected one row');
    },
  },
  { id: 'library-no-results', route: '/library?q=zzzz', scenario: 'default', run: (p) => text(p, 'No documents match') },
  {
    id: 'library-row-focus', route: '/library', scenario: 'default',
    run: async (p) => {
      await p.locator('[data-doc-row]').first().waitFor();
      await p.locator('h1').focus();
      for (let i = 0; i < 30; i++) {
        await p.keyboard.press('Tab');
        if (await p.evaluate(() => (document.activeElement?.getAttribute('aria-label') || '').startsWith('Delete '))) break;
      }
      const ok = await p.evaluate(() => {
        const el = document.activeElement;
        return (el?.getAttribute('aria-label') || '').startsWith('Delete ') && getComputedStyle(el).opacity === '1' && getComputedStyle(el).outlineStyle === 'solid';
      });
      expect(ok, 'Tab did not reach a visible, focused delete button');
    },
  },
  {
    id: 'library-delete-confirm', route: '/library', scenario: 'default',
    run: async (p) => {
      const row = p.locator('[data-doc-row]').first();
      await row.waitFor();
      await row.hover();
      await row.getByRole('button', { name: /^Delete / }).click();
      await p.getByRole('heading', { name: 'Delete "Postgres deadlock on concurrent upserts"?' }).waitFor();
    },
  },
  { id: 'library-error', route: '/library', scenario: 'error', net: true, run: (p) => text(p, 'The library could not be loaded') },
  { id: 'library-offline', route: '/library', offline: true, net: true, run: (p) => p.getByRole('heading', { name: 'Backend offline' }).waitFor() },
  {
    id: 'import', route: '/import', scenario: 'default',
    run: async (p) => {
      await text(p, 'Drop files here');
      await p.getByRole('textbox', { name: 'ChatGPT share link' }).waitFor();
      await text(p, 'What you can import');
      await text(p, 'Imports from this session appear here');
    },
  },
  {
    id: 'import-queue', route: '/import', scenario: 'default',
    run: async (p) => {
      await text(p, 'Drop files here');
      await setFiles(p, ['release-checklist.md', 'standup-notes-2026-11.txt', 'quarterly-plan.docx']);
      await p.waitForTimeout(1200);
      await text(p, 'Indexed as');
      await text(p, 'Skipped: unsupported type (.docx)');
      const working = (await p.getByText('Reading and indexing').count()) + (await p.getByText('Waiting', { exact: true }).count());
      expect(working > 0, 'no working or queued item');
    },
  },
  {
    id: 'import-link-claude', route: '/import', scenario: 'default',
    run: async (p) => {
      const field = p.getByRole('textbox', { name: 'ChatGPT share link' });
      await field.fill('https://claude.ai/share/0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b');
      await field.press('Enter');
      await text(p, 'Claude share links are not supported yet');
    },
  },
  {
    id: 'import-failed', route: '/import', scenario: 'import-fail', net: true,
    run: async (p) => {
      await text(p, 'Drop files here');
      await setFiles(p, ['release-checklist.md']);
      await text(p, 'Parse error: Expecting value: line 1 column 1 (char 0)');
      const item = await p.locator('[data-queue-item]').first().innerText();
      expect(item.includes('Retry') && !item.includes('{'), 'failed item shows raw JSON or no Retry');
    },
  },
  { id: 'import-duplicate', route: '/import', scenario: 'import-duplicate', run: async (p) => { await text(p, 'Drop files here'); await setFiles(p, ['docker-notes.md']); await text(p, 'Already in your library'); } },
  {
    id: 'import-validation', route: '/import', scenario: 'validation', net: true,
    run: async (p) => {
      const field = p.getByRole('textbox', { name: 'ChatGPT share link' });
      await field.fill('https://chatgpt.com/share/6741f3c2-8a14-8005-b6d1-0c9e4f7a21bb');
      await field.press('Enter');
      await text(p, 'Field required');
    },
  },
  {
    id: 'history', route: '/history', scenario: 'default',
    run: async (p, v) => {
      await text(p, 'How did I fix the Postgres deadlock?');
      const rows = p.locator('[data-history-row]');
      await rows.nth(5).waitFor();
      expect((await rows.count()) === 6, 'expected six rows');
      // The fixture's six questions fall on four UTC days (five in Asia/Karachi), so "three day headings" in the
      // plan cannot hold; check that rows are grouped under at least three headings instead.
      expect((await p.locator('[data-day-heading]').count()) >= 3, 'expected at least three day headings');
      if (v.width >= 1024) expect((await rows.first().getAttribute('aria-current')) === 'true', 'first row not selected');
    },
  },
  {
    id: 'history-detail', route: '/history/117', scenario: 'default',
    run: async (p) => {
      await p.getByRole('heading', { name: 'What was the trick for keeping the Docker layer cache warm?' }).waitFor();
      await text(p, 'Install dependencies before you copy the source');
      await p.locator('#source-2').waitFor();
    },
  },
  { id: 'history-null', route: '/history/113', scenario: 'default', run: (p) => text(p, 'No answer was saved for this question') },
  { id: 'history-llm-error', route: '/history/114', scenario: 'default', run: (p) => text(p, 'The answer could not be written') },
  { id: 'history-empty', route: '/history', scenario: 'empty', run: (p) => text(p, 'No questions yet') },
  { id: 'history-loading', route: '/history', scenario: 'slow', run: (p) => p.locator('[data-history-skeleton]').first().waitFor() },
  { id: 'history-error', route: '/history', scenario: 'error', net: true, run: (p) => text(p, 'History could not be loaded') },
  {
    id: 'settings', route: '/settings', scenario: 'default',
    run: async (p) => {
      for (const s of ['Appearance', 'Connection', 'Answers', 'Planned', 'About']) await p.getByRole('heading', { name: s, exact: true }).waitFor();
      expect((await p.locator('[data-planned-row]').count()) === 6, 'Planned does not show six rows');
      await text(p, 'Connected to');
    },
  },
  {
    id: 'settings-connect-failed', route: '/settings', scenario: 'default', net: true,
    run: async (p) => {
      const field = p.getByRole('textbox', { name: 'Backend address' });
      await field.fill(OFFLINE);
      await p.getByRole('button', { name: 'Connect' }).click();
      await text(p, 'Nothing answered at');
    },
  },
  {
    id: 'palette', route: '/ask', scenario: 'default',
    run: async (p) => {
      await text(p, 'Recent questions');
      await p.keyboard.press('Control+K');
      const input = p.getByRole('combobox');
      await input.waitFor();
      await input.fill('docker');
      await p.getByRole('option', { name: /^Ask "docker"/ }).waitFor();
      await p.getByRole('option', { name: /Docker build cache notes/ }).waitFor();
      await p.getByRole('option', { name: /What was the trick for keeping the Docker layer cache warm/ }).waitFor();
    },
  },
  {
    id: 'toast', route: '/library', scenario: 'default',
    run: async (p) => {
      const row = p.locator('[data-doc-row]').first();
      await row.waitFor();
      await row.hover();
      await row.getByRole('button', { name: /^Delete / }).click();
      await p.locator('dialog[open]').getByRole('button', { name: 'Delete', exact: true }).click();
      await text(p, 'Deleted "Postgres deadlock on concurrent upserts"');
    },
  },
  {
    id: 'drop-overlay', route: '/library', scenario: 'default',
    run: async (p) => {
      await p.locator('[data-doc-row]').first().waitFor();
      await p.evaluate(() => {
        const dt = new DataTransfer();
        dt.items.add(new File(['x'], 'notes.md', { type: 'text/markdown' }));
        window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true }));
      });
      await text(p, 'Drop to import');
    },
  },
  { id: 'not-found', route: '/nope', scenario: 'default', run: (p) => text(p, 'This page does not exist') },
  { id: 'redirect', route: '/app/search', scenario: 'default', run: (p) => p.waitForURL('**/ask') },
  {
    id: 'future-surfaces', route: '/library', scenario: 'future', shots: 2,
    run: async (p, v, shot) => {
      await p.locator('[data-doc-row]').getByText('Build caching').waitFor();
      await text(p, 'Notes on ordering Dockerfile steps');
      await shot('library');
      await p.goto(`${APP}/history/118`);
      await text(p, 'You solved something similar');
    },
  },
];

// ---------------------------------------------------------------- runner

const only = process.env.SCENES ? new Set(process.env.SCENES.split(',')) : null;
const results = [];
const external = new Set();

async function runScene(browser, scene, theme, vp) {
  const errors = [];
  const ctx = await browser.newContext({
    viewport: vp,
    colorScheme: theme,
    deviceScaleFactor: 1,
    timezoneId: 'Asia/Karachi',
    locale: 'en-GB',
  });
  const backend = scene.offline ? OFFLINE : MOCK;
  await ctx.addInitScript(
    ([t, url]) => {
      localStorage.setItem('refound_theme', t);
      localStorage.setItem('refound_backend_url', url);
    },
    [theme, backend],
  );
  if (!scene.offline) await post(`${MOCK}/__scenario`, { name: scene.scenario || 'default' });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' && !(scene.net && NET_ERROR.test(m.text()))) errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('request', (r) => {
    const host = new URL(r.url()).hostname;
    if (!['localhost', '127.0.0.1'].includes(host) && !r.url().startsWith('data:')) external.add(r.url());
  });
  const name = `${scene.id}--${theme}--${vp.width}`;
  const settle = async () => {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
  };
  const shot = async (suffix) => {
    await settle();
    await page.screenshot({ path: path.join(SHOTS, suffix ? `${scene.id}-${suffix}--${theme}--${vp.width}.png` : `${name}.png`) });
  };
  let error = null;
  try {
    await page.goto(APP + scene.route);
    await scene.run(page, vp, shot);
    await shot();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) throw new Error(`horizontal overflow of ${overflow}px`);
  } catch (err) {
    error = err.message.split('\n')[0];
    try {
      await page.screenshot({ path: path.join(SHOTS, `${name}--FAILED.png`) });
    } catch {
      /* ignore */
    }
  }
  if (!error && errors.length) error = errors[0];
  await ctx.close();
  results.push({ scene: scene.id, theme, width: vp.width, ok: !error, error });
  process.stdout.write(error ? 'F' : '.');
}

// Extra checks (once, 1440 light).
async function extras(browser) {
  const checks = [];
  const check = async (name, fn) => {
    try {
      await fn();
      checks.push({ name, ok: true });
    } catch (err) {
      checks.push({ name, ok: false, error: err.message.split('\n')[0] });
    }
  };
  const newPage = async (opts = {}, backend = MOCK, init = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', deviceScaleFactor: 1, timezoneId: 'Asia/Karachi', ...opts });
    await ctx.addInitScript(
      ([url, extra]) => {
        localStorage.setItem('refound_theme', 'light');
        localStorage.setItem('refound_backend_url', url);
        for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
      },
      [backend, init],
    );
    return { ctx, page: await ctx.newPage() };
  };

  await check('keyboard: skip link, palette and delete', async () => {
    await post(`${MOCK}/__scenario`, { name: 'default' });
    const { ctx, page } = await newPage();
    await page.goto(`${APP}/ask`);
    await page.getByRole('heading', { name: 'Ask your library' }).waitFor();
    await page.keyboard.press('Tab');
    expect((await page.evaluate(() => document.activeElement?.textContent)) === 'Skip to content', 'first Tab is not the skip link');
    await page.locator('[data-palette-trigger]:visible').focus();
    await page.keyboard.press('Control+K');
    await page.getByRole('combobox').waitFor();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    expect(await page.evaluate(() => document.activeElement?.hasAttribute('data-palette-trigger')), 'focus did not return to the palette trigger');
    await page.goto(`${APP}/library`);
    await page.locator('[data-doc-row]').first().waitFor();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      if (await page.evaluate(() => (document.activeElement?.getAttribute('aria-label') || '').startsWith('Delete '))) break;
    }
    await page.keyboard.press('Enter');
    await page.locator('dialog[open]').waitFor();
    expect((await page.evaluate(() => document.activeElement?.textContent)) === 'Cancel', 'confirm dialog focus is not on Cancel');
    await ctx.close();
  });

  await check('reduced motion: caret does not animate', async () => {
    await post(`${MOCK}/__scenario`, { name: 'stream-hold' });
    const { ctx, page } = await newPage({ reducedMotion: 'reduce' });
    await page.goto(`${APP}/ask`);
    await submit(page);
    await text(page, 'You fixed it by');
    const duration = await page.evaluate(() => {
      const p = [...document.querySelectorAll('article p')].pop();
      return p ? getComputedStyle(p, '::after').animationDuration : 'none';
    });
    expect(parseFloat(duration) < 0.001 || duration === '0s', `caret animation-duration is ${duration}`);
    await ctx.close();
  });

  await check('answer text: no %, no \\:, titles not URLs', async () => {
    await post(`${MOCK}/__scenario`, { name: 'default' });
    const { ctx, page } = await newPage();
    await page.goto(`${APP}/ask`);
    await submit(page);
    await page.locator('#source-5').waitFor();
    await text(page, 'Copy');
    const body = await page.evaluate(() => document.body.innerText);
    expect(!body.includes('%'), 'page text contains %');
    expect(!body.includes('\\:'), 'page text contains \\:');
    const title = await page.locator('#source-1 .truncate').first().innerText();
    expect(title === 'Postgres deadlock on concurrent upserts', `first source title is "${title}"`);
    expect(!body.split('\n').some((l) => l.trim().startsWith('https://chatgpt.com/share/')), 'visible text starts with a share URL');
    const labels = await page.locator('li[id^="source-"] [role="img"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    expect(labels.join() === 'Strong match,Strong match,Strong match,Partial match,Weak match', `match labels are ${labels.join()}`);
    await ctx.close();
  });

  await check('timestamps: library tooltip in Asia/Karachi', async () => {
    await post(`${MOCK}/__scenario`, { name: 'default' });
    const { ctx, page } = await newPage();
    await page.goto(`${APP}/library`);
    await page.locator('[data-doc-row]').first().waitFor();
    const t = await page.locator('[data-doc-row]').first().locator('[data-imported]').first().getAttribute('title');
    expect(t === '14 Nov 2026, 14:12', `tooltip is "${t}"`);
    await ctx.close();
  });

  await check('passages per answer: top_k 3 is sent and three skeletons show', async () => {
    await post(`${MOCK}/__scenario`, { name: 'retrieve-hold' });
    const before = mockLog.length;
    const { ctx, page } = await newPage({}, MOCK, { refound_top_k: '3' });
    await page.goto(`${APP}/ask`);
    await submit(page);
    await text(page, 'Searching your library');
    await page.waitForTimeout(300);
    const skeletons = await page.locator('li[aria-hidden="true"]').count();
    expect(skeletons === 3, `expected 3 skeleton cards, got ${skeletons}`);
    expect(/"top_k":3/.test(mockLog.slice(before)), 'mock did not log "top_k":3');
    await ctx.close();
  });

  await check('no request leaves localhost', async () => {
    expect(external.size === 0, `external requests: ${[...external].slice(0, 3).join(', ')}`);
  });
  return checks;
}

(async () => {
  start('node', [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', '4173', '--strictPort'], {});
  start('node', ['scripts/mock-backend.cjs'], { PORT: '8787' }, (s) => {
    mockLog += s;
  });
  await waitFor(APP, 'vite preview');
  await waitFor(`${MOCK}/api/health`, 'mock backend');

  const browser = await chromium.launch();
  const scenes = SCENES.filter((s) => !only || only.has(s.id));
  for (const scene of scenes) {
    for (const theme of THEMES) for (const vp of VIEWPORTS) await runScene(browser, scene, theme, vp);
  }
  process.stdout.write('\n');
  const checks = process.env.SKIP_EXTRAS ? [] : await extras(browser);
  await browser.close();

  const byScene = new Map();
  for (const r of results) {
    const row = byScene.get(r.scene) || { scene: r.scene, pass: 0, fail: 0, errors: [] };
    if (r.ok) row.pass++;
    else {
      row.fail++;
      row.errors.push(`${r.theme}/${r.width}: ${r.error}`);
    }
    byScene.set(r.scene, row);
  }
  console.log('\nScene                      Result');
  for (const row of byScene.values()) {
    console.log(`${row.scene.padEnd(26)} ${row.fail ? `FAIL (${row.pass}/${row.pass + row.fail})` : `pass (${row.pass}/${row.pass})`}`);
    for (const e of row.errors.slice(0, 2)) console.log(`  ${e}`);
  }
  if (checks.length) {
    console.log('\nExtra check                                         Result');
    for (const c of checks) console.log(`${c.name.padEnd(52)} ${c.ok ? 'pass' : `FAIL: ${c.error}`}`);
  }
  const failed = results.filter((r) => !r.ok).length + checks.filter((c) => !c.ok).length;
  console.log(`\n${results.length} scene runs, ${checks.length} extra checks, ${failed} failed. Screenshots in ${SHOTS}`);
  stopAll();
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  stopAll();
  process.exit(1);
});
