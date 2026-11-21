export function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent);
}

/** The keycap label for the palette shortcut. */
export function paletteKeys(): string {
  return isMac() ? '⌘K' : 'Ctrl K';
}
