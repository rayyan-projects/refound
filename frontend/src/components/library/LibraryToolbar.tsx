import { Search } from 'lucide-react';
import { SegmentedControl } from '../ui/SegmentedControl';
import type { SegmentOption } from '../ui/SegmentedControl';
import { Select } from '../ui/Select';
import { TextField } from '../ui/TextField';
import { SORT_OPTIONS } from './libraryOptions';

export function LibraryToolbar({
  q,
  onQ,
  type,
  onType,
  typeOptions,
  sort,
  onSort,
  topics,
  topic,
  onTopic,
  disabled,
}: {
  q: string;
  onQ: (v: string) => void;
  type: string;
  onType: (v: string) => void;
  typeOptions: SegmentOption[];
  sort: string;
  onSort: (v: string) => void;
  topics: string[];
  topic: string;
  onTopic: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <TextField
        label="Filter by title"
        hideLabel
        leadingIcon={Search}
        placeholder="Filter by title"
        type="search"
        value={q}
        disabled={disabled}
        onChange={(e) => onQ(e.target.value)}
        wrapperClassName="w-full md:w-filter"
      />
      <SegmentedControl label="Type" value={type} onChange={onType} options={typeOptions} disabled={disabled} className="max-md:w-full" />
      <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
        {topics.length > 0 && (
          <Select
            label="Topic"
            hideLabel
            value={topic}
            disabled={disabled}
            onChange={(e) => onTopic(e.target.value)}
            options={[{ value: '', label: 'All topics' }, ...topics.map((t) => ({ value: t, label: t }))]}
          />
        )}
        <Select label="Sort" hideLabel value={sort} disabled={disabled} onChange={(e) => onSort(e.target.value)} options={SORT_OPTIONS} />
      </div>
    </div>
  );
}
