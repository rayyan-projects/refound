import { Suspense, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useBackendStatus } from '../../hooks/useBackendStatus';
import { setNavigator } from '../../state/navigation';
import { toast } from '../../state/toasts';
import { Toaster } from '../ui/Toaster';
import { buttonClasses } from '../ui/buttonStyles';
import { DropOverlay } from './DropOverlay';
import { OfflineBanner } from './OfflineBanner';
import { PageLoading } from './PageLoading';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import { TopBar } from './TopBar';

function focusHeading(attempt = 0): void {
  const h1 = document.querySelector<HTMLElement>('main h1');
  if (h1) h1.focus({ preventScroll: true });
  else if (attempt < 20) requestAnimationFrame(() => focusHeading(attempt + 1));
}

export function AppShell() {
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  const { status } = useBackendStatus();
  const first = useRef(true);
  const prevStatus = useRef(status);

  useEffect(() => {
    setNavigator((path) => navigate(path));
  }, [navigate]);

  // Move focus to the new page's h1 on navigation (not on the first load, so Tab starts at the skip link).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!hash) focusHeading();
  }, [pathname, hash]);

  // Deep links such as /settings#connection.
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

  const section = pathname.split('/')[1] || 'ask';

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <a href="#main" className={`sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 ${buttonClasses('secondary', 'md', true)}`}>
        Skip to content
      </a>
      <Sidebar />
      <TopBar />
      <div className="lg:ml-sidebar">
        <main id="main" tabIndex={-1} className="mx-0 max-w-content px-4 pb-18 pt-6 focus:outline-none md:px-6 md:pt-8 lg:px-10 lg:pb-16 lg:pt-10">
          <OfflineBanner />
          <div key={section} className="animate-fade-in">
            <Suspense fallback={<PageLoading />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      <TabBar />
      <DropOverlay />
      <Toaster />
    </div>
  );
}
