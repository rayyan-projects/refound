/** True when a key press belongs to a text field (or other editable control), so global shortcuts stay out of it. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;
  const type = (target as HTMLInputElement).type;
  return !['button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'range', 'color'].includes(type);
}

/** `g` then a letter, within 800ms. */
export const GO_TO: Record<string, string> = {
  a: '/ask',
  l: '/library',
  i: '/import',
  h: '/history',
  s: '/settings',
};
export const SEQUENCE_MS = 800;
