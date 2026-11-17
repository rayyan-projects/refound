import { PLANNED } from '../../lib/planned';
import { Tag } from '../ui/Tag';

export function PlannedList() {
  return (
    <div>
      <p className="mb-3 text-base text-ink-2">These are on the roadmap and do not work yet</p>
      <ul className="divide-y divide-line border-y border-line">
        {PLANNED.map((f) => (
          <li key={f.name} data-planned-row="" className="flex items-start gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{f.name}</p>
              <p className="mt-0.5 text-sm text-ink-2">{f.description}</p>
            </div>
            <Tag className="mt-0.5">Not built yet</Tag>
          </li>
        ))}
      </ul>
    </div>
  );
}
