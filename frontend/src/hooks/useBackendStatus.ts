import { useQuery } from '@tanstack/react-query';
import { healthCheck } from '../services/api';
import { useSettings } from './useSettings';

export type BackendStatus = 'checking' | 'online' | 'offline';

export function hostOf(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

export function useBackendStatus(): { status: BackendStatus; host: string; backendUrl: string; refetch: () => void } {
  const backendUrl = useSettings((s) => s.backendUrl);
  const q = useQuery({
    queryKey: ['health', backendUrl],
    queryFn: () => healthCheck(backendUrl),
    retry: false,
    staleTime: 0,
    refetchInterval: (query) => (query.state.data ? 30_000 : 5_000),
    refetchIntervalInBackground: true,
  });
  const status: BackendStatus = q.data === undefined ? 'checking' : q.data ? 'online' : 'offline';
  return { status, host: hostOf(backendUrl), backendUrl, refetch: () => void q.refetch() };
}
