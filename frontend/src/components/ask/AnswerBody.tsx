import { lazy, Suspense, useMemo } from 'react';
import type { Components } from 'react-markdown';
import clsx from 'clsx';
import { linkCitations } from '../../lib/answer';
import { CitationMark } from './CitationMark';
import { caretClasses, readingText } from './answerStyles';

const Markdown = lazy(() => import('react-markdown'));

export function AnswerBody({
  answer,
  sourceCount,
  streaming,
  activeCite = null,
  onCiteHover,
}: {
  answer: string;
  sourceCount: number | null;
  streaming: boolean;
  activeCite?: number | null;
  onCiteHover?: (n: number | null) => void;
}) {
  const markdown = linkCitations(answer, sourceCount);
  const interactive = sourceCount !== null && !streaming;

  const components = useMemo<Components>(
    () => ({
      p: ({ children }) => <p className={clsx(readingText, 'mb-4 last:mb-0')}>{children}</p>,
      strong: ({ children }) => <strong className="font-medium">{children}</strong>,
      em: ({ children }) => <em className="italic">{children}</em>,
      ul: ({ children }) => <ul className={clsx(readingText, 'mb-4 flex list-disc flex-col gap-2 pl-6 last:mb-0')}>{children}</ul>,
      ol: ({ children }) => <ol className={clsx(readingText, 'mb-4 flex list-decimal flex-col gap-2 pl-6 last:mb-0')}>{children}</ol>,
      h1: ({ children }) => <h3 className="mb-2 mt-6 font-sans text-md font-medium text-ink first:mt-0">{children}</h3>,
      h2: ({ children }) => <h3 className="mb-2 mt-6 font-sans text-md font-medium text-ink first:mt-0">{children}</h3>,
      h3: ({ children }) => <h3 className="mb-2 mt-6 font-sans text-md font-medium text-ink first:mt-0">{children}</h3>,
      h4: ({ children }) => <h4 className="mb-2 mt-6 font-sans text-md font-medium text-ink first:mt-0">{children}</h4>,
      h5: ({ children }) => <h5 className="mb-2 mt-6 font-sans text-md font-medium text-ink first:mt-0">{children}</h5>,
      h6: ({ children }) => <h6 className="mb-2 mt-6 font-sans text-md font-medium text-ink first:mt-0">{children}</h6>,
      code: ({ children }) => <code className="rounded-sm bg-sunken px-1 font-mono text-sm">{children}</code>,
      pre: ({ children }) => (
        <pre className="mb-4 overflow-x-auto rounded bg-sunken p-4 font-mono text-sm text-ink last:mb-0 [&>code]:bg-transparent [&>code]:p-0">
          {children}
        </pre>
      ),
      blockquote: ({ children }) => <blockquote className="mb-4 border-l-2 border-line-strong pl-4 text-ink-2 last:mb-0">{children}</blockquote>,
      hr: () => <hr className="my-6 border-0 border-t border-line" />,
      img: ({ alt }) => <>{alt ?? ''}</>,
      a: ({ href, children }) => {
        if (href?.startsWith('#source-')) {
          const n = Number(href.slice('#source-'.length));
          return <CitationMark n={n} active={activeCite === n} interactive={interactive} onHover={onCiteHover} />;
        }
        return (
          <a href={href} target="_blank" rel="noreferrer noopener" className="text-accent underline underline-offset-2">
            {children}
          </a>
        );
      },
    }),
    [activeCite, interactive, onCiteHover],
  );

  const fallback = (
    <>
      {answer
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map((p, i) => (
          <p key={i} className={clsx(readingText, 'mb-4 last:mb-0')}>
            {p.replace(/\[\s*Memory\s+(\d+)\s*\]/gi, '[$1]')}
          </p>
        ))}
    </>
  );

  return (
    <div className={clsx('min-w-0 break-words', streaming && caretClasses)}>
      <Suspense fallback={fallback}>
        <Markdown components={components} skipHtml>
          {markdown}
        </Markdown>
      </Suspense>
    </div>
  );
}
