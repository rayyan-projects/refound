import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { healthCheck } from '../services/api';
import { normaliseUrl, setBackendUrl } from '../state/settings';
import { toast } from '../state/toasts';
import { hostOf } from './useBackendStatus';
import { useSettings } from './useSettings';

export type ConnectError = { kind: 'invalid' } | { kind: 'unreachable'; url: string };

function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.host;
  } catch {
    return false;
  }
}

/** Shared by the Welcome ConnectCard and Settings ConnectionForm: test an address, then save it. */
export function useConnect(onConnected?: (url: string) => void) {
  const stored = useSettings((s) => s.backendUrl);
  const client = useQueryClient();
  const [value, setValue] = useState(stored);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<ConnectError | null>(null);

  async function connect(): Promise<void> {
    const url = normaliseUrl(value);
    if (!isHttpUrl(url)) {
      setError({ kind: 'invalid' });
      return;
    }
    setTesting(true);
    setError(null);
    const ok = await healthCheck(url);
    setTesting(false);
    if (!ok) {
      setError({ kind: 'unreachable', url });
      return;
    }
    client.setQueryData(['health', url], true);
    setBackendUrl(url);
    setValue(url);
    toast(`Connected to ${hostOf(url)}`, { tone: 'success' });
    onConnected?.(url);
  }

  const message =
    error?.kind === 'invalid'
      ? 'Enter an address such as http://localhost:8000'
      : error?.kind === 'unreachable'
        ? `Nothing answered at ${error.url}`
        : undefined;

  return {
    value,
    setValue: (v: string) => {
      setValue(v);
      if (error) setError(null);
    },
    testing,
    error,
    message,
    connect,
  };
}
