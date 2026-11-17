import { Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { Document } from '../../services/api';
import { callNumber, displayTitle, isUrl, originLabel, typeIcon } from '../../lib/documents';
import { formatCount, formatDate, formatDateTime, parseServerDate, plural } from '../../lib/format';
import { cleanText } from '../../lib/text';
import { documentSummary, documentTopics } from '../../types/provisional';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { Spinner } from '../ui/Spinner';
import { Tag } from '../ui/Tag';
import { SummaryBlock } from './SummaryBlock';
import { TopicTags } from './TopicTags';

function Status({ doc }: { doc: Document }) {
  if (doc.status === 'error') return <Tag tone="danger">Failed</Tag>;
  if (doc.status === 'pending')
    return (
      <Tag>
        <Spinner label="Indexing" />
        Indexing
      </Tag>
    );
  // The normal case stays quiet; on narrow screens it is left out to give the title room.
  return <span className="hidden text-xs text-ink-3 md:inline">Indexed</span>;
}

export function DocumentRow({
  doc,
  onDelete,
  deleting,
  disabled,
}: {
  doc: Document;
  onDelete: (doc: Document) => void;
  deleting: boolean;
  disabled?: boolean;
}) {
  const title = displayTitle(doc);
  const origin = originLabel(doc);
  const created = parseServerDate(doc.created_at);
  const topics = documentTopics(doc);
  const summary = documentSummary(doc);
  return (
    <tr
      data-doc-row=""
      aria-busy={deleting || undefined}
      className={clsx(
        'group flex items-start gap-3 border-t border-line px-4 py-3 transition-colors duration-fast ease-out first:border-t-0 hover:bg-hover md:table-row md:p-0',
        deleting && 'opacity-50',
      )}
    >
      <td className="min-w-0 flex-1 md:py-2.5 md:pl-4 md:pr-3">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 shrink-0 text-ink-3">
            <Icon icon={typeIcon(doc.source_type)} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base text-ink" title={title}>
              {title}
            </p>
            {origin &&
              (isUrl(doc.filename) ? (
                <a
                  href={doc.filename}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={doc.filename}
                  className="block truncate text-xs text-ink-3 underline-offset-2 hover:text-ink-2 hover:underline"
                >
                  {origin}
                </a>
              ) : (
                <p className="truncate text-xs text-ink-3" title={origin}>
                  {origin}
                </p>
              ))}
            <p className="mt-0.5 flex flex-wrap gap-x-1.5 text-xs tabular-nums text-ink-3 md:hidden">
              <span className="whitespace-nowrap">{callNumber(doc)} ·</span>
              <span className="whitespace-nowrap">{plural(doc.chunk_count, 'passage', 'passages')} ·</span>
              <span className="whitespace-nowrap">{formatDate(created)}</span>
            </p>
            {doc.status === 'error' && (
              <p className="mt-0.5 text-xs text-danger">
                {(doc.error_message && cleanText(doc.error_message)) || 'Indexing failed'}. Delete it, then import the file again
              </p>
            )}
            {topics.length > 0 && (
              <div className="mt-1.5">
                <TopicTags topics={topics} />
              </div>
            )}
            {summary && <SummaryBlock text={summary} />}
          </div>
        </div>
      </td>
      <td className="hidden align-top md:table-cell md:py-3 md:pr-3">
        <span title="Call number" className="text-xs tabular-nums text-ink-3">
          {callNumber(doc)}
        </span>
      </td>
      <td className="hidden text-right align-top md:table-cell md:py-3 md:pr-6">
        <span className="text-xs tabular-nums text-ink-3">{formatCount(doc.chunk_count)}</span>
      </td>
      <td className="hidden align-top md:table-cell md:py-3 md:pr-3">
        <span data-imported="" title={formatDateTime(created)} className="text-xs tabular-nums text-ink-2">
          {formatDate(created)}
        </span>
      </td>
      <td className="shrink-0 pt-0.5 align-top md:table-cell md:py-3 md:pr-3">
        <Status doc={doc} />
      </td>
      <td className="-my-1 -mr-2 shrink-0 align-top md:m-0 md:table-cell md:py-1.5 md:pr-2">
        {deleting ? (
          <span className="flex h-9 w-9 items-center justify-center text-ink-3 max-lg:h-11 max-lg:w-11">
            <Spinner label="Deleting" />
          </span>
        ) : (
          <IconButton
            icon={Trash2}
            label={`Delete ${title}`}
            disabled={disabled}
            onClick={() => onDelete(doc)}
            className="lg:opacity-0 lg:focus-visible:opacity-100 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100"
          />
        )}
      </td>
    </tr>
  );
}
