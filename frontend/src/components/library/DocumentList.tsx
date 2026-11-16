import type { ReactNode } from 'react';
import type { Document } from '../../services/api';
import { Skeleton } from '../ui/Skeleton';
import { DocumentRow } from './DocumentRow';

function Head() {
  const th = 'h-9 text-left align-middle text-xs font-normal text-ink-3';
  return (
    <thead className="hidden md:table-header-group">
      <tr className="border-b border-line">
        <th scope="col" className={`${th} pl-11 pr-3`}>
          Title
        </th>
        <th scope="col" className={`${th} w-28 pr-3`}>
          Call number
        </th>
        <th scope="col" className={`${th} w-22 pr-6 text-right`}>
          Passages
        </th>
        <th scope="col" className={`${th} w-30 pr-3`}>
          Imported
        </th>
        <th scope="col" className={`${th} w-26 pr-3`}>
          Status
        </th>
        <th scope="col" className={`${th} w-11`}>
          <span className="sr-only">Actions</span>
        </th>
      </tr>
    </thead>
  );
}

export function DocumentList({
  docs,
  onDelete,
  deletingId,
  disabled,
  empty,
}: {
  docs: Document[];
  onDelete: (doc: Document) => void;
  deletingId: number | null;
  disabled?: boolean;
  empty?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      {docs.length === 0 && empty ? (
        <div className="px-6">{empty}</div>
      ) : (
        <table className="block w-full md:table md:table-fixed">
          <Head />
          <tbody className="block md:table-row-group">
            {docs.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} onDelete={onDelete} deleting={deletingId === doc.id} disabled={disabled} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function DocumentListSkeleton() {
  return (
    <div aria-busy="true" className="overflow-hidden rounded-lg border border-line bg-surface">
      <span className="sr-only">Loading</span>
      <div className="hidden h-9 border-b border-line md:block" />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} data-doc-skeleton="" className="flex h-15 items-center gap-3 border-t border-line px-4 first:border-t-0">
          <Skeleton className="h-4 w-4 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="hidden h-3 w-16 md:block" />
          <Skeleton className="hidden h-3 w-10 md:block" />
          <Skeleton className="hidden h-3 w-18 md:block" />
          <span className="hidden w-30 md:block" />
        </div>
      ))}
    </div>
  );
}
