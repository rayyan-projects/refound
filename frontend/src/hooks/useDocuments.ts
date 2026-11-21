import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteDocument, listDocuments } from '../services/api';
import type { Document } from '../services/api';
import { useBackendStatus } from './useBackendStatus';

export function useDocuments() {
  const { status, backendUrl } = useBackendStatus();
  const query = useQuery({
    queryKey: ['documents', backendUrl],
    queryFn: () => listDocuments(backendUrl),
    enabled: status === 'online',
  });
  /** True while there is nothing to show yet and a result is still coming (not when offline). */
  const loading = query.data === undefined && !query.isError && status !== 'offline';
  return { ...query, loading, backendStatus: status };
}

export function useDeleteDocument() {
  const { backendUrl } = useBackendStatus();
  const client = useQueryClient();
  const key = ['documents', backendUrl];
  return useMutation({
    mutationFn: (doc: Document) => deleteDocument(backendUrl, doc.id),
    onMutate: async (doc: Document) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<Document[]>(key);
      client.setQueryData<Document[]>(key, (list) => list?.filter((d) => d.id !== doc.id));
      return { previous };
    },
    onError: (_err, _doc, ctx) => {
      if (ctx?.previous) client.setQueryData(key, ctx.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['documents'] }),
  });
}
