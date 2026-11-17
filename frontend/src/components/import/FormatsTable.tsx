import type { ReactNode } from 'react';

const ext = (s: string) => <code className="text-sm text-ink">{s}</code>;

const ROWS: { name: string; text: ReactNode }[] = [
  { name: 'ChatGPT', text: <>A public share link, or {ext('conversations.json')} from a ChatGPT data export</> },
  { name: 'Claude', text: <>{ext('conversations.json')} from a Claude data export. Share links are not supported yet</> },
  { name: 'Notes', text: <>Markdown and plain text: {ext('.md')} {ext('.markdown')} {ext('.txt')}</> },
  { name: 'PDF', text: <>{ext('.pdf')} files with selectable text</> },
  { name: 'Images', text: <>{ext('.png')} {ext('.jpg')} {ext('.gif')} {ext('.webp')} {ext('.bmp')}, described by Gemini. Needs a Gemini key on the backend</> },
];

export function FormatsTable() {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-ink-2">What you can import</h2>
      <dl className="divide-y divide-line border-y border-line">
        {ROWS.map((r) => (
          <div key={r.name} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:gap-4">
            <dt className="shrink-0 font-medium text-ink sm:w-35">{r.name}</dt>
            <dd className="text-ink-2">{r.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
