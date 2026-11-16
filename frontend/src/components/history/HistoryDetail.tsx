import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, Info, RotateCw } from 'lucide-react';
import type { Document, HistoryItem } from '../../services/api';
import { classifyAnswer, stripCitations } from '../../lib/answer';
import { formatDateTime, parseServerDate } from '../../lib/format';
import { relevance } from '../../lib/relevance';
import { ask } from '../../state/ask';
import { similarProblems } from '../../types/provisional';
import { AnswerSheet } from '../ask/AnswerSheet';
import { LlmErrorNotice, NoKeyNotice, WeakMatchNotice } from '../ask/AnswerNotices';
import { SeenBefore } from '../ask/SeenBefore';
import { SourceList } from '../ask/SourceList';
import { Button } from '../ui/Button';
import { Callout } from '../ui/Callout';
import { EmptyState } from '../ui/EmptyState';
import { Inbox } from 'lucide-react';

export function HistoryDetail({ item, docs, offline }: { item: HistoryItem; docs?: Document[]; offline: boolean }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [activeCite, setActiveCite] = useState<number | null>(null);
  const onHover = useCallback((n: number | null) => setActiveCite(n), []);
  const answer = item.answer ?? '';
  const sources = item.sources ?? [];
  const kind = classifyAnswer(answer, sources);
  const similar = similarProblems(item.similar_problems);
  const allWeak = sources.length > 0 && sources.every((s) => relevance(s.score).level === 'weak');

  function askAgain() {
    void ask(item.query_text);
    navigate(`/ask?q=${encodeURIComponent(item.query_text)}`);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(stripCitations(answer));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  let body;
  if (!answer.trim()) {
    body = (
      <Callout tone="neutral" icon={Info}>
        No answer was saved for this question
      </Callout>
    );
  } else if (kind.kind === 'empty-index') {
    body = <EmptyState icon={Inbox} title="Nothing to search yet" body="The index was empty when this was asked" />;
  } else if (kind.kind === 'no-key' || kind.kind === 'llm-error') {
    body = (
      <>
        {kind.kind === 'no-key' ? <NoKeyNotice /> : <LlmErrorNotice detail={kind.detail} onRetry={askAgain} retryDisabled={offline} />}
        <SourceList sources={sources} loadingCount={0} question={item.query_text} label="Closest passages" docs={docs} />
      </>
    );
  } else {
    body = (
      <>
        {allWeak && <WeakMatchNotice />}
        <AnswerSheet answer={answer} sourceCount={sources.length} streaming={false} activeCite={activeCite} onCiteHover={onHover} />
        <SourceList sources={sources} loadingCount={0} question={item.query_text} docs={docs} activeCite={activeCite} onHover={onHover} />
      </>
    );
  }

  return (
    <article className="flex min-w-0 flex-col gap-4">
      <div>
        <h2 className="break-words font-serif text-title font-medium text-ink">{item.query_text}</h2>
        <p className="mt-1 text-xs text-ink-3">{formatDateTime(parseServerDate(item.created_at))}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" size="sm" icon={RotateCw} onClick={askAgain} disabled={offline}>
            Ask again
          </Button>
          {answer.trim() && (
            <Button variant="ghost" size="sm" icon={copied ? Check : Copy} onClick={() => void copy()}>
              {copied ? 'Copied' : 'Copy answer'}
            </Button>
          )}
        </div>
      </div>
      {similar.map((s) => (
        <SeenBefore key={s.history_id} basis="server" item={{ question: s.query_text, when: parseServerDate(s.created_at), href: `/history/${s.history_id}` }} />
      ))}
      {body}
    </article>
  );
}
