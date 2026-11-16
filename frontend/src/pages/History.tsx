import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/shell/PageHeader';

export default function HistoryPage() {
  useDocumentTitle('History · ReFound');
  return <PageHeader title="History" />;
}
