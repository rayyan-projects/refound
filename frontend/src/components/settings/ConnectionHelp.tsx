import { useState } from 'react';
import { Check, Copy, Info } from 'lucide-react';
import { Button } from '../ui/Button';
import { Callout } from '../ui/Callout';

const START = 'cd backend\nuvicorn main:app --reload --port 8000';

function isLocal(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

function isMixedContent(url: string): boolean {
  try {
    const u = new URL(url);
    return window.location.protocol === 'https:' && u.protocol === 'http:' && !isLocal(u.hostname);
  } catch {
    return false;
  }
}

export function ConnectionHelp({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const origin = window.location.origin;
  const mixed = isMixedContent(url);

  async function copy() {
    try {
      await navigator.clipboard.writeText(START);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Callout tone="neutral" icon={Info} title="If the backend is not running">
      <ol className="mt-1 flex list-decimal flex-col gap-2 pl-5 text-base text-ink">
        <li>
          Start it:
          <div className="relative mt-2 rounded bg-sunken p-3 pr-24">
            <pre className="whitespace-pre-wrap break-words font-mono text-sm text-ink">{START}</pre>
            <Button variant="ghost" size="sm" icon={copied ? Check : Copy} onClick={() => void copy()} className="absolute right-1.5 top-1.5">
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </li>
        <li>If it runs on another address or port, enter that address above</li>
        {origin !== 'http://localhost:5173' && (
          <li>
            This page is served from <span className="font-mono text-sm">{origin}</span>. Set{' '}
            <code className="rounded-sm bg-sunken px-1 font-mono text-sm">FRONTEND_ORIGIN={origin}</code> in{' '}
            <code className="rounded-sm bg-sunken px-1 font-mono text-sm">backend/.env</code> and restart the backend, or the browser will block the
            connection
          </li>
        )}
        {mixed && <li>Browsers block an https page from calling an http address. Use localhost, or serve the backend over https</li>}
      </ol>
    </Callout>
  );
}
