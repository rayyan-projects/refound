import type { SourceGroup } from '../../lib/documents';

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title', label: 'Title A to Z' },
];

export const TYPE_OPTIONS: { value: 'all' | SourceGroup; label: string; phrase: string }[] = [
  { value: 'all', label: 'All', phrase: 'your library' },
  { value: 'chats', label: 'Chats', phrase: 'chats' },
  { value: 'notes', label: 'Notes', phrase: 'notes' },
  { value: 'pdfs', label: 'PDFs', phrase: 'PDFs' },
  { value: 'images', label: 'Images', phrase: 'images' },
];
