import type { ReactNode } from 'react';
import { AnswerBody } from './AnswerBody';

export function AnswerSheet({
  answer,
  sourceCount,
  streaming,
  onCiteHover,
  activeCite = null,
  footer,
}: {
  answer: string;
  sourceCount: number | null;
  streaming: boolean;
  onCiteHover?: (n: number | null) => void;
  activeCite?: number | null;
  footer?: ReactNode;
}) {
  return (
    <article aria-live="off" className="animate-rise">
      <AnswerBody answer={answer} sourceCount={sourceCount} streaming={streaming} activeCite={activeCite} onCiteHover={onCiteHover} />
      {footer && <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">{footer}</div>}
    </article>
  );
}
