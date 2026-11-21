import { History as HistoryIcon } from 'lucide-react';
import { formatDate } from '../../lib/format';
import { ButtonLink } from '../ui/Button';
import { Callout } from '../ui/Callout';

export interface SeenBeforeItem {
  question: string;
  when: Date | null;
  href: string;
}

export function SeenBefore({ item, basis }: { item: SeenBeforeItem; basis: 'wording' | 'server' }) {
  return (
    <Callout
      tone="neutral"
      icon={HistoryIcon}
      actions={
        <ButtonLink variant="secondary" size="sm" to={item.href}>
          Open that answer
        </ButtonLink>
      }
    >
      {basis === 'server' ? (
        <p>
          You solved something similar on {formatDate(item.when)}: "{item.question}"
        </p>
      ) : (
        <>
          <p>You asked something close to this on {formatDate(item.when)}</p>
          <p className="mt-0.5 text-xs text-ink-3">Matched by wording against your recent questions</p>
        </>
      )}
    </Callout>
  );
}
