import { Navigate } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useBackendStatus } from '../hooks/useBackendStatus';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useSettings } from '../hooks/useSettings';
import { resolvedTheme, setTheme } from '../state/settings';
import { IconButton } from '../components/ui/IconButton';
import { Skeleton } from '../components/ui/Skeleton';
import { Toaster } from '../components/ui/Toaster';
import { ConnectCard } from '../components/welcome/ConnectCard';
import { ExampleSheet } from '../components/welcome/ExampleSheet';

const FACTS = [
  { label: 'Imports', text: 'ChatGPT share links and exports, Claude exports, Markdown, text, PDFs, images' },
  { label: 'Answers', text: 'Written by Gemini from your own passages, with the sources listed' },
  { label: 'Storage', text: 'A local SQLite database and FAISS index. No account' },
];

export default function Welcome() {
  useDocumentTitle('ReFound');
  const { status, host } = useBackendStatus();
  const theme = useSettings((s) => s.theme);
  const dark = resolvedTheme(theme) === 'dark';

  if (status === 'online') return <Navigate to="/ask" replace />;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <header className="flex h-14 shrink-0 items-center justify-between px-4 md:px-6 lg:px-10">
        <span className="font-serif text-lg font-medium text-ink">ReFound</span>
        <IconButton
          icon={dark ? Sun : Moon}
          label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={() => setTheme(dark ? 'light' : 'dark')}
        />
      </header>
      {status === 'checking' ? (
        <main className="mx-auto w-full max-w-content flex-1 px-4 py-10 md:px-6 lg:px-10" aria-busy="true">
          <span className="sr-only">Loading</span>
          <Skeleton className="h-12 w-3/5" />
          <Skeleton className="mt-6 h-4 w-2/5" />
        </main>
      ) : (
        <main className="mx-auto grid w-full max-w-content flex-1 grid-cols-1 items-center gap-16 px-4 py-10 md:px-6 lg:grid-cols-12 lg:px-10">
          <div className="flex min-w-0 flex-col lg:col-span-5">
            <h1 tabIndex={-1} className="font-serif text-page font-medium text-ink focus:outline-none md:text-display">
              Find what you already worked out
            </h1>
            <p className="mt-4 max-w-narrow text-md text-ink-2">
              ReFound searches your past ChatGPT and Claude conversations, notes and PDFs, and answers from them with the passages it used.
              Everything is indexed on your machine
            </p>
            <div className="mt-6">
              <ConnectCard checking={false} host={host} />
            </div>
            <dl className="mt-8 flex flex-col border-t border-line text-sm">
              {FACTS.map((f) => (
                <div key={f.label} className="flex flex-col gap-0.5 border-b border-line py-3 sm:flex-row sm:gap-4">
                  <dt className="shrink-0 font-medium text-ink sm:w-20">{f.label}</dt>
                  <dd className="text-ink-2">{f.text}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex min-w-0 justify-center lg:col-span-7 lg:justify-end">
            <ExampleSheet />
          </div>
        </main>
      )}
      <Toaster />
    </div>
  );
}
