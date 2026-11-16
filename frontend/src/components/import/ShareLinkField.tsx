import { useRef, useState } from 'react';
import { Link2 } from 'lucide-react';
import { parseShareLink } from '../../lib/shareLink';
import { enqueueUrl } from '../../state/importQueue';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';

export function ShareLinkField({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-ink-2">ChatGPT share link</h2>
      <form
        noValidate
        className="flex flex-col gap-2 sm:flex-row sm:items-start"
        onSubmit={(e) => {
          e.preventDefault();
          if (!value.trim()) return;
          const result = parseShareLink(value);
          if (!result.ok) {
            setError(result.message);
            return;
          }
          enqueueUrl(result.url);
          setValue('');
          setError(null);
          ref.current?.focus();
        }}
      >
        <TextField
          ref={ref}
          label="ChatGPT share link"
          hideLabel
          leadingIcon={Link2}
          placeholder="https://chatgpt.com/share/…"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={value}
          disabled={disabled}
          error={error ?? undefined}
          hint="Use Share, then Copy link, in ChatGPT"
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          wrapperClassName="min-w-0 flex-1"
        />
        <Button type="submit" variant="primary" disabled={disabled || !value.trim()} className="max-sm:self-start">
          Import link
        </Button>
      </form>
    </section>
  );
}
