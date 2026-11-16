import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GO_TO, isTypingTarget, SEQUENCE_MS } from '../lib/hotkeys';
import { askStore, isAsking, stopAsking } from '../state/ask';
import { openPalette, paletteStore } from '../state/palette';

/** The global shortcuts of section 3.4. Mounted once, in AppShell. */
export function useHotkeys(): void {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    let gAt = 0;
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      const key = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && key === 'k') {
        e.preventDefault();
        openPalette();
        return;
      }
      const dialogOpen = paletteStore.get() || !!document.querySelector('dialog[open]');
      if (e.key === 'Escape') {
        if (!dialogOpen && pathname === '/ask' && isAsking(askStore.get().status)) {
          e.preventDefault();
          stopAsking();
        }
        return;
      }
      if (dialogOpen || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === '/') {
        e.preventDefault();
        const composer = document.getElementById('ask-composer') as HTMLTextAreaElement | null;
        if (pathname === '/ask' && composer && !composer.disabled) composer.focus();
        else openPalette();
        return;
      }
      if (key === 'g' && !e.shiftKey) {
        gAt = Date.now();
        return;
      }
      if (gAt && Date.now() - gAt <= SEQUENCE_MS && GO_TO[key]) {
        e.preventDefault();
        gAt = 0;
        navigate(GO_TO[key]);
        return;
      }
      gAt = 0;
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, pathname]);
}
