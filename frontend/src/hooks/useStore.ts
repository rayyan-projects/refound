import { useSyncExternalStore } from 'react';
import type { Store } from '../lib/store';

export function useStore<T>(store: Store<T>): T;
export function useStore<T, S>(store: Store<T>, selector: (state: T) => S): S;
export function useStore<T, S>(store: Store<T>, selector?: (state: T) => S): T | S {
  const get = () => (selector ? selector(store.get()) : store.get());
  return useSyncExternalStore(store.subscribe, get, get);
}
