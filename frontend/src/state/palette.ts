import { createStore } from '../lib/store';

export const paletteStore = createStore<boolean>(false);

export function openPalette(): void {
  paletteStore.set(true);
}

export function closePalette(): void {
  paletteStore.set(false);
}
