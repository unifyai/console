'use client';

import React, { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import TopNav from '@/components/Layout/TopBar/TopNav';
import LoadingScreen from '@/components/Layout/LoadingScreen';

/**
 * Decides the home chrome per route. `/assistants` runs inside the rail shell,
 * which owns global navigation, so the top nav is suppressed and the main area
 * fills the viewport. Every other home route keeps the legacy top nav until it
 * is migrated into the rail.
 *
 * `children` arrives already wrapped by the async server-side MFA gate (and the
 * nuqs adapter) from the server layout, so this client component only owns the
 * chrome decision and the loading fallbacks.
 */
export function HomeChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const railShell = pathname === '/assistants' || pathname?.startsWith('/assistants/');

  const body = children;

  if (railShell) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <main className="brand-page-stencil-bg relative h-screen overflow-hidden bg-background">
          {body}
        </main>
      </Suspense>
    );
  }

  return (
    <>
      {/* Static skeleton bar to avoid brief blank before navbar hydration */}
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
      <Suspense fallback={<LoadingScreen />}>
        <main className="brand-page-stencil-bg relative top-10 h-[calc(100vh-2.5rem)] overflow-hidden bg-background">
          {body}
        </main>
      </Suspense>
    </>
  );
}
