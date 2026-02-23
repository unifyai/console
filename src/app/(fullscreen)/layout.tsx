import { NuqsAdapter } from 'nuqs/adapters/next/app';
import React from 'react';
import Providers from '@/components/Pages/Providers/Base';
import { ThemeProvider } from 'next-themes';
import { Suspense } from 'react';
import '@fortawesome/fontawesome-svg-core/styles.css';
import '@/styles/globals.css';

import ThemeLoader from '@/components/Layout/ThemeLoader';
import LoadingScreen from '@/components/Layout/LoadingScreen';
import { Toaster } from '@/components/UI/Chat/sonner';
import { fontSans, fontMono } from '@/styles/fonts';

/**
 * Fullscreen layout - no top navigation bar.
 * Used for pages that need the entire viewport (e.g., video calls).
 */
export default function FullscreenLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontMono.variable} h-screen overflow-hidden`}
    >
      <body className="h-screen w-full overflow-hidden">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Providers>
            <ThemeLoader>
              <Suspense fallback={<LoadingScreen />}>
                <main className="h-screen w-full">
                  <NuqsAdapter>{children}</NuqsAdapter>
                </main>
              </Suspense>
              <Toaster />
            </ThemeLoader>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
