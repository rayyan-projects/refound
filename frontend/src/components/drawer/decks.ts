import type { Document, Source } from '../../services/api';
import { callNumber, displayTitle, matchDocument, originLabel, sourceTitle, sourceType } from '../../lib/documents';
import type { SourceGroup } from '../../lib/documents';
import { formatDate, parseServerDate, plural } from '../../lib/format';
import { cleanText, splitSpeaker } from '../../lib/text';
import type { DrawerItem } from './drawerTypes';
import { MAX_CARDS } from './drawerTypes';

const GROUPS: { group: SourceGroup; label: string }[] = [
  { group: 'chats', label: 'Chats' },
  { group: 'notes', label: 'Notes' },
  { group: 'pdfs', label: 'PDFs' },
  { group: 'images', label: 'Images' },
];

export function docCard(doc: Document): DrawerItem {
  const failed = doc.status === 'error';
  const type = sourceType(doc.source_type).label;
  return {
    kind: 'card',
    key: `doc-${doc.id}`,
    cn: callNumber(doc),
    date: formatDate(parseServerDate(doc.created_at)),
    title: displayTitle(doc),
    text: failed
      ? `Indexing failed. ${doc.error_message ? cleanText(doc.error_message) : ''}`.trim()
      : `${plural(doc.chunk_count, 'passage', 'passages')} · ${type}`,
    src: originLabel(doc) || type,
    failed,
  };
}

/**
 * The library as a drawer: divider cards for Chats, Notes, PDFs and Images, each followed by its documents in the
 * given order. `around` windows a long library to MAX_CARDS cards centred on that document.
 */
export function libraryDeck(docs: Document[], around: number | null = null): { items: DrawerItem[]; indexOf: Map<number, number> } {
  let list = docs;
  if (docs.length > MAX_CARDS - GROUPS.length) {
    const room = MAX_CARDS - GROUPS.length;
    const at = around === null ? 0 : Math.max(0, docs.findIndex((d) => d.id === around));
    const start = Math.max(0, Math.min(docs.length - room, at - Math.floor(room / 2)));
    list = docs.slice(start, start + room);
  }
  const items: DrawerItem[] = [];
  const indexOf = new Map<number, number>();
  for (const g of GROUPS) {
    items.push({ kind: 'divider', key: `div-${g.group}`, label: g.label });
    for (const d of list) {
      if (sourceType(d.source_type).group !== g.group) continue;
      indexOf.set(d.id, items.length);
      items.push(docCard(d));
    }
  }
  return { items, indexOf };
}

/** Citation numbers used in an answer (`[Memory 2]`, `[Memory 1, 3]`). */
export function citedNumbers(answer: string): number[] {
  const out = new Set<number>();
  for (const m of answer.matchAll(/\[\s*Memory\s+\d+(?:\s*,\s*(?:Memory\s+)?\d+)*\s*\]/gi)) {
    for (const n of m[0].match(/\d+/g) ?? []) out.add(Number(n));
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * The answer's drawer: a "Sources" divider and one card per returned passage, then the rest of the library behind a
 * "Library" divider. `sourceIndex[n - 1]` is the card for source n.
 */
export function answerDeck(sources: Source[], docs: Document[] | undefined): { items: DrawerItem[]; sourceIndex: number[] } {
  const items: DrawerItem[] = [{ kind: 'divider', key: 'div-sources', label: 'Sources' }];
  const sourceIndex: number[] = [];
  const used = new Set<number>();
  sources.forEach((s, i) => {
    const doc = docs ? matchDocument(s, docs) : undefined;
    if (doc) used.add(doc.id);
    sourceIndex.push(items.length);
    items.push({
      kind: 'card',
      key: `src-${i}`,
      cn: doc ? callNumber(doc) : `Source ${i + 1}`,
      date: doc ? formatDate(parseServerDate(doc.created_at)) : '',
      title: sourceTitle(s, doc),
      text: splitSpeaker(cleanText(s.excerpt)).text,
      src: doc ? sourceType(doc.source_type).label : s.filename,
    });
  });
  const rest = (docs ?? []).filter((d) => !used.has(d.id)).slice(0, MAX_CARDS - items.length - 1);
  if (rest.length) {
    items.push({ kind: 'divider', key: 'div-library', label: 'Library' });
    rest.forEach((d) => items.push(docCard(d)));
  }
  return { items, sourceIndex };
}
