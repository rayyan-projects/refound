import { useNavigate } from 'react-router-dom';
import { useConnect } from '../../hooks/useConnect';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';
import { ConnectionHelp } from '../settings/ConnectionHelp';

export function ConnectCard({ checking, host }: { checking: boolean; host: string }) {
  const navigate = useNavigate();
  const c = useConnect(() => navigate('/ask', { replace: true }));
  const busy = checking || c.testing;
  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void c.connect();
        }}
        noValidate
      >
        <TextField
          label="Backend address"
          type="url"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          value={c.value}
          readOnly={checking}
          onChange={(e) => c.setValue(e.target.value)}
          error={c.message}
          hint={!c.error && !checking ? `No backend found at ${host} yet` : undefined}
        />
        <Button type="submit" variant="primary" size="lg" loading={busy} className="self-start">
          {checking ? 'Looking for the backend' : c.testing ? 'Connecting' : 'Connect'}
        </Button>
      </form>
      {c.error?.kind === 'unreachable' && <ConnectionHelp url={c.error.url} />}
    </div>
  );
}
