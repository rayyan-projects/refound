import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { FolderOpen, Plus, Upload } from 'lucide-react';
import clsx from 'clsx';
import { isSupportedFile, SUPPORTED_EXTENSIONS } from '../../lib/documents';
import { enqueueFiles } from '../../state/importQueue';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Icon } from '../ui/Icon';

const ACCEPT = SUPPORTED_EXTENSIONS.join(',');
const FOLDER_CONFIRM_OVER = 50;

function relativePath(file: File): string {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}

function hasFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files');
}

export function Dropzone({ disabled = false }: { disabled?: boolean }) {
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [over, setOver] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [pendingFolder, setPendingFolder] = useState<File[] | null>(null);

  useEffect(() => {
    folderRef.current?.setAttribute('webkitdirectory', '');
    folderRef.current?.setAttribute('directory', '');
  }, []);

  function onFolder(list: FileList | null) {
    const files = Array.from(list ?? []).filter(
      (f) => isSupportedFile(f.name) && !relativePath(f).split('/').some((part) => part.startsWith('.')),
    );
    if (files.length === 0) {
      setFolderError('No supported files in that folder');
      return;
    }
    setFolderError(null);
    if (files.length > FOLDER_CONFIRM_OVER) setPendingFolder(files);
    else enqueueFiles(files);
  }

  return (
    <div
      onDragEnter={(e) => {
        if (!hasFiles(e) || disabled) return;
        depth.current++;
        setOver(true);
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDrop={() => {
        depth.current = 0;
        setOver(false);
      }}
      className={clsx(
        'flex flex-col items-start gap-1 rounded-lg border border-dashed p-8 transition-colors duration-fast ease-out',
        disabled ? 'border-line-strong bg-sunken' : over ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface',
      )}
    >
      <span className="mb-2 text-ink-3">
        <Icon icon={Upload} size={20} />
      </span>
      <p className="text-md font-medium text-ink">{disabled ? 'Reconnect to the backend to import' : over ? 'Release to import' : 'Drop files here'}</p>
      <p className="text-sm text-ink-2">Several at once is fine. Each file becomes one document</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" icon={Plus} disabled={disabled} onClick={() => filesRef.current?.click()}>
          Choose files
        </Button>
        <Button variant="ghost" icon={FolderOpen} disabled={disabled} onClick={() => folderRef.current?.click()}>
          Choose a folder
        </Button>
      </div>
      {folderError && <p className="mt-2 text-sm text-danger">{folderError}</p>}
      <input
        ref={filesRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          enqueueFiles(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
      <input
        ref={folderRef}
        type="file"
        multiple
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          onFolder(e.target.files);
          e.target.value = '';
        }}
      />
      <ConfirmDialog
        open={pendingFolder !== null}
        onClose={() => setPendingFolder(null)}
        title={`Import ${pendingFolder?.length ?? 0} files?`}
        body="They are indexed one at a time. You can keep using ReFound while it runs"
        confirmLabel={`Import ${pendingFolder?.length ?? 0} files`}
        onConfirm={() => {
          if (pendingFolder) enqueueFiles(pendingFolder);
        }}
      />
    </div>
  );
}
