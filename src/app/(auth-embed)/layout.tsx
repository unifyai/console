import React from 'react';
import { SessionProvider } from '@/components/Pages/Providers/SessionProvider';
import { EnvironmentProvider } from '@/components/Pages/Providers/EnvironmentProvider';

// Runtime env vars such as TURNSTILE_SITE_KEY are injected at deploy time.
export const dynamic = 'force-dynamic';

export default function AuthEmbedLayout({ children }: { children: React.ReactNode }) {
  const envConfig = {
    isStaging: (process.env.ORCHESTRA_URL ?? '').includes('staging'),
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY,
  };

  return (
    <SessionProvider>
      <EnvironmentProvider config={envConfig}>{children}</EnvironmentProvider>
    </SessionProvider>
  );
}
