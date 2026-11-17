export type DrawerItem =
  | { kind: 'divider'; key: string; label: string }
  | { kind: 'card'; key: string; cn: string; date: string; title: string; text: string; src: string; failed?: boolean };

export interface DrawerProps {
  items: DrawerItem[];
  /** Indexes into `items` of the cited cards: pulled up and flagged in amber. */
  flagged: number[];
  /** A card to open the drawer at (a hovered citation or source row), or null for the top flagged card. */
  focus: number | null;
  /** Keep riffling through the cards (the retrieving state). */
  riffle?: boolean;
  /** Plain-language description of what the drawer shows, for the accessible name. */
  label: string;
  /** Lower texture resolution (Library, long decks, narrow screens). */
  lowRes?: boolean;
  /** Change this number to riffle through the deck again (a new question with the same answer). */
  replay?: number;
  /** Called when a click pulls a card (or puts it back: null). */
  onPull?: (i: number | null) => void;
}

export const MAX_CARDS = 40;
