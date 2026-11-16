// Development-only primitive gallery (/dev/kit). Not part of production builds; removed in Phase 8.
import { useState } from 'react';
import { AlertTriangle, ArrowUp, Info, Inbox, Monitor, Moon, Plus, Search, Sun, Trash2, Upload } from 'lucide-react';
import { Button, ButtonLink } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { TextField } from '../components/ui/TextField';
import { Select } from '../components/ui/Select';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Stepper } from '../components/ui/Stepper';
import { Kbd } from '../components/ui/Kbd';
import { Spinner } from '../components/ui/Spinner';
import { Skeleton } from '../components/ui/Skeleton';
import { StatusDot } from '../components/ui/StatusDot';
import { Tag } from '../components/ui/Tag';
import { CallNumber } from '../components/ui/CallNumber';
import { RelevanceMeter } from '../components/ui/RelevanceMeter';
import { Callout } from '../components/ui/Callout';
import { EmptyState } from '../components/ui/EmptyState';
import { Dialog } from '../components/ui/Dialog';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Toaster } from '../components/ui/Toaster';
import { toast } from '../state/toasts';
import { setTheme } from '../state/settings';
import { useSettings } from '../hooks/useSettings';

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-line py-6">
      <h2 className="text-sm font-medium text-ink-2">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

export default function Kit() {
  const theme = useSettings((s) => s.theme);
  const [seg, setSeg] = useState('all');
  const [n, setN] = useState(5);
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
      <main className="min-h-dvh bg-canvas p-10 text-ink">
        <h1 className="font-serif text-page font-medium">Kit</h1>
        <Row title="Theme">
          <SegmentedControl
            label="Theme"
            value={theme}
            onChange={(v) => setTheme(v as 'system' | 'light' | 'dark')}
            options={[
              { value: 'system', label: 'System', icon: Monitor },
              { value: 'light', label: 'Light', icon: Sun },
              { value: 'dark', label: 'Dark', icon: Moon },
            ]}
          />
        </Row>
        <Row title="Buttons">
          {(['primary', 'secondary', 'ghost', 'danger'] as const).map((v) => (
            <Button key={v} variant={v} icon={Plus}>
              {v}
            </Button>
          ))}
          <Button variant="primary" loading>
            Connecting
          </Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
          <Button size="sm">Small</Button>
          <Button size="lg" variant="primary">
            Large
          </Button>
          <ButtonLink to="/dev/kit" variant="ghost" icon={Upload}>
            Link
          </ButtonLink>
          <IconButton icon={Trash2} label="Delete" />
          <IconButton icon={Search} label="Search" variant="secondary" />
          <IconButton icon={ArrowUp} label="Ask" variant="primary" />
          <IconButton icon={ArrowUp} label="Ask" variant="primary" disabled />
        </Row>
        <Row title="Fields">
          <TextField label="Backend address" hint="Where the backend runs" placeholder="http://localhost:8000" />
          <TextField label="Filter" hideLabel leadingIcon={Search} placeholder="Filter by title" />
          <TextField label="With error" error="Nothing answered at http://x" defaultValue="http://x" />
          <TextField label="Disabled" disabled placeholder="Backend offline" />
          <Select label="Sort" options={[{ value: 'new', label: 'Newest first' }, { value: 'old', label: 'Oldest first' }]} />
        </Row>
        <Row title="Segmented and stepper">
          <SegmentedControl
            label="Type"
            value={seg}
            onChange={setSeg}
            options={[
              { value: 'all', label: 'All', count: 12 },
              { value: 'chats', label: 'Chats', count: 5 },
              { value: 'notes', label: 'Notes', count: 5 },
            ]}
          />
          <Stepper label="Passages per answer" value={n} min={1} max={10} onChange={setN} />
        </Row>
        <Row title="Static">
          <Kbd>⌘K</Kbd>
          <Kbd>↵</Kbd>
          <Spinner />
          <Skeleton className="h-3 w-40" />
          <StatusDot state="online" />
          <StatusDot state="checking" />
          <StatusDot state="offline" />
          <Tag>Not built yet</Tag>
          <Tag tone="success">Indexed</Tag>
          <Tag tone="danger">Failed</Tag>
          <Tag tone="accent">Accent</Tag>
          <CallNumber value="GPT-0042" />
          <RelevanceMeter score={6.2} />
          <RelevanceMeter score={-0.41} />
          <RelevanceMeter score={-5.6} />
        </Row>
        <Row title="Callouts">
          <Callout tone="neutral" icon={Info} title="No written answer">
            The backend has no Gemini key.
          </Callout>
          <Callout tone="danger" icon={AlertTriangle} title="The question could not be sent" actions={<Button size="sm">Try again</Button>}>
            The backend is not reachable
          </Callout>
          <EmptyState icon={Inbox} title="Your library is empty" body="Import a conversation or a file" action={<Button variant="primary">Import</Button>} />
        </Row>
        <Row title="Dialogs and toasts">
          <Button onClick={() => setDialog(true)}>Open dialog</Button>
          <Button onClick={() => setConfirm(true)}>Open confirm</Button>
          <Button onClick={() => toast('Deleted "Postgres"', { tone: 'success' })}>Toast</Button>
          <Button onClick={() => toast('Import failed', { tone: 'danger' })}>Danger toast</Button>
          <Button onClick={() => toast('Imported 3 documents', { action: { label: 'View', onSelect: () => undefined } })}>Action toast</Button>
        </Row>
        <Dialog
          open={dialog}
          onClose={() => setDialog(false)}
          title="Dialog title"
          description="A description."
          footer={
            <>
              <Button autoFocus onClick={() => setDialog(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setDialog(false)}>
                Save
              </Button>
            </>
          }
        >
          <TextField label="Name" />
        </Dialog>
        <ConfirmDialog
          open={confirm}
          onClose={() => setConfirm(false)}
          title='Delete "Postgres deadlock"?'
          body="Its 34 passages are removed from the index. This cannot be undone"
          confirmLabel="Delete"
          tone="danger"
          onConfirm={() => new Promise((_r, rej) => setTimeout(() => rej(new Error('The backend is not reachable')), 800))}
        />
        <Toaster />
      </main>
  );
}
