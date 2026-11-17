import type { DrawerItem } from '../drawer/drawerTypes';

/** The landing teaser's example drawer (from the direction 2 prototype). Illustrative only, labelled "Example". */
const div = (label: string): DrawerItem => ({ kind: 'divider', key: `d-${label}`, label });
let n = 0;
const card = (cn: string, date: string, title: string, text: string, src: string): DrawerItem => ({ kind: 'card', key: `c-${n++}`, cn, date, title, text, src });

export const TEASER_ITEMS: DrawerItem[] = [
  div('Chats'),
  card('GPT-0042', '14 Nov 2026', 'Postgres deadlock when two workers upsert', 'Two workers upsert the same rows in a different order, so each holds a lock the other needs. Sort each batch by primary key before INSERT … ON CONFLICT.', 'ChatGPT share link'),
  card('GPT-0042', '14 Nov 2026', 'Postgres deadlock when two workers upsert', 'Sorting fixed it in staging. Retry SQLSTATE 40P01 with jitter, three attempts at most, and drop the batch size from 5000 to 500.', 'ChatGPT share link'),
  card('GPT-0038', '28 Oct 2026', 'Why is my FAISS recall dropping after deletes', 'IndexIDMap.remove_ids leaves Chunk.faiss_id pointing at vectors that moved. Rebuild the id map after a delete.', 'ChatGPT share link'),
  card('GPT-0035', '12 Oct 2026', 'Rust lifetimes in async closures', 'Move the Arc clone into the closure before the await. The borrow outlives the future otherwise.', 'chatgpt-export-2026-10.json'),
  card('GPT-0032', '21 Sep 2026', 'Retry with jitter for serialization errors', 'SQLSTATE 40001 and 40P01 are both safe to retry. Back off 50 to 400 ms with full jitter.', 'ChatGPT share link'),
  card('GPT-0029', '9 Sep 2026', 'Nightly backup timing out', 'The backup and logrotate both fired at 02:00 and fought over the disk. Moved the backup to 03:30.', 'ChatGPT share link'),
  card('CLD-0041', '12 Nov 2026', 'Picking a reranker for 20 candidates', 'bge-reranker-base is enough for 20 passages. Keep the top 5 for the answer.', 'conversations.json'),
  div('Notes'),
  card('MD-0039', '3 Nov 2026', 'Docker build cache notes', 'Copy package-lock.json before the source so npm ci stays cached between builds.', 'docker-notes.md'),
  card('MD-0033', '27 Sep 2026', 'Sourdough log', 'Day 3: 74% hydration, bulk 5 h at 24 °C. Oven spring much better than last week.', 'sourdough-log.md'),
  card('MD-0031', '14 Sep 2026', 'Reverse proxy checklist', 'proxy_read_timeout 300s for streamed answers. Turn proxy buffering off.', 'nginx-reverse-proxy.md'),
  card('MD-0027', '2 Sep 2026', 'Postgres index bloat', 'REINDEX CONCURRENTLY on the events table every Sunday at 03:00.', 'postgres-ops.md'),
  card('TXT-0036', '19 Oct 2026', 'Interview prep', 'Explain isolation levels with the lost-update example, then show SELECT … FOR UPDATE.', 'interview-prep.txt'),
  div('PDFs'),
  card('PDF-0040', '10 Nov 2026', 'Designing Data-Intensive Applications, ch. 7', 'Deadlocks arise when transactions wait on each other in a cycle. The database detects it and aborts one, which the application must retry.', 'designing-data-intensive-applications-ch7.pdf'),
  card('PDF-0034', '6 Oct 2026', 'Lease agreement 2026', 'Notice period is two months. Deposit returned within 30 days of handover.', 'lease-agreement-2026.pdf'),
  div('Images'),
  card('IMG-0037', '21 Oct 2026', 'Whiteboard: auth flow', 'Refresh token rotates on every use and the old one is revoked.', 'whiteboard-auth-flow.png'),
];

/** Indexes into TEASER_ITEMS, in citation order. */
export const TEASER_CITES = [1, 2, 15, 5, 12];

/** The example answer from copy.md, as text runs: strings, inline code and citation numbers. */
export const TEASER_ANSWER: (string | { code: string } | { cite: number })[] = [
  'You fixed it by having every worker take its row locks in the same order',
  { cite: 1 },
  '. Each batch is sorted by primary key before ',
  { code: 'INSERT … ON CONFLICT' },
  ', and SQLSTATE ',
  { code: '40P01' },
  ' is retried with jitter, three attempts at most',
  { cite: 2 },
  '. The book chapter explains why the retry stays: Postgres breaks a lock cycle by aborting one of the transactions',
  { cite: 3 },
  '.',
];
