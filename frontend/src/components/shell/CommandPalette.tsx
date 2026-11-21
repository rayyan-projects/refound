import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, Clock, Moon, Search, Sun, Unplug, Upload } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { useBackendStatus } from '../../hooks/useBackendStatus';
import { useDocuments } from '../../hooks/useDocuments';
import { useHistory } from '../../hooks/useHistory';
import { useSettings } from '../../hooks/useSettings';
import { useStore } from '../../hooks/useStore';
import { callNumber, displayTitle, typeIcon } from '../../lib/documents';
import { formatDate, parseServerDate } from '../../lib/format';
import { ask } from '../../state/ask';
import { closePalette, paletteStore } from '../../state/palette';
import { resolvedTheme, setTheme } from '../../state/settings';
import { Icon } from '../ui/Icon';
import { Kbd } from '../ui/Kbd';
import { Skeleton } from '../ui/Skeleton';
import { NAV_ITEMS, SETTINGS_ITEM } from './navItems';

interface Option {
  id: string;
  icon: LucideIcon;
  label: string;
  meta?: ReactNode;
  disabled?: boolean;
  run: () => void;
}
interface Group {
  heading: string;
  options: Option[];
  loading?: boolean;
}

function PaletteBody() {
  const navigate = useNavigate();
  const listId = useId();
  const [input, setInput] = useState('');
  const [active, setActive] = useState(0);
  const { status } = useBackendStatus();
  const docs = useDocuments();
  const history = useHistory();
  const theme = useSettings((s) => s.theme);
  const dark = resolvedTheme(theme) === 'dark';
  const q = input.trim();
  const needle = q.toLowerCase();
  const offline = status === 'offline';
  const dataUnavailable = offline || docs.isError || history.isError;

  const go = (path: string) => () => navigate(path);

  const groups: Group[] = (() => {
    const out: Group[] = [];
    if (q) {
      out.push({
        heading: 'Ask',
        options: [
          {
            id: 'ask',
            icon: ArrowUp,
            label: `Ask "${q}"`,
            disabled: offline,
            meta: offline ? <span className="text-xs text-ink-3">Offline</span> : undefined,
            run: () => {
              void ask(q);
              navigate(`/ask?q=${encodeURIComponent(q)}`);
            },
          },
        ],
      });
    }
    const goTo = [...NAV_ITEMS, SETTINGS_ITEM]
      .filter((n) => !needle || n.label.toLowerCase().includes(needle))
      .map((n) => ({ id: `go-${n.key}`, icon: n.icon, label: n.label, run: go(n.to) }));
    if (goTo.length) out.push({ heading: 'Go to', options: goTo });

    if (dataUnavailable) {
      out.push({
        heading: 'Backend',
        options: [{ id: 'offline', icon: Unplug, label: 'Backend offline: documents and history are unavailable', disabled: true, run: () => undefined }],
      });
    } else {
      const recent = (history.data ?? [])
        .filter((h) => !needle || (h.query_text ?? '').toLowerCase().includes(needle))
        .slice(0, 5)
        .map((h) => ({
          id: `h-${h.id}`,
          icon: Clock,
          label: h.query_text,
          meta: <span className="text-xs text-ink-3">{formatDate(parseServerDate(h.created_at))}</span>,
          run: go(`/history/${h.id}`),
        }));
      if (history.loading) out.push({ heading: 'Recent questions', options: [], loading: true });
      else if (recent.length) out.push({ heading: 'Recent questions', options: recent });

      const documents = (docs.data ?? [])
        .filter((d) => !needle || displayTitle(d).toLowerCase().includes(needle))
        .slice(0, 6)
        .map((d) => ({
          id: `d-${d.id}`,
          icon: typeIcon(d.source_type),
          label: displayTitle(d),
          meta: <span className="text-xs tabular-nums text-ink-3">{callNumber(d)}</span>,
          run: go(`/library?q=${encodeURIComponent(displayTitle(d))}`),
        }));
      if (docs.loading) out.push({ heading: 'Documents', options: [], loading: true });
      else if (documents.length) out.push({ heading: 'Documents', options: documents });
    }

    const actions = [
      { id: 'theme', icon: dark ? Sun : Moon, label: dark ? 'Switch to light theme' : 'Switch to dark theme', run: () => setTheme(dark ? 'light' : 'dark') },
      { id: 'import', icon: Upload, label: 'Import files', run: go('/import') },
    ].filter((a) => !needle || a.label.toLowerCase().includes(needle));
    if (actions.length) out.push({ heading: 'Actions', options: actions });
    return out;
  })();

  const flat = groups.flatMap((g) => g.options).filter((o) => !o.disabled);
  const current = flat.length ? flat[Math.min(active, flat.length - 1)] : null;

  useEffect(() => {
    if (!current) return;
    document.getElementById(`${listId}-${current.id}`)?.scrollIntoView({ block: 'nearest' });
  }, [current, listId]);

  function select(option: Option | null) {
    if (!option || option.disabled) return;
    closePalette();
    option.run();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!flat.length) return;
      const i = flat.indexOf(current as Option);
      setActive((i + (e.key === 'ArrowDown' ? 1 : -1) + flat.length) % flat.length);
    } else if (e.key === 'Home' && flat.length) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End' && flat.length) {
      e.preventDefault();
      setActive(flat.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(current);
    } else if (e.key === 'Tab') {
      e.preventDefault();
    }
  }

  return (
    <div className="w-palette animate-rise overflow-hidden rounded-xl border border-line bg-raised text-ink shadow-3">
      <div className="flex h-13 items-center gap-3 border-b border-line px-4">
        <span className="text-ink-3">
          <Icon icon={Search} />
        </span>
        <input
          data-autofocus=""
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={current ? `${listId}-${current.id}` : undefined}
          aria-autocomplete="list"
          aria-label="Ask a question or jump to"
          placeholder="Ask a question or jump to"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent text-md text-ink placeholder:text-ink-3 focus-visible:outline-none"
        />
        <Kbd>Esc</Kbd>
      </div>
      <div id={listId} role="listbox" aria-label="Results" className="max-h-palette overflow-y-auto pb-1.5">
        {groups.map((g) => (
          <div key={g.heading} role="group" aria-label={g.heading}>
            <div role="presentation" className="px-3 pb-1 pt-3 text-xs text-ink-3">
              {g.heading}
            </div>
            {g.loading
              ? [0, 1].map((i) => (
                  <div key={i} aria-hidden="true" className="mx-1.5 flex h-10 items-center gap-3 px-3">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-3.5 w-1/2" />
                  </div>
                ))
              : g.options.map((o) => {
                  const isActive = current?.id === o.id;
                  return (
                    <div
                      key={o.id}
                      id={`${listId}-${o.id}`}
                      role="option"
                      aria-selected={isActive}
                      aria-disabled={o.disabled || undefined}
                      onMouseMove={() => {
                        if (!o.disabled && !isActive) setActive(flat.indexOf(o));
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => select(o)}
                      className={clsx(
                        'mx-1.5 flex h-10 items-center gap-3 rounded px-3 text-base transition-colors duration-fast ease-out max-lg:h-11',
                        o.disabled ? 'cursor-not-allowed text-ink-3' : 'cursor-pointer text-ink-2 active:bg-active',
                        isActive && 'bg-hover text-ink',
                      )}
                    >
                      <span className="shrink-0 text-ink-3">
                        <Icon icon={o.icon} />
                      </span>
                      <span className="min-w-0 flex-1 truncate" title={o.label}>
                        {o.label}
                      </span>
                      {isActive ? <Kbd>↵</Kbd> : o.meta}
                    </div>
                  );
                })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CommandPalette() {
  const open = useStore(paletteStore);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      el.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label="Search or jump to"
      onCancel={(e) => {
        e.preventDefault();
        closePalette();
      }}
      onClose={() => {
        if (paletteStore.get()) closePalette();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closePalette();
      }}
      className="mx-auto mb-auto mt-4 md:mt-24"
    >
      {open && <PaletteBody />}
    </dialog>
  );
}
