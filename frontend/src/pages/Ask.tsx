import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/shell/PageHeader';

export default function AskPage() {
  useDocumentTitle('Ask · ReFound');
  return <PageHeader title="Ask" />;
}
