import React from 'react';
import { SessionProvider } from '@/components/Pages/Providers/SessionProvider';
import { EnvironmentProvider } from '@/components/Pages/Providers/EnvironmentProvider';
import { resolveFeatures } from '@/lib/features/features';
import { resolveEnvironment } from '@/lib/environment/environment';

// Runtime env vars such as TURNSTILE_SITE_KEY are injected at deploy time.
export const dynamic = 'force-dynamic';

export default function AuthEmbedLayout({ children }: { children: React.ReactNode }) {
  const environment = resolveEnvironment();
  const features = resolveFeatures(process.env, environment);
  const envConfig = {
    environment,
    features,
  };

  return (
    <SessionProvider>
      <EnvironmentProvider config={envConfig}>{children}</EnvironmentProvider>
    </SessionProvider>
  );
}
