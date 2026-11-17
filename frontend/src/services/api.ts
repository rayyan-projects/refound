/**
 * ReFound API client. Every call takes the backend address; nothing is hard-coded.
 * Shapes mirror backend/app/api/routes/*.py and backend/app/database/models.py.
 */

export type SourceType = 'chatgpt' | 'chatgpt_share' | 'claude' | 'markdown' | 'txt' | 'pdf' | 'image';

export interface Document {
  id: number;
  /** Uploaded file name, or the full share URL for link imports. */
  filename: string;
  source_type: SourceType | string;
  /** The real title; may be null or "". */
  title: string | null;
  /** Naive UTC, e.g. "2026-11-14T09:12:44.512339" (no "Z"). */
  created_at: string | null;
  chunk_count: number;
  status: 'pending' | 'indexed' | 'error';
  error_message: string | null;
}

export interface ImportResult {
  status: 'ok' | 'duplicate';
  document_id: number;
  title: string | null;
  source_type: string;
  chunks: number;
}

export interface Source {
  /** Document title ("Unknown" if the document vanished). */
  source: string;
  /** Document file name (a URL for link imports). */
  filename: string;
  /** Cross-encoder logit, roughly -11..+11. Not 0..1. */
  score: number;
  /** First 300 characters of the passage. */
  excerpt: string;
}

export interface HistoryItem {
  id: number;
  query_text: string;
  answer: string | null;
  sources: Source[] | null;
  similar_problems: unknown[] | null;
  created_at: string | null;
  duration_ms: number | null;
}

export class ApiError extends Error {
  status: number;
  kind: 'network' | 'http';

  constructor(message: string, status: number, kind: 'network' | 'http') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.kind = kind;
  }
}

function fallbackMessage(status: number): string {
  if (status === 404) return 'Not found';
  if (status === 413) return 'That file is too large for the backend';
  if (status === 422) return 'The backend could not read that';
  if (status === 500) return 'The backend hit an error';
  if (status === 502 || status === 503 || status === 504) return 'The backend could not complete the request';
  return `Request failed (${status})`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Turns a non-2xx response into an ApiError with a readable message. Raw bodies are never surfaced. */
export async function readError(res: Response): Promise<ApiError> {
  let message = '';
  try {
    const body: unknown = JSON.parse(await res.text());
    const detail = isRecord(body) ? body.detail : undefined;
    if (typeof detail === 'string') {
      message = detail;
    } else if (Array.isArray(detail)) {
      message = detail
        .map((d) => (isRecord(d) && typeof d.msg === 'string' ? d.msg : ''))
        .filter(Boolean)
        .join('; ');
    }
  } catch {
    // not JSON: fall through to the status message
  }
  return new ApiError(message.trim() || fallbackMessage(res.status), res.status, 'http');
}

async function request(url: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    if (init.signal?.aborted && err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError('The backend is not reachable', 0, 'network');
  }
  if (!res.ok) throw await readError(res);
  return res;
}

async function json<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError('The backend sent a response ReFound could not read', res.status, 'http');
  }
}

/** GET /api/health. Resolves false (never throws) when nothing answers within 3 seconds. */
export async function healthCheck(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const data: unknown = await res.json();
    return isRecord(data) && data.status === 'ok';
  } catch {
    return false;
  }
}

/** GET /api/documents/ (newest first). */
export async function listDocuments(baseUrl: string): Promise<Document[]> {
  return json<Document[]>(await request(`${baseUrl}/api/documents/`));
}

/** POST /api/documents/import (multipart field `file`). */
export async function importFile(baseUrl: string, file: File, signal?: AbortSignal): Promise<ImportResult> {
  const body = new FormData();
  body.append('file', file);
  return json<ImportResult>(await request(`${baseUrl}/api/documents/import`, { method: 'POST', body, signal }));
}

/** POST /api/documents/import-url. */
export async function importUrl(baseUrl: string, url: string, signal?: AbortSignal): Promise<ImportResult> {
  return json<ImportResult>(
    await request(`${baseUrl}/api/documents/import-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal,
    }),
  );
}

/** DELETE /api/documents/{id}. */
export async function deleteDocument(baseUrl: string, id: number): Promise<void> {
  await request(`${baseUrl}/api/documents/${id}`, { method: 'DELETE' });
}

/** GET /api/query/history?limit=N (newest first). */
export async function getHistory(baseUrl: string, limit = 100): Promise<HistoryItem[]> {
  return json<HistoryItem[]>(await request(`${baseUrl}/api/query/history?limit=${limit}`));
}

/** POST /api/query/. The body is an NDJSON stream; read it with `readNdjson`. */
export async function queryMemoryStreaming(
  baseUrl: string,
  query: string,
  topK: number,
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const res = await request(`${baseUrl}/api/query/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k: topK }),
    signal,
  });
  if (!res.body) throw new ApiError('The backend sent an empty response', res.status, 'http');
  return res.body;
}
