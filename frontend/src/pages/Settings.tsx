import type { ReactNode } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useBackendStatus } from '../hooks/useBackendStatus';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useSettings } from '../hooks/useSettings';
import { paletteKeys } from '../lib/platform';
import { setTheme, setTopK } from '../state/settings';
import type { ThemePreference } from '../state/settings';
import { PageHeader } from '../components/shell/PageHeader';
import { ConnectionForm } from '../components/settings/ConnectionForm';
import { PlannedList } from '../components/settings/PlannedList';
import { SettingRow } from '../components/settings/SettingRow';
import { Kbd } from '../components/ui/Kbd';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { StatusDot } from '../components/ui/StatusDot';
import { Stepper } from '../components/ui/Stepper';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 border-t border-line pt-8 first:border-t-0 first:pt-0 md:pt-10">
      <h2 id={`${id}-title`} className="mb-6 font-serif text-title font-medium text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

const link = 'text-accent underline underline-offset-2';

const SHORTCUTS: { keys: ReactNode; text: string }[] = [
  { keys: <Kbd>{paletteKeys()}</Kbd>, text: 'Search or jump' },
  { keys: <Kbd>/</Kbd>, text: 'Focus the question box' },
  { keys: <Kbd>Esc</Kbd>, text: 'Stop the answer or close a dialog' },
  {
    keys: (
      <>
        <Kbd>g</Kbd> then <Kbd>a</Kbd> <Kbd>l</Kbd> <Kbd>i</Kbd> <Kbd>h</Kbd> <Kbd>s</Kbd>
      </>
    ),
    text: 'Go to Ask, Library, Import, History, Settings',
  },
];

export default function SettingsPage() {
  useDocumentTitle('Settings · ReFound');
  const { theme, topK, backendUrl } = useSettings();
  const { status, host } = useBackendStatus();
  const statusText =
    status === 'online' ? `Connected to ${host}` : status === 'offline' ? `Offline: nothing answers at ${host}` : `Checking ${host}`;

  return (
    <div className="max-w-settings">
      <PageHeader title="Settings" meta="Saved in this browser" />
      <div className="flex flex-col gap-8 md:gap-10">
        <Section id="appearance" title="Appearance">
          <SettingRow label="Theme" description="System follows your device">
            <SegmentedControl
              label="Theme"
              size="md"
              value={theme}
              onChange={(v) => setTheme(v as ThemePreference)}
              options={[
                { value: 'system', label: 'System', icon: Monitor },
                { value: 'light', label: 'Light', icon: Sun },
                { value: 'dark', label: 'Dark', icon: Moon },
              ]}
            />
          </SettingRow>
        </Section>

        <Section id="connection" title="Connection">
          <p role="status" className="mb-4 flex items-center gap-2 text-base text-ink">
            <StatusDot state={status} />
            {statusText}
          </p>
          <div className="max-w-column">
            <ConnectionForm />
          </div>
        </Section>

        <Section id="answers" title="Answers">
          <SettingRow
            label="Passages per answer"
            description="How many passages are sent to Gemini and listed as sources. More gives broader context and slower answers"
          >
            <Stepper label="Passages per answer" value={topK} min={1} max={10} onChange={setTopK} />
          </SettingRow>
        </Section>

        <Section id="planned" title="Planned">
          <PlannedList />
        </Section>

        <Section id="about" title="About">
          <p className="max-w-measure text-base text-ink">
            ReFound keeps your documents and the search index with the backend on this machine, in a SQLite database and FAISS index files. When
            the backend has a Gemini key, each question and the passages retrieved for it are sent to Google's Gemini API to write the answer.
            Without a key nothing leaves this machine and you get passages only.
          </p>
          <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-base">
            <a className={link} href="https://github.com/rayyan-projects/refound" target="_blank" rel="noreferrer noopener">
              Source on GitHub
            </a>
            {status === 'online' && (
              <a className={link} href={`${backendUrl}/api/docs`} target="_blank" rel="noreferrer noopener">
                Backend API reference
              </a>
            )}
          </p>
          <h3 className="mb-2 mt-8 text-sm font-medium text-ink-2">Keyboard shortcuts</h3>
          <dl className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
            {SHORTCUTS.map((row) => (
              <div key={row.text} className="flex flex-col gap-1.5 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-4">
                <dt className="flex shrink-0 flex-wrap items-center gap-1 text-xs text-ink-3 sm:w-48">{row.keys}</dt>
                <dd className="text-base text-ink-2">{row.text}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
    </div>
  );
}
