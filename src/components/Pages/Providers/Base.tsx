import React from 'react';
import Script from 'next/script';
import { SessionProvider } from './SessionProvider';
import QueryProvider from './QueryProvider';
import { NextUIProvider } from '@nextui-org/react';
import { SidebarProvider } from '@/components/UI/sidebar';
import { WorkspaceProvider } from './WorkspaceProvider';
import { EnvironmentProvider } from './EnvironmentProvider';
import { AuthErrorBoundary } from '@/components/Common/Auth/AuthErrorBoundary';
import { getCurrentUser } from '@/lib/user/user';

export default async function Providers({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // Resolve environment config server-side where all env vars are available.
  // This is then passed to the client-side EnvironmentProvider as a prop,
  // because client components cannot read non-NEXT_PUBLIC_ env vars in
  // production builds.
  const envConfig = {
    isStaging: (process.env.ORCHESTRA_URL ?? '').includes('staging'),
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY,
  };

  return (
    <>
      <NextUIProvider className="flex h-full flex-1 flex-col">
        <SidebarProvider>
          <SessionProvider>
            <EnvironmentProvider config={envConfig}>
              <WorkspaceProvider user={user}>
                <QueryProvider>
                  <AuthErrorBoundary>{children}</AuthErrorBoundary>
                </QueryProvider>
              </WorkspaceProvider>
            </EnvironmentProvider>
          </SessionProvider>
        </SidebarProvider>
      </NextUIProvider>
      {/* GTM temporarily disabled - was interfering with SPA navigation
      <Script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX" />
      <Script id="ganalytics">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag('config', 'G-XXXXXXXXXX', {
            send_page_view: false,
            // Disable all automatic tracking to prevent interference with SPA navigation
            page_location: window.location.origin + window.location.pathname,  // Only track path, not query params
            custom_map: {},
            allow_enhanced_measurement: false,  // Disable scroll, click, file download tracking
          });
          `}
      </Script>
      */}
    </>
  );
}
