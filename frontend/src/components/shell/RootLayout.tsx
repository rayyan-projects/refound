import { useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useBackendStatus } from '../../hooks/useBackendStatus';
import { useHotkeys } from '../../hooks/useHotkeys';
import { setNavigator } from '../../state/navigation';
import { toast } from '../../state/toasts';
import { Toaster } from '../ui/Toaster';
import { buttonClasses } from '../ui/buttonStyles';
import { CommandPalette } from './CommandPalette';
import { DropOverlay } from './DropOverlay';
import { GuideBar } from './GuideBar';

function focusHeading(attempt = 0): void {
  const h1 = document.querySelector<HTMLElement>('main h1');
  if (h1) h1.focus({ preventScroll: true });
  else if (attempt < 20) requestAnimationFrame(() => focusHeading(attempt + 1));
}

/** Every route: skip link, the guide-tab bar, palette, hotkeys, drop overlay and toasts. The landing page is dark. */
export function RootLayout() {
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  const { status } = useBackendStatus();
  const first = useRef(true);
  const prevStatus = useRef(status);
  useHotkeys();
  const landing = pathname === '/';

  useEffect(() => {
    setNavigator((path) => navigate(path));
  }, [navigate]);

  // Focus the new page's h1 on navigation (not on first load, so Tab starts at the skip link).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!hash) {
      window.scrollTo(0, 0);
      focusHeading();
    }
  }, [pathname, hash]);

  useEffect(() => {
    if (!hash) return;
    let tries = 0;
    const tick = () => {
      const el = document.getElementById(hash.slice(1));
      if (el) el.scrollIntoView({ block: 'start' });
      else if (tries++ < 20) requestAnimationFrame(tick);
    };
    tick();
  }, [pathname, hash]);

  useEffect(() => {
    if (prevStatus.current === 'offline' && status === 'online') toast('Reconnected', { tone: 'success' });
    prevStatus.current = status;
  }, [status]);

  return (
    <div data-theme={landing ? 'dark' : undefined} className="min-h-dvh bg-canvas text-ink">
      <a href="#main" className={`sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 ${buttonClasses('secondary', 'md', true)}`}>
        Skip to content
      </a>
      <GuideBar />
      <Outlet />
      <DropOverlay />
      <CommandPalette />
      <Toaster />
    </div>
  );
}
