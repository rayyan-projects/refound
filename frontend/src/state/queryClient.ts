import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '../services/api';

/** A failed request because nothing answered: re-check the backend at once instead of waiting for the poll. */
function onError(err: unknown): void {
  if (err instanceof ApiError && err.kind === 'network') {
    void queryClient.invalidateQueries({ queryKey: ['health'] });
  }
}

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (count, err) => !(err instanceof ApiError) && count < 1,
    },
  },
});
