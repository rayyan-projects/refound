import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Inbox, Plus, RotateCw, SearchX, Unplug } from 'lucide-react';
import type { Document } from '../services/api';
import { useDeleteDocument, useDocuments } from '../hooks/useDocuments';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { displayTitle, sourceType } from '../lib/documents';
import { parseServerDate, plural } from '../lib/format';
import { toast } from '../state/toasts';
import { documentTopics } from '../types/provisional';
import { PageHeader } from '../components/shell/PageHeader';
import { DocumentList, DocumentListSkeleton } from '../components/library/DocumentList';
import { LibraryToolbar } from '../components/library/LibraryToolbar';
import { SORT_OPTIONS, TYPE_OPTIONS } from '../components/library/libraryOptions';
import { Button, ButtonLink } from '../components/ui/Button';
import { Callout } from '../components/ui/Callout';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { CardDrawer } from '../components/drawer/CardDrawer';
import { libraryDeck } from '../components/drawer/decks';

function time(doc: Document): number {
  return parseServerDate(doc.created_at)?.getTime() ?? 0;
}

export default function LibraryPage() {
  useDocumentTitle('Library · ReFound');
  const [params, setParams] = useSearchParams();
  const docs = useDocuments();
  const del = useDeleteDocument();
  const [pending, setPending] = useState<Document | null>(null);

  const q = params.get('q') ?? '';
  const type = TYPE_OPTIONS.some((o) => o.value === params.get('type')) ? (params.get('type') as string) : 'all';
  const sort = SORT_OPTIONS.some((o) => o.value === params.get('sort')) ? (params.get('sort') as string) : 'newest';
  const topic = params.get('topic') ?? '';

  function setParam(key: string, value: string, fallback: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (!value || value === fallback) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  }

  const all = useMemo(() => docs.data ?? [], [docs.data]);
  const topics = useMemo(() => [...new Set(all.flatMap((d) => documentTopics(d)))].sort(), [all]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length, chats: 0, notes: 0, pdfs: 0, images: 0 };
    for (const d of all) c[sourceType(d.source_type).group]++;
    return c;
  }, [all]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = all.filter(
      (d) =>
        (type === 'all' || sourceType(d.source_type).group === type) &&
        (!needle || displayTitle(d).toLowerCase().includes(needle)) &&
        (!topic || documentTopics(d).includes(topic)),
    );
    if (sort === 'oldest') list.sort((a, b) => time(a) - time(b));
    else if (sort === 'title') list.sort((a, b) => displayTitle(a).localeCompare(displayTitle(b), undefined, { sensitivity: 'base' }));
    else list.sort((a, b) => time(b) - time(a));
    return list;
  }, [all, q, type, sort, topic]);

  // The drawer shows the filtered list, windowed to about 40 cards around the row under the pointer.
  const [hoverDoc, setHoverDoc] = useState<number | null>(null);
  const [windowAt, setWindowAt] = useState<number | null>(null);
  const deck = useMemo(() => libraryDeck(visible, windowAt), [visible, windowAt]);
  const onRowHover = (id: number | null) => {
    setHoverDoc(id);
    if (id !== null && !deck.indexOf.has(id)) setWindowAt(id);
  };
  const drawerFocus = hoverDoc !== null ? (deck.indexOf.get(hoverDoc) ?? null) : null;
  const emptyDeck = useMemo(() => libraryDeck([]).items, []);

  const offline = docs.backendStatus === 'offline';
  const passages = all.reduce((sum, d) => sum + d.chunk_count, 0);
  const meta = docs.data ? `${plural(all.length, 'document', 'documents')} · ${plural(passages, 'passage', 'passages')}` : undefined;
  const typeOption = TYPE_OPTIONS.find((o) => o.value === type) ?? TYPE_OPTIONS[0];

  const header = (
    <PageHeader
      title="Library"
      meta={meta}
      loading={docs.loading}
      actions={
        <ButtonLink variant="primary" icon={Plus} to="/import">
          Import
        </ButtonLink>
      }
    />
  );

  let body;
  if (docs.data) {
    if (all.length === 0) {
      body = (
        <>
        <CardDrawer
          items={emptyDeck}
          flagged={[]}
          focus={null}
          label="An empty card drawer with its four dividers: chats, notes, PDFs and images"
          className="h-56 w-full md:h-72"
        />
        <p className="mt-3 text-sm text-ink-3">An empty drawer. Each document you import is filed behind its divider</p>
        <EmptyState
          icon={Inbox}
          title="Nothing in your library yet"
          body="Import ChatGPT or Claude conversations, notes, PDFs or images. They are indexed on this machine"
          action={
            <ButtonLink variant="primary" to="/import">
              Import
            </ButtonLink>
          }
        />
        </>
      );
    } else {
      const clear = () => setParams(new URLSearchParams(), { replace: true });
      body = (
        <>
          <LibraryToolbar
            q={q}
            onQ={(v) => setParam('q', v, '')}
            type={type}
            onType={(v) => setParam('type', v, 'all')}
            typeOptions={TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label, count: counts[o.value] }))}
            sort={sort}
            onSort={(v) => setParam('sort', v, 'newest')}
            topics={topics}
            topic={topic}
            onTopic={(v) => setParam('topic', v, '')}
          />
          {docs.isError && (
            <Callout tone="danger" icon={AlertTriangle} title="The library could not be refreshed" className="mb-4">
              {docs.error.message}
            </Callout>
          )}
          {visible.length > 0 && (
            <CardDrawer
              items={deck.items}
              flagged={[]}
              focus={drawerFocus}
              lowRes
              label="Your library as a card drawer, split by divider cards for chats, notes, PDFs and images"
              className="mb-6 h-64 w-full md:h-96"
            />
          )}
          <DocumentList
            onHover={onRowHover}
            docs={visible}
            onDelete={setPending}
            deletingId={del.isPending ? (del.variables?.id ?? null) : null}
            disabled={offline}
            empty={
              <EmptyState
                icon={SearchX}
                title="No documents match"
                body={q.trim() ? `Nothing matches "${q.trim()}" in ${typeOption.phrase}` : `There are no ${typeOption.phrase} in your library`}
                action={
                  <Button variant="ghost" onClick={clear}>
                    Clear filters
                  </Button>
                }
              />
            }
          />
        </>
      );
    }
  } else if (docs.isError) {
    body = (
      <Callout
        tone="danger"
        icon={AlertTriangle}
        title="The library could not be loaded"
        actions={
          <Button variant="secondary" size="sm" icon={RotateCw} onClick={() => void docs.refetch()}>
            Try again
          </Button>
        }
      >
        {docs.error.message}
      </Callout>
    );
  } else if (offline) {
    body = <EmptyState icon={Unplug} title="Backend offline" body="Your library is stored with the backend. Reconnect to see it" />;
  } else {
    body = (
      <>
        <LibraryToolbar
          q={q}
          onQ={() => undefined}
          type={type}
          onType={() => undefined}
          typeOptions={TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          sort={sort}
          onSort={() => undefined}
          topics={[]}
          topic=""
          onTopic={() => undefined}
          disabled
        />
        <DocumentListSkeleton />
      </>
    );
  }

  const pendingTitle = pending ? displayTitle(pending) : '';
  return (
    <div>
      {header}
      {body}
      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        tone="danger"
        title={`Delete "${pendingTitle}"?`}
        body={
          pending
            ? `Its ${plural(pending.chunk_count, 'passage', 'passages')} ${pending.chunk_count === 1 ? 'is' : 'are'} removed from the index. Past answers that cited it keep their text. This cannot be undone`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!pending) return;
          await del.mutateAsync(pending);
          toast(`Deleted "${pendingTitle}"`, { tone: 'success' });
          requestAnimationFrame(() => document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true }));
        }}
      />
    </div>
  );
}
