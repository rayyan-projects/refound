import { queryTerms } from '../../lib/text';
import { AnswerSheet } from '../ask/AnswerSheet';
import { SourceCard } from '../ask/SourceCard';
import { EXAMPLE_ANSWER, EXAMPLE_QUESTION, EXAMPLE_SOURCES } from './exampleContent';

export function ExampleSheet() {
  const terms = queryTerms(EXAMPLE_QUESTION);
  return (
    <figure className="w-full max-w-column">
      <figcaption className="mb-3 text-xs text-ink-3">Example</figcaption>
      <div aria-hidden="true" inert className="pointer-events-none flex select-none flex-col gap-4">
        <p className="font-serif text-title font-medium text-ink">{EXAMPLE_QUESTION}</p>
        <AnswerSheet answer={EXAMPLE_ANSWER} sourceCount={EXAMPLE_SOURCES.length} streaming={false} />
        <ol className="flex flex-col gap-3">
          {EXAMPLE_SOURCES.map(({ source, doc }, i) => (
            <SourceCard key={doc.id} index={i + 1} source={source} doc={doc} terms={terms} showActions={false} />
          ))}
        </ol>
      </div>
    </figure>
  );
}
