import type { KeyboardEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { IconButton } from './IconButton';

export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)));
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const map: Record<string, number> = { ArrowUp: value + 1, ArrowRight: value + 1, ArrowDown: value - 1, ArrowLeft: value - 1, Home: min, End: max };
    if (e.key in map) {
      e.preventDefault();
      set(map[e.key]);
    }
  }
  return (
    <div className="inline-flex items-center gap-1">
      <IconButton icon={Minus} label={`Decrease ${label.toLowerCase()}`} variant="secondary" disabled={value <= min} onClick={() => set(value - 1)} />
      <div
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        onKeyDown={onKeyDown}
        className="flex h-9 w-11 items-center justify-center rounded text-md tabular-nums text-ink max-lg:h-11"
      >
        {value}
      </div>
      <IconButton icon={Plus} label={`Increase ${label.toLowerCase()}`} variant="secondary" disabled={value >= max} onClick={() => set(value + 1)} />
    </div>
  );
}
