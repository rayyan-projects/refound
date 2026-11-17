import { createStore } from '../lib/store';

export type ToastTone = 'neutral' | 'success' | 'danger';
export interface Toast {
  id: string;
  tone: ToastTone;
  message: string;
  action?: { label: string; onSelect: () => void };
}

export const toastStore = createStore<Toast[]>([]);
let seq = 0;

export function toast(message: string, opts: { tone?: ToastTone; action?: Toast['action'] } = {}): string {
  const id = `t${++seq}`;
  toastStore.set((list) => [...list, { id, tone: opts.tone ?? 'neutral', message, action: opts.action }].slice(-3));
  return id;
}

export function dismissToast(id: string): void {
  toastStore.set((list) => list.filter((t) => t.id !== id));
}
