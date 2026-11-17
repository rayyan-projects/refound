import { History, Library, Search, Settings, Upload } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  key: 'ask' | 'library' | 'import' | 'history' | 'settings';
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/ask', label: 'Ask', icon: Search, key: 'ask' },
  { to: '/library', label: 'Library', icon: Library, key: 'library' },
  { to: '/import', label: 'Import', icon: Upload, key: 'import' },
  { to: '/history', label: 'History', icon: History, key: 'history' },
];

export const SETTINGS_ITEM: NavItem = { to: '/settings', label: 'Settings', icon: Settings, key: 'settings' };
