import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Upload } from 'lucide-react';
import { useBackendStatus } from '../../hooks/useBackendStatus';
import { enqueueFiles } from '../../state/importQueue';
import { Icon } from '../ui/Icon';

function carriesFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files');
}

/** Files dragged anywhere over the app: an overlay, and a drop enqueues them and opens Import. */
export function DropOverlay() {
  const { status } = useBackendStatus();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [dragging, setDragging] = useState(false);
  const online = status === 'online';
  const onImport = pathname === '/import';

  useEffect(() => {
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      depth++;
      setDragging(true);
    };
    const over = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = online ? 'copy' : 'none';
    };
    const leave = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0 || e.relatedTarget === null) {
        depth = 0;
        setDragging(false);
      }
    };
    const drop = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (!online) return;
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length === 0) return;
      enqueueFiles(files);
      if (!onImport) navigate('/import');
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        depth = 0;
        setDragging(false);
      }
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
      window.removeEventListener('keydown', key);
    };
  }, [online, onImport, navigate]);

  // On Import the page's own drop zone shows the drag state.
  if (!dragging || onImport) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex animate-fade-in items-center justify-center bg-overlay p-4">
      <div className="flex max-w-narrow flex-col items-start gap-1 rounded-xl border border-dashed border-line-strong bg-raised p-10 shadow-2">
        <span className="mb-2 text-ink-3">
          <Icon icon={Upload} size={20} />
        </span>
        <p className="font-serif text-title font-medium text-ink">{online ? 'Drop to import' : 'The backend is offline'}</p>
        <p className="text-base text-ink-2">{online ? 'Files are indexed on your machine' : 'Reconnect, then drop the files again'}</p>
      </div>
    </div>
  );
}
