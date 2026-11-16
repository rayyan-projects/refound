#!/usr/bin/env node
/*
 * ReFound mock backend: serves the JSON files in ../fixtures over the same HTTP API as the real backend.
 * No dependencies. Usage: node scripts/mock-backend.cjs [--scenario <name>]   (PORT env overrides 8787)
 * Switch scenario at runtime: POST /__scenario {"name": "<name>"} (this also resets deleted/imported documents).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const FIXTURES = path.join(__dirname, '..', 'fixtures');
const PORT = Number(process.env.PORT || 8787);
const SCENARIOS = [
  'default', 'empty', 'empty-index', 'slow', 'error', 'nokey', 'llm-error', 'stream-hold', 'retrieve-hold',
  'weak', 'import-fail', 'import-duplicate', 'validation', 'future',
];

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8')).data;
}

let scenario = 'default';
const argIndex = process.argv.indexOf('--scenario');
if (argIndex !== -1 && process.argv[argIndex + 1]) scenario = process.argv[argIndex + 1];
if (!SCENARIOS.includes(scenario)) {
  console.error(`Unknown scenario "${scenario}". One of: ${SCENARIOS.join(', ')}`);
  process.exit(1);
}

let documents = [];
let nextId = 43;
function reset() {
  documents = scenario === 'empty' ? [] : fixture('documents.json');
  nextId = 43;
  if (scenario === 'future') {
    const topics = { 42: ['Postgres', 'Locking', 'Concurrency'], 39: ['Docker', 'Build caching'], 35: ['Rust', 'Async'] };
    documents = documents.map((d) => {
      const extra = {};
      if (topics[d.id]) extra.topics = topics[d.id];
      if (d.id === 39) {
        extra.summary =
          'Notes on ordering Dockerfile steps so the dependency layer stays cached, and on pinning base images by digest.';
      }
      return { ...d, ...extra };
    });
  }
}
reset();

const SIMILAR = [
  {
    history_id: 116,
    query_text: 'why does faiss recall drop after I delete documents',
    created_at: '2026-11-13T17:45:52.918340',
    similarity: 0.83,
  },
];

function history() {
  if (scenario === 'empty' || scenario === 'nokey') return [];
  const items = fixture('history.json');
  if (scenario === 'future') return items.map((h) => (h.id === 118 ? { ...h, similar_problems: SIMILAR } : h));
  return items;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '600',
};

function send(res, status, body) {
  if (res.writableEnded || res.destroyed) return;
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', () => resolve(Buffer.concat(chunks)));
  });
}

function words(tokens) {
  const out = [];
  for (const t of tokens) {
    const parts = t.match(/\S+\s*|\s+/g) || [t];
    out.push(...parts);
  }
  return out;
}

async function streamQuery(req, res) {
  let closed = false;
  res.on('close', () => {
    closed = true;
  });
  const line = (obj) => {
    if (!closed) res.write(JSON.stringify(obj) + '\n');
  };
  const base = fixture('ask-default.json');
  let tokens;
  let final;
  if (scenario === 'empty' || scenario === 'empty-index') {
    const f = fixture('ask-empty.json');
    tokens = f.tokens;
    final = f.final;
  } else if (scenario === 'weak') {
    const f = fixture('ask-weak.json');
    tokens = words(f.tokens);
    final = f.final;
  } else if (scenario === 'nokey') {
    tokens = ['[GEMINI_API_KEY not set] Top result: ' + base.final.sources[0].excerpt];
    final = base.final;
  } else if (scenario === 'llm-error') {
    tokens = ['Error generating answer: 404 NOT_FOUND. models/gemini-1.5-flash is not found for API version v1beta'];
    final = base.final;
  } else {
    tokens = words(base.tokens);
    final = scenario === 'future' ? { ...base.final, similar_problems: SIMILAR } : base.final;
  }

  res.writeHead(200, { ...CORS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' });
  if (scenario === 'retrieve-hold') {
    res.flushHeaders();
    return; // keep the connection open, send nothing
  }
  for (let i = 0; i < tokens.length; i++) {
    if (closed) return;
    if (scenario === 'stream-hold' && i === 14) return; // hold the connection open
    line({ token: tokens[i] });
    await sleep(40);
  }
  line(final);
  if (!closed) res.end();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const route = url.pathname;
  const method = req.method;
  const body = method === 'POST' || method === 'PUT' ? await readBody(req) : Buffer.alloc(0);
  const isMultipart = String(req.headers['content-type'] || '').startsWith('multipart/');
  const logged = isMultipart ? `[multipart ${body.length} bytes]` : body.toString('utf8').slice(0, 200);
  console.log(`[mock:${scenario}] ${method} ${route}${url.search} ${logged}`.trim());

  if (method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  try {
    if (route === '/__scenario' && method === 'POST') {
      const name = JSON.parse(body.toString('utf8') || '{}').name;
      if (!SCENARIOS.includes(name)) return send(res, 400, { detail: `Unknown scenario ${name}` });
      scenario = name;
      reset();
      return send(res, 200, { scenario });
    }

    if (route === '/api/health' && method === 'GET') return send(res, 200, { status: 'ok' });

    // `slow` delays every data GET. Health is exempt: its 3 second client timeout would otherwise read as offline.
    if (scenario === 'slow' && method === 'GET') await sleep(4000);

    if (route === '/api/documents/' && method === 'GET') {
      if (scenario === 'error') return send(res, 500, { detail: 'database is locked' });
      return send(res, 200, documents);
    }

    if (route === '/api/query/history' && method === 'GET') {
      if (scenario === 'error') return send(res, 500, { detail: 'database is locked' });
      const limit = Number(url.searchParams.get('limit') || 20);
      return send(res, 200, history().slice(0, limit));
    }

    if (route === '/api/query/' && method === 'POST') {
      if (scenario === 'error') return send(res, 500, { detail: 'Internal Server Error' });
      return streamQuery(req, res);
    }

    if (route === '/api/documents/import' && method === 'POST') {
      await sleep(900);
      if (scenario === 'import-fail') {
        return send(res, 422, { detail: 'Parse error: Expecting value: line 1 column 1 (char 0)' });
      }
      if (scenario === 'import-duplicate') return send(res, 200, fixture('import-duplicate.json'));
      const m = /filename="([^"]*)"/.exec(body.toString('latin1'));
      const filename = m ? Buffer.from(m[1], 'latin1').toString('utf8') : 'upload';
      const ok = fixture('import-ok.json');
      const title = filename.replace(/\.[^.]+$/, '') || ok.title;
      const ext = (filename.match(/\.([^.]+)$/) || [])[1] || '';
      const type = { md: 'markdown', markdown: 'markdown', txt: 'txt', pdf: 'pdf', json: 'chatgpt' }[ext.toLowerCase()];
      const id = nextId++;
      const result = { ...ok, document_id: id, title, source_type: type || ok.source_type };
      documents = [
        { id, filename, source_type: result.source_type, title, created_at: new Date().toISOString().replace('Z', ''), chunk_count: result.chunks, status: 'indexed', error_message: null },
        ...documents,
      ];
      return send(res, 200, result);
    }

    if (route === '/api/documents/import-url' && method === 'POST') {
      await sleep(900);
      if (scenario === 'validation') {
        return send(res, 422, { detail: [{ loc: ['body', 'url'], msg: 'Field required', type: 'missing' }] });
      }
      if (scenario === 'import-fail') return send(res, 403, { detail: 'This shared conversation is private or has been deleted' });
      if (scenario === 'import-duplicate') return send(res, 200, fixture('import-duplicate.json'));
      const ok = fixture('import-url-ok.json');
      const shareUrl = JSON.parse(body.toString('utf8') || '{}').url || '';
      const id = nextId++;
      documents = [
        { id, filename: shareUrl, source_type: ok.source_type, title: ok.title, created_at: new Date().toISOString().replace('Z', ''), chunk_count: ok.chunks, status: 'indexed', error_message: null },
        ...documents,
      ];
      return send(res, 200, { ...ok, document_id: id });
    }

    const del = /^\/api\/documents\/(\d+)$/.exec(route);
    if (del && method === 'DELETE') {
      const id = Number(del[1]);
      if (!documents.some((d) => d.id === id)) return send(res, 404, { detail: 'Document not found' });
      documents = documents.filter((d) => d.id !== id);
      return send(res, 200, { status: 'deleted', document_id: id });
    }

    if (route === '/api/settings/' && method === 'GET') return send(res, 200, { message: 'not implemented' });

    return send(res, 404, { detail: 'Not Found' });
  } catch (err) {
    console.error(err);
    return send(res, 500, { detail: 'Mock backend error' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`ReFound mock backend on http://127.0.0.1:${PORT} (scenario: ${scenario})`);
});
