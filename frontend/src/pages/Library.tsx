import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/shell/PageHeader';

export default function LibraryPage() {
  useDocumentTitle('Library · ReFound');
  return <PageHeader title="Library" />;
}
