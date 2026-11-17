import { SearchX } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ButtonLink } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';

export default function NotFound() {
  useDocumentTitle('Not found · ReFound');
  return (
    <EmptyState
      icon={SearchX}
      headingLevel={1}
      title="This page does not exist"
      body="The address may be mistyped, or the page has moved"
      action={
        <ButtonLink variant="primary" to="/ask">
          Go to Ask
        </ButtonLink>
      }
    />
  );
}
