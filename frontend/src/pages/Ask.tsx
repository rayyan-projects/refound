import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Copy, Inbox, RotateCw, AlertTriangle } from 'lucide-react';
import { useBackendStatus } from '../hooks/useBackendStatus';
import { useDocuments } from '../hooks/useDocuments';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useHistory } from '../hooks/useHistory';
import { useStore } from '../hooks/useStore';
import { classifyAnswer, stripCitations } from '../lib/answer';
import { formatDuration, parseServerDate, plural } from '../lib/format';
import { relevance } from '../lib/relevance';
import { ask, askStore, isAsking } from '../state/ask';
import { similarProblems } from '../types/provisional';
import { AnswerSheet } from '../components/ask/AnswerSheet';
import { AnswerSkeleton } from '../components/ask/AnswerSkeleton';
import { AskComposer } from '../components/ask/AskComposer';
import { LlmErrorNotice, NoKeyNotice, WeakMatchNotice } from '../components/ask/AnswerNotices';
import { RecentQuestions } from '../components/ask/RecentQuestions';
import { SeenBefore } from '../components/ask/SeenBefore';
import { SourceList } from '../components/ask/SourceList';
import { Button, ButtonLink } from '../components/ui/Button';
import { Callout } from '../components/ui/Callout';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { Spinner } from '../components/ui/Spinner';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      icon={copied ? Check : Copy}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

