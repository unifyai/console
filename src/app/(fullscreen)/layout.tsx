import { NuqsAdapter } from 'nuqs/adapters/next/app';
import React from 'react';
import Providers from '@/components/Pages/Providers/Base';
import { Suspense } from 'react';

import ThemeLoader from '@/components/Layout/ThemeLoader';
import LoadingScreen from '@/components/Layout/LoadingScreen';
import { NetworkStatusToast } from '@/components/Layout/NetworkStatusToast';
import { Toaster } from '@/components/UI/Chat/sonner';

/**
 * Fullscreen layout - no top navigation bar.
 * Used for pages that need the entire viewport (e.g., video calls).
 */
export default function FullscreenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-full overflow-hidden">
      <Providers>
        <ThemeLoader>
          <Suspense fallback={<LoadingScreen />}>
            <main className="h-screen w-full">
              <NuqsAdapter>{children}</NuqsAdapter>
            </main>
          </Suspense>
          <Toaster richColors position="bottom-right" closeButton />
          <NetworkStatusToast />
        </ThemeLoader>
      </Providers>
    </div>
  );
}
