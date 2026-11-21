import { useDocuments } from '../../hooks/useDocuments';
import { useStore } from '../../hooks/useStore';
import { importQueueStore } from '../../state/importQueue';

/** Library: document count when known. Import: queued or working items while the queue runs. */
export function useNavCounts(): { library: number | null; import: number | null } {
  const docs = useDocuments();
  const active = useStore(importQueueStore, (list) => list.filter((it) => it.status === 'queued' || it.status === 'working').length);
  return { library: docs.data ? docs.data.length : null, import: active > 0 ? active : null };
}
