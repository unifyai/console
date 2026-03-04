'use client';

import React, { createContext, useContext } from 'react';

/**
 * Environment configuration passed from the server layout to client components.
 *
 * Values are resolved server-side (where all env vars are available) and
 * injected into React context so that client components never need direct
 * access to server-only environment variables.
 *
 * IMPORTANT: This component is `'use client'` — it cannot read non-NEXT_PUBLIC_
 * env vars at runtime in production builds.  The `config` prop MUST be resolved
 * in a server component (e.g. Base.tsx) and passed down.
 */
export interface EnvironmentConfig {
  /** Whether the app is running in a staging / development environment. */
  isStaging: boolean;
  /** Cloudflare Turnstile site key (public). Undefined when not configured. */
  turnstileSiteKey?: string;
}

const EnvironmentContext = createContext<EnvironmentConfig | undefined>(undefined);

export function EnvironmentProvider({
  config,
  children,
}: {
  /** Resolved server-side in a Server Component and passed as a prop. */
  config: EnvironmentConfig;
  children: React.ReactNode;
}) {
    return (
        <EnvironmentContext.Provider value={config}>
        {children}
        </EnvironmentContext.Provider>
    );
}

/**
 * Access the environment config from any client component.
 *
 * Must be used within an `<EnvironmentProvider>`.
 */
export function useEnvironment(): EnvironmentConfig {
  const ctx = useContext(EnvironmentContext);
  if (ctx === undefined) {
    throw new Error('useEnvironment must be used within an EnvironmentProvider');
  }
  return ctx;
}