export default function AskPage() {
  useDocumentTitle('Ask · ReFound');
  const [params] = useSearchParams();
  const run = useStore(askStore);
  const { status: backend } = useBackendStatus();
  const docs = useDocuments();
  const history = useHistory();
  const [activeCite, setActiveCite] = useState<number | null>(null);
  const onCiteHover = useCallback((n: number | null) => setActiveCite(n), []);

  const offline = backend === 'offline';
  const docCount = docs.data?.length ?? 0;
  const passages = docs.data?.reduce((sum, d) => sum + d.chunk_count, 0) ?? 0;
  const libraryEmpty = docs.data !== undefined && docCount === 0;

  if (run.status === 'idle') {
    return (
      <div className="lg:pt-6">
        <div className="h-4">
          {docs.loading ? (
            <Skeleton className="h-3 w-48" />
          ) : docs.data ? (
            <p className="font-mono text-xs tabular-nums text-ink-3">
              {libraryEmpty ? '0 documents' : `${plural(docCount, 'document', 'documents')} · ${plural(passages, 'passage', 'passages')}`}
            </p>
          ) : null}
        </div>
        <h1 tabIndex={-1} className="mb-6 mt-2 font-serif text-title font-medium text-ink focus:outline-none md:text-page">
          Ask your library
        </h1>
        <div className="max-w-measure">
          <AskComposer
            size="lg"
            disabled={offline || libraryEmpty}
            placeholder={offline ? 'Backend offline' : 'Ask a question'}
            initialValue={params.get('q') ?? ''}
          />
          {libraryEmpty ? (
            <EmptyState
              icon={Inbox}
              title="Your library is empty"
              body="Import a conversation or a file, then ask about it"
              action={
                <ButtonLink variant="primary" to="/import">
                  Import
                </ButtonLink>
              }
            />
          ) : (
            <>
              <p className="mt-3 text-xs text-ink-3">Matches by meaning, not exact words</p>
              {!offline && !history.isError && <RecentQuestions items={history.data ?? []} loading={history.loading} />}
            </>
          )}
        </div>
      </div>
    );
  }

  const asking = isAsking(run.status);
  const kind = classifyAnswer(run.answer, run.sources);
  const announce =
    run.status === 'retrieving'
      ? 'Searching your library'
      : run.status === 'streaming'
        ? 'Writing the answer'
        : run.status === 'done'
          ? `Answer ready, ${plural(run.sources?.length ?? 0, 'source', 'sources')}`
          : run.status === 'stopped'
            ? 'Stopped'
            : 'The question could not be sent';

  const server = similarProblems(run.similarProblems);
  const seen =
    server.length > 0 ? (
      <div className="flex flex-col gap-3">
        {server.map((s) => (
          <SeenBefore
            key={s.history_id}
            basis="server"
            item={{ question: s.query_text, when: parseServerDate(s.created_at), href: `/history/${s.history_id}` }}
          />
        ))}
      </div>
    ) : run.askedBefore ? (
      <SeenBefore
        basis="wording"
        item={{ question: run.askedBefore.query_text, when: parseServerDate(run.askedBefore.created_at), href: `/history/${run.askedBefore.id}` }}
      />
    ) : null;

  const retry = () => void ask(run.question);
  const allWeak = run.status === 'done' && !!run.sources?.length && run.sources.every((s) => relevance(s.score).level === 'weak');
  const footer =
    run.status === 'done' || run.status === 'stopped' ? (
      <>
        <span className="font-mono text-xs tabular-nums text-ink-3">
          {run.status === 'stopped'
            ? 'Stopped'
            : [plural(run.sources?.length ?? 0, 'passage', 'passages'), formatDuration(run.durationMs)].filter(Boolean).join(' · ')}
        </span>
        <span className="flex-1" />
        <CopyButton text={stripCitations(run.answer)} />
        <Button variant="ghost" size="sm" icon={RotateCw} onClick={retry} disabled={offline}>
          Ask again
        </Button>
      </>
    ) : undefined;

  let main: ReactNode;
  let sources: ReactNode = null;
  const sourceList = (label?: string) => (
    <SourceList
      sources={run.status === 'stopped' ? [] : run.sources}
      loadingCount={run.topK}
      question={run.question}
      label={label}
      caption={run.status === 'streaming' ? 'Sources are listed when the answer is complete' : undefined}
      emptyText={run.status === 'stopped' ? 'Stopped before sources arrived' : undefined}
      activeCite={activeCite}
      onHover={onCiteHover}
      docs={docs.data}
    />
  );

  if (run.status === 'failed') {
    main = (
      <Callout
        tone="danger"
        icon={AlertTriangle}
        title="The question could not be sent"
        actions={
          <Button variant="secondary" size="sm" icon={RotateCw} onClick={retry} disabled={offline}>
            Try again
          </Button>
        }
      >
        {run.errorKind === 'network' ? 'The backend is not reachable' : run.error}
      </Callout>
    );
  } else if (run.status === 'retrieving' || (asking && kind.kind !== 'answer')) {
    main = <AnswerSkeleton />;
    sources = sourceList();
  } else if (kind.kind === 'empty-index') {
    main = (
      <EmptyState
        icon={Inbox}
        title="Nothing to search yet"
        body="The index is empty. Import a conversation or a file first"
        action={
          <ButtonLink variant="primary" to="/import">
            Import
          </ButtonLink>
        }
      />
    );
  } else if (kind.kind === 'no-key' || kind.kind === 'llm-error') {
    main = (
      <div className="flex flex-col gap-6">
        {kind.kind === 'no-key' ? <NoKeyNotice /> : <LlmErrorNotice detail={kind.detail} onRetry={retry} retryDisabled={offline} />}
        {sourceList('Closest passages')}
      </div>
    );
  } else {
    main = (
      <div className="flex flex-col gap-4">
        {allWeak && <WeakMatchNotice />}
        <AnswerSheet
          answer={run.answer}
          sourceCount={run.sources ? run.sources.length : null}
          streaming={run.status === 'streaming'}
          activeCite={activeCite}
          onCiteHover={onCiteHover}
          footer={footer}
        />
      </div>
    );
    sources = sourceList();
  }

  return (
    <div>
      <div className="flex h-5 items-center gap-2 text-sm text-ink-2">
        {run.status === 'retrieving' && (
          <>
            <Spinner label="Searching" /> Searching your library
          </>
        )}
        {run.status === 'streaming' && (
          <>
            <Spinner label="Writing" /> Writing
          </>
        )}
      </div>
      <h1 tabIndex={-1} className="mb-6 mt-2 max-w-measure break-words font-serif text-title font-medium text-ink focus:outline-none">
        {run.question}
      </h1>
      <div className="max-w-measure">
        <AskComposer size="md" disabled={offline} placeholder={offline ? 'Backend offline' : 'Ask a question'} />
      </div>
      <p role="status" className="sr-only">
        {announce}
      </p>
      <div className="mt-6 flex flex-col gap-10 xl:flex-row xl:items-start">
        <div className="flex w-full min-w-0 max-w-measure flex-col gap-4">
          {seen}
          {main}
        </div>
        {sources && (
          <div className="w-full min-w-0 max-w-measure xl:sticky xl:top-6 xl:w-rail xl:shrink-0">{sources}</div>
        )}
      </div>
    </div>
  );
}
