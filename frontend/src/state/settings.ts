import { createStore } from '../lib/store';

export type ThemePreference = 'system' | 'light' | 'dark';
export interface Settings {
  backendUrl: string;
  theme: ThemePreference;
  topK: number;
}

export const DEFAULT_BACKEND_URL = 'http://localhost:8000';
const KEYS = { backendUrl: 'refound_backend_url', theme: 'refound_theme', topK: 'refound_top_k' } as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage blocked: the setting still applies for this session
  }
}

export function normaliseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function clampTopK(n: number): number {
  if (!Number.isFinite(n)) return 5;
  return Math.min(10, Math.max(1, Math.round(n)));
}

function load(): Settings {
  const theme = read(KEYS.theme);
  const topK = read(KEYS.topK);
  return {
    backendUrl: normaliseUrl(read(KEYS.backendUrl) || '') || DEFAULT_BACKEND_URL,
    theme: theme === 'light' || theme === 'dark' ? theme : 'system',
    topK: topK === null ? 5 : clampTopK(Number(topK)),
  };
}

export const settingsStore = createStore<Settings>(load());

const darkQuery = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function resolvedTheme(pref: ThemePreference = settingsStore.get().theme): 'light' | 'dark' {
  if (pref === 'system') return darkQuery?.matches ? 'dark' : 'light';
  return pref;
}

function applyTheme(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', resolvedTheme());
}

darkQuery?.addEventListener('change', () => {
  if (settingsStore.get().theme === 'system') {
    applyTheme();
    // re-render anything that shows the resolved theme
    settingsStore.set((s) => ({ ...s }));
  }
});
applyTheme();

export function setBackendUrl(url: string): void {
  const backendUrl = normaliseUrl(url) || DEFAULT_BACKEND_URL;
  write(KEYS.backendUrl, backendUrl);
  settingsStore.set((s) => ({ ...s, backendUrl }));
}

export function setTheme(theme: ThemePreference): void {
  write(KEYS.theme, theme);
  settingsStore.set((s) => ({ ...s, theme }));
  applyTheme();
}

export function setTopK(n: number): void {
  const topK = clampTopK(n);
  write(KEYS.topK, String(topK));
  settingsStore.set((s) => ({ ...s, topK }));
}
