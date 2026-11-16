import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './state/queryClient';
import { AppShell } from './components/shell/AppShell';

const Welcome = lazy(() => import('./pages/Welcome'));
const Ask = lazy(() => import('./pages/Ask'));
const Library = lazy(() => import('./pages/Library'));
const Import = lazy(() => import('./pages/Import'));
const History = lazy(() => import('./pages/History'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));
// Development-only primitive gallery; absent from production builds.
const Kit = import.meta.env.DEV ? lazy(() => import('./pages/Kit')) : null;

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route element={<AppShell />}>
              <Route path="/ask" element={<Ask />} />
              <Route path="/library" element={<Library />} />
              <Route path="/import" element={<Import />} />
              <Route path="/history" element={<History />} />
              <Route path="/history/:id" element={<History />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/app/search" element={<Navigate to="/ask" replace />} />
              <Route path="/app/import" element={<Navigate to="/import" replace />} />
              <Route path="/app/history" element={<Navigate to="/history" replace />} />
              <Route path="/app/settings" element={<Navigate to="/settings" replace />} />
              <Route path="/dev/kit" element={Kit ? <Kit /> : <NotFound />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
