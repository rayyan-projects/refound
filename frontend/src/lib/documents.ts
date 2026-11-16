import type { Document, Source } from '../services/api';

export function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

export type SourceGroup = 'chats' | 'notes' | 'pdfs' | 'images';
export interface SourceTypeInfo {
  label: string;
  prefix: string;
  group: SourceGroup;
}

export const SOURCE_TYPES: Record<string, SourceTypeInfo> = {
  chatgpt: { label: 'ChatGPT export', prefix: 'GPT', group: 'chats' },
  chatgpt_share: { label: 'ChatGPT share link', prefix: 'GPT', group: 'chats' },
  claude: { label: 'Claude export', prefix: 'CLD', group: 'chats' },
  markdown: { label: 'Markdown', prefix: 'MD', group: 'notes' },
  txt: { label: 'Text', prefix: 'TXT', group: 'notes' },
  pdf: { label: 'PDF', prefix: 'PDF', group: 'pdfs' },
  image: { label: 'Image', prefix: 'IMG', group: 'images' },
};
const FALLBACK_TYPE: SourceTypeInfo = { label: 'Document', prefix: 'DOC', group: 'notes' };

export function sourceType(type: string | null | undefined): SourceTypeInfo {
  return (type && Object.prototype.hasOwnProperty.call(SOURCE_TYPES, type) && SOURCE_TYPES[type]) || FALLBACK_TYPE;
}

export function displayTitle(doc: Document): string {
  const t = doc.title?.trim();
  if (t) return t;
  if (isUrl(doc.filename)) return 'Shared conversation';
  return doc.filename;
}

/** `chatgpt.com/share/6741f3c2…` for links; the file name for files ('' when it equals the title). */
export function originLabel(doc: Document): string {
  if (isUrl(doc.filename)) return shortUrl(doc.filename);
  return doc.filename === displayTitle(doc) ? '' : doc.filename;
}

export function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const last = parts.pop();
    const shortened = last && last.length > 8 ? `${last.slice(0, 8)}…` : last;
    return [u.host, ...parts, shortened].filter(Boolean).join('/');
  } catch {
    return url;
  }
}

export function callNumber(doc: Document): string {
  return `${sourceType(doc.source_type).prefix}-${String(doc.id).padStart(4, '0')}`;
}

export const SUPPORTED_EXTENSIONS = ['.json', '.md', '.markdown', '.txt', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];

export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i).toLowerCase() : '';
}

export function isSupportedFile(name: string): boolean {
  return SUPPORTED_EXTENSIONS.includes(extensionOf(name));
}

export function matchDocument(source: Source, docs: Document[]): Document | undefined {
  const candidates = docs.filter((d) => d.filename === source.filename);
  if (candidates.length <= 1) return candidates[0];
  return candidates.find((d) => d.title === source.source) ?? candidates[0];
}

export function sourceTitle(source: Source, doc?: Document): string {
  if (doc) return displayTitle(doc);
  const s = source.source?.trim();
  if (s && s !== 'Unknown' && !isUrl(s)) return s;
  if (isUrl(source.filename)) return 'Shared conversation';
  return source.filename || 'Unknown document';
}
