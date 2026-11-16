import { useQuery } from '@tanstack/react-query';
import { getHistory } from '../services/api';
import { useBackendStatus } from './useBackendStatus';

export const HISTORY_LIMIT = 100;

export function useHistory() {
  const { status, backendUrl } = useBackendStatus();
  const query = useQuery({
    queryKey: ['history', backendUrl],
    queryFn: () => getHistory(backendUrl, HISTORY_LIMIT),
    enabled: status === 'online',
  });
  const loading = query.data === undefined && !query.isError && status !== 'offline';
  return { ...query, loading, backendStatus: status };
}
