import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { OfflineBanner } from './OfflineBanner';
import { PageLoading } from './PageLoading';

/** App pages: centred content under the guide bar, with the offline banner. */
export function AppShell() {
  const { pathname } = useLocation();
  const section = pathname.split('/')[1] || 'ask';
  return (
    <main id="main" tabIndex={-1} className="mx-auto max-w-content px-4 pb-16 pt-8 focus:outline-none md:px-6 lg:px-10 lg:pt-12">
      <OfflineBanner />
      <div key={section} className="animate-fade-in">
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </div>
    </main>
  );
}
