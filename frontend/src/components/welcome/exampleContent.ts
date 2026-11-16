import type { Document, Source } from '../../services/api';

/**
 * The Welcome screen's illustration. Hard-coded, labelled "Example" on screen, and deliberately different from
 * the test fixtures. This is the only illustrative content in the production bundle.
 */
export const EXAMPLE_QUESTION = 'Why did the nightly backup job keep timing out?';

export const EXAMPLE_ANSWER =
  'The job was not slow, it was waiting. Your notes from March trace the timeouts to the backup running at 02:00, the same minute as the log rotation, so both fought over the disk [Memory 1]. You moved the backup to 03:30 and added a 15 minute lock timeout, and the failures stopped [Memory 2].';

export const EXAMPLE_SOURCES: { source: Source; doc: Document }[] = [
  {
    source: {
      source: 'Backup job timeouts',
      filename: 'example-backup-job-timeouts',
      score: 5.2,
      excerpt:
        '[ASSISTANT]\nBoth cron entries fire at 02:00. Log rotation compresses about 9 GB while the backup reads the same volume, which is why the backup stalls rather than fails outright.',
    },
    doc: {
      id: 7,
      filename: 'example-backup-job-timeouts',
      source_type: 'chatgpt_share',
      title: 'Backup job timeouts',
      created_at: null,
      chunk_count: 0,
      status: 'indexed',
      error_message: null,
    },
  },
  {
    source: {
      source: 'ops-notes.md',
      filename: 'ops-notes.md',
      score: 0.1,
      excerpt: 'Moved backup to 03:30. Added flock with a 15 minute timeout so a stuck run cannot block the next night.',
    },
    doc: {
      id: 3,
      filename: 'ops-notes.md',
      source_type: 'markdown',
      title: 'ops-notes.md',
      created_at: null,
      chunk_count: 0,
      status: 'indexed',
      error_message: null,
    },
  },
];
