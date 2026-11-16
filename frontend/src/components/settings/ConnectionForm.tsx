import { useConnect } from '../../hooks/useConnect';
import { DEFAULT_BACKEND_URL, normaliseUrl } from '../../state/settings';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';
import { ConnectionHelp } from './ConnectionHelp';

export function ConnectionForm() {
  const c = useConnect();
  return (
    <div className="flex flex-col gap-4">
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void c.connect();
        }}
      >
        <TextField
          label="Backend address"
          type="url"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          value={c.value}
          onChange={(e) => c.setValue(e.target.value)}
          error={c.message}
          hint="Where the ReFound backend runs. The default is http://localhost:8000"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" loading={c.testing}>
            {c.testing ? 'Connecting' : 'Connect'}
          </Button>
          {normaliseUrl(c.value) !== DEFAULT_BACKEND_URL && (
            <Button variant="ghost" onClick={() => c.setValue(DEFAULT_BACKEND_URL)}>
              Reset to default
            </Button>
          )}
        </div>
      </form>
      {c.error?.kind === 'unreachable' && <ConnectionHelp url={c.error.url} />}
    </div>
  );
}
