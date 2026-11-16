import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/shell/PageHeader';

export default function SettingsPage() {
  useDocumentTitle('Settings · ReFound');
  return <PageHeader title="Settings" />;
}
