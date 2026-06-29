'use client';

import React, { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import TopNav from '@/components/Layout/TopBar/TopNav';
import { HomeShell } from '@/components/Layout/Shell/HomeShell';
import { MockModeIndicator } from '@/components/Simulation/MockModeIndicator';
import { TabSearchProvider } from '@/components/Pages/Assistants/Common/TabSearchContext';

/** Home routes hosted inside the shared rail shell (migrated off `TopNav`). */
const SHELL_ROUTE_PREFIXES = [
  '/account',
  '/billing',
  '/usage',
  '/organizations',
  '/admin',
  '/favourites',
  '/interfaces',
];

const shellFallback = (
  <div className="flex h-full min-h-0 w-full items-center justify-center bg-background">
    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  </div>
);

/**
 * Decides the home chrome per route. The rail shell owns global navigation, so
 * the top nav is suppressed and the main area fills the viewport. `/assistants`
 * renders its own rail (the route body owns it); the `SHELL_ROUTE_PREFIXES`
 * routes are hosted inside the shared `HomeShell`. Every other home route keeps
 * the legacy top nav until it is migrated into the rail.
 */
export function HomeChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const assistantsShell = pathname === '/assistants' || pathname?.startsWith('/assistants/');
  const homeShell = SHELL_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname?.startsWith(`${prefix}/`)
  );

  if (assistantsShell) {
    return (
      <TabSearchProvider>
        <Suspense fallback={shellFallback}>
          <main className="brand-page-stencil-bg relative h-screen overflow-hidden bg-background">
            {children}
          </main>
        </Suspense>
        <MockModeIndicator />
      </TabSearchProvider>
    );
  }

  if (homeShell) {
    return (
      <TabSearchProvider>
        <Suspense fallback={shellFallback}>
          <main className="brand-page-stencil-bg relative h-screen overflow-hidden bg-background">
            <HomeShell>{children}</HomeShell>
          </main>
        </Suspense>
        <MockModeIndicator />
      </TabSearchProvider>
    );
  }

  return (
    <>
      <MockModeIndicator />
      <div
        className="fixed left-0 right-0 top-0 z-40 h-10 border-b border-border bg-card"
        aria-hidden="true"
      />
      <Suspense
        fallback={
          <div className="fixed left-0 right-0 top-0 z-50 flex h-10 items-center border-b border-border bg-card px-3.5">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-caption ml-2 text-muted-foreground">Loading…</span>
          </div>
        }
      >
        <TopNav />
      </Suspense>
      <Suspense fallback={shellFallback}>
        <main className="brand-page-stencil-bg relative top-10 h-[calc(100vh-2.5rem)] overflow-hidden bg-background">
          {children}
        </main>
      </Suspense>
    </>
  );
}
