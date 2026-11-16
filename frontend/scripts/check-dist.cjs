#!/usr/bin/env node
/*
 * Bundle checks, run after `npm run build`: no fixture data or CDN references in dist/, no dist/404.html
 * (Cloudflare Pages SPA fallback), and gzip budgets for JS and CSS. Exits non-zero on any failure.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIST = path.join(__dirname, '..', 'dist');
const KB = 1000;
const BUDGET = { entry: 125 * KB, js: 180 * KB, css: 12 * KB };
const FORBIDDEN = [
  'refound-fixture-data',
  'Postgres deadlock on concurrent upserts',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'unpkg.com',
  'jsdelivr.net',
  'cdnjs',
];

const failures = [];
const fail = (msg) => failures.push(msg);

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('check: dist/index.html not found. Run `npm run build` first.');
  process.exit(1);
}
if (fs.existsSync(path.join(DIST, '404.html'))) fail('dist/404.html exists (it disables the SPA fallback on Cloudflare Pages)');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
const files = walk(DIST);

for (const file of files) {
  const content = fs.readFileSync(file).toString('latin1');
  for (const needle of FORBIDDEN) {
    if (content.includes(needle)) fail(`${path.relative(DIST, file)} contains "${needle}"`);
  }
}

const gz = (file) => zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length;
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const entryMatch = /<script[^>]+type="module"[^>]+src="\/?([^"]+\.js)"/.exec(html);
if (!entryMatch) fail('no entry script found in dist/index.html');
const entryFile = entryMatch ? path.join(DIST, entryMatch[1]) : null;
const entry = entryFile && fs.existsSync(entryFile) ? gz(entryFile) : 0;
const js = files.filter((f) => f.endsWith('.js')).reduce((sum, f) => sum + gz(f), 0);
const css = files.filter((f) => f.endsWith('.css')).reduce((sum, f) => sum + gz(f), 0);

const kb = (n) => `${(n / KB).toFixed(1)} kB`;
const row = (label, value, budget) => {
  const ok = value <= budget;
  console.log(`${label.padEnd(26)} ${kb(value).padStart(9)}  (budget ${kb(budget)})  ${ok ? 'ok' : 'OVER'}`);
  if (!ok) fail(`${label} is ${kb(value)}, over the ${kb(budget)} budget`);
};
console.log('Gzip sizes');
row(`entry JS (${entryMatch ? path.basename(entryMatch[1]) : '?'})`, entry, BUDGET.entry);
row('all JS', js, BUDGET.js);
row('all CSS', css, BUDGET.css);
console.log(`Scanned ${files.length} files for fixture data and CDN hosts`);

if (failures.length) {
  console.error('\ncheck failed:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\ncheck passed');
