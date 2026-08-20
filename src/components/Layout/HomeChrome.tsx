'use client';

import React, { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import TopNav from '@/components/Layout/TopBar/TopNav';
import { MockModeIndicator } from '@/components/Simulation/MockModeIndicator';
import { Loader } from '@/components/Common/Loader';
import { isPersistentMainShellPath } from '@/lib/navigation/appShellRoutes';

const shellFallback = (
  <div className="flex h-full min-h-0 w-full items-center justify-center bg-background">
    <Loader size={64} />
  </div>
);

/**
 * Decides the home chrome per route. The rail shell owns global navigation, so
 * the top nav is suppressed and the main area fills the viewport. Every other
 * home route keeps the legacy top nav until it is migrated into the rail.
 */
export function HomeChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const homeShell = pathname === '/' || isPersistentMainShellPath(pathname);

  if (homeShell) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <main className="relative min-h-0 flex-1 overflow-hidden bg-background">{children}</main>
        <MockModeIndicator />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <MockModeIndicator />
      <div
        className="fixed left-0 right-0 top-0 z-40 h-10 border-b border-border bg-card"
        aria-hidden="true"
      />
      <Suspense
        fallback={
          <div className="fixed left-0 right-0 top-0 z-50 flex h-10 items-center border-b border-border bg-card px-3.5">
            <Loader size={24} />
            <span className="text-caption ml-2 text-muted-foreground">Loading…</span>
          </div>
        }
      >
        <TopNav />
      </Suspense>
      <Suspense fallback={shellFallback}>
        <main className="relative mt-10 min-h-0 flex-1 overflow-hidden bg-background">
          {children}
        </main>
      </Suspense>
    </div>
  );
}
