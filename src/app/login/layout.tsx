import React from 'react';
import type { Metadata } from 'next';
import { SessionProvider } from '@/components/Pages/Providers/SessionProvider';
import { EnvironmentProvider } from '@/components/Pages/Providers/EnvironmentProvider';
import { resolveFeatures } from '@/lib/features/features';
import { resolveEnvironment } from '@/lib/environment/environment';
import LoginCardShell from '@/components/Pages/Login/LoginCardShell';

export const metadata: Metadata = {
  title: 'Login',
};

// Force dynamic rendering so that runtime environment variables (injected by
// Cloud Run from Secret Manager) are read on every request.  Without this,
// Next.js statically renders the layout at *build time* — when secrets like
// TURNSTILE_SITE_KEY are not yet available — and bakes `undefined` into the
// cached RSC payload, which prevents the Turnstile CAPTCHA widget from ever
// rendering on the client.
export const dynamic = 'force-dynamic';

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  // Resolve config server-side (env vars aren't available in client components)
  const environment = resolveEnvironment();
  const envConfig = {
    environment,
    features: resolveFeatures(process.env, environment),
  };

  return (
    <SessionProvider>
      <EnvironmentProvider config={envConfig}>
        <LoginCardShell>{children}</LoginCardShell>
      </EnvironmentProvider>
    </SessionProvider>
  );
}
