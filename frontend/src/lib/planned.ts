export interface PlannedFeature {
  name: string;
  description: string;
}

/** The one place features without a working backend are named (Settings → Planned). */
export const PLANNED: PlannedFeature[] = [
  {
    name: 'Similar problem detection',
    description:
      'Recognise when a new question matches something you solved before, by meaning. Today ReFound only notices near-identical wording',
  },
  { name: 'Topic tags', description: 'Label each document with a few topics on import and filter the library by them' },
  { name: 'Summaries', description: 'A short summary of a document' },
  { name: 'Synced settings', description: 'Keep these settings with the backend instead of this browser' },
  { name: 'Export and backup', description: 'Download your library and index as one file' },
  {
    name: 'Claude share links',
    description: 'Import a Claude conversation from its share link. Claude exports already work',
  },
];
