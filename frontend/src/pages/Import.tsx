import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/shell/PageHeader';

export default function ImportPage() {
  useDocumentTitle('Import · ReFound');
  return <PageHeader title="Import" />;
}
