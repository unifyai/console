import { NuqsAdapter } from 'nuqs/adapters/next/app';
import React from 'react';
import { headers } from 'next/headers';
import TopNav from '@/components/Layout/TopBar/TopNav';
import Providers from '@/components/Pages/Providers/Base';
import { ThemeProvider } from 'next-themes';
import { Suspense } from 'react';
import '@fortawesome/fontawesome-svg-core/styles.css';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import '@/styles/globals.css';

import ThemeLoader from '@/components/Layout/ThemeLoader';
import LoadingScreen from '@/components/Layout/LoadingScreen';
import MfaEnforcementGate from '@/components/Common/Auth/MfaEnforcementGate';
import { Toaster } from '@/components/UI/Chat/sonner';
import { Loader2 } from 'lucide-react';
import { fontSans, fontMono } from '@/styles/fonts';

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
              {/* Static skeleton bar to avoid brief blank before navbar hydration */}
              <div
                className="bg-background/80 fixed left-0 right-0 top-0 z-40 h-10 border-b border-[color:var(--border)] backdrop-blur-lg"
                aria-hidden="true"
              />
              <Suspense
                fallback={
                  <div className="bg-background/80 fixed left-0 right-0 top-0 z-50 flex h-10 items-center border-b border-[color:var(--border)] px-3.5 backdrop-blur-lg">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-caption ml-2 text-muted-foreground">Loading…</span>
                  </div>
                }
              >
                <TopNav />
              </Suspense>
              <Suspense fallback={<LoadingScreen />}>
                <main className="relative top-10 h-[calc(100vh-2.5rem)] overflow-hidden">
                  <MfaEnforcementGate>
                    <NuqsAdapter>{children}</NuqsAdapter>
                  </MfaEnforcementGate>
                </main>
              </Suspense>
              <Toaster richColors position="bottom-right" closeButton />
            </ThemeLoader>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
