import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useBackendStatus } from '../hooks/useBackendStatus';
import { PageHeader } from '../components/shell/PageHeader';
import { Dropzone } from '../components/import/Dropzone';
import { FormatsTable } from '../components/import/FormatsTable';
import { ImportQueue } from '../components/import/ImportQueue';
import { ShareLinkField } from '../components/import/ShareLinkField';

export default function ImportPage() {
  useDocumentTitle('Import · ReFound');
  const { status } = useBackendStatus();
  const offline = status === 'offline';
  return (
    <div>
      <PageHeader title="Import" meta="Files and links are parsed and indexed on your machine" />
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-10 lg:col-span-7 lg:max-w-column">
          <Dropzone disabled={offline} />
          <ShareLinkField disabled={offline} />
        </div>
        <div className="min-w-0 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1">
          <ImportQueue />
        </div>
        <div className="min-w-0 lg:col-span-7 lg:max-w-column">
          <FormatsTable />
        </div>
      </div>
    </div>
  );
}
