import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Clock, RotateCw, SearchX, Unplug } from 'lucide-react';
import { useDocuments } from '../hooks/useDocuments';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { HISTORY_LIMIT, useHistory } from '../hooks/useHistory';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { plural } from '../lib/format';
import { PageHeader } from '../components/shell/PageHeader';
import { HistoryDetail } from '../components/history/HistoryDetail';
import { HistoryList } from '../components/history/HistoryList';
import { Button, ButtonLink } from '../components/ui/Button';
import { Callout } from '../components/ui/Callout';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';

function ListSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-2">
      <span className="sr-only">Loading</span>
      <Skeleton className="mb-2 h-11 w-full md:h-9" />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} data-history-skeleton="" className="flex min-h-15 flex-col justify-center gap-2 px-3">
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <Skeleton className="h-6 w-3/4" />
      <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6 md:p-8">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-11/12" />
        <Skeleton className="h-3.5 w-5/6" />
        <Skeleton className="h-3.5 w-11/12" />
        <Skeleton className="h-3.5 w-3/5" />
      </div>
    </div>
  );
}

export default function HistoryPage() {
  useDocumentTitle('History · ReFound');
  const { id } = useParams();
  const wide = useMediaQuery('(min-width: 1024px)');
  const history = useHistory();
  const docs = useDocuments();
  const [filter, setFilter] = useState('');
  const offline = history.backendStatus === 'offline';
  const items = history.data;
  const routeId = id !== undefined ? Number(id) : null;
  const selectedId = routeId ?? (wide && items?.length ? items[0].id : null);
  const selected = items?.find((it) => it.id === selectedId) ?? null;

  const meta = items
    ? items.length >= HISTORY_LIMIT
      ? `Most recent ${HISTORY_LIMIT} questions`
      : plural(items.length, 'question', 'questions')
    : undefined;

  const back = (
    <ButtonLink variant="ghost" size="sm" icon={ArrowLeft} to="/history" className="-ml-2.5 mb-4 lg:hidden">
      History
    </ButtonLink>
  );

  let content;
  if (items) {
    if (items.length === 0) {
      content = (
        <EmptyState
          icon={Clock}
          title="No questions yet"
          body="Questions you ask are kept here with their answers and sources. They are saved when the backend has a Gemini key"
          action={
            <ButtonLink variant="primary" to="/ask">
              Ask a question
            </ButtonLink>
          }
        />
      );
    } else {
      const detail = selected ? (
        <HistoryDetail key={selected.id} item={selected} docs={docs.data} offline={offline} />
      ) : routeId !== null ? (
        <EmptyState
          icon={SearchX}
          title="That question is not in your recent history"
          className="py-0"
          action={
            <ButtonLink variant="ghost" to="/history">
              Back to history
            </ButtonLink>
          }
        />
      ) : null;
      content = (
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
          <div className={routeId !== null ? 'hidden lg:block lg:w-list lg:shrink-0' : 'w-full lg:w-list lg:shrink-0'}>
            <HistoryList items={items} filter={filter} onFilter={setFilter} selectedId={selectedId} />
          </div>
          {detail && (
            <div className={routeId !== null ? 'min-w-0 max-w-measure flex-1 lg:sticky lg:top-6' : 'hidden min-w-0 max-w-measure flex-1 lg:sticky lg:top-6 lg:block'}>
              {routeId !== null && back}
              {detail}
            </div>
          )}
        </div>
      );
    }
  } else if (history.isError) {
    content = (
      <Callout
        tone="danger"
        icon={AlertTriangle}
        title="History could not be loaded"
        actions={
          <Button variant="secondary" size="sm" icon={RotateCw} onClick={() => void history.refetch()}>
            Try again
          </Button>
        }
      >
        {history.error.message}
      </Callout>
    );
  } else if (offline) {
    content = <EmptyState icon={Unplug} title="Backend offline" body="History is stored with the backend. Reconnect to see it" />;
  } else {
    content = (
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
        <div className="w-full lg:w-list lg:shrink-0">
          <ListSkeleton />
        </div>
        <div className="hidden min-w-0 max-w-measure flex-1 lg:block">
          <DetailSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="History" meta={meta} loading={history.loading} />
      {content}
    </div>
  );
}
