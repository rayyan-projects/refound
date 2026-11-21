import { settingsStore } from '../state/settings';
import type { Settings } from '../state/settings';
import { useStore } from './useStore';

export function useSettings(): Settings;
export function useSettings<S>(selector: (s: Settings) => S): S;
export function useSettings<S>(selector?: (s: Settings) => S): Settings | S {
  const identity = (s: Settings): Settings => s;
  return useStore<Settings, Settings | S>(settingsStore, selector ?? identity);
}
