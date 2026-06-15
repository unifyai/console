'use client';

import React, { createContext, useContext } from 'react';
import type { Features } from '@/lib/features/features';
import type { Environment } from '@/lib/environment/environment';

/**
 * Server→client bridge for the two configuration axes:
 *
 *  - `environment` — deployment topology + auth mode (see {@link Environment}).
 *  - `features`    — credential-derived capabilities (see {@link Features}).
 *
 * Both are resolved server-side (where all env vars are available) and injected
 * into React context so client components never read server-only env vars.
 *
 * IMPORTANT: This component is `'use client'` — it cannot read non-NEXT_PUBLIC_
 * env vars at runtime in production builds. The `config` prop MUST be resolved
 * in a Server Component (e.g. Base.tsx) and passed down.
 */
export interface EnvironmentConfig {
  /** Deployment topology + auth mode. Read via `useEnvironment()`. */
  environment: Environment;
  /** Credential-driven capability set. Read via `useFeatures()`. */
  features: Features;
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
  return <EnvironmentContext.Provider value={config}>{children}</EnvironmentContext.Provider>;
}

function useEnvironmentConfig(): EnvironmentConfig {
  const ctx = useContext(EnvironmentContext);
  if (ctx === undefined) {
    throw new Error('useEnvironment must be used within an EnvironmentProvider');
  }
  return ctx;
}

/**
 * Access the deployment environment (topology + auth mode) from any client
 * component. Use this for facts no credential captures — e.g. self-host
 * topology, staging, or auth mode.
 *
 * Must be used within an `<EnvironmentProvider>`.
 */
export function useEnvironment(): Environment {
  return useEnvironmentConfig().environment;
}

/**
 * Access the resolved feature set from any client component.
 *
 * Prefer this over reading env vars directly: features are derived from
 * provisioned credentials, so the same component code works for both the hosted
 * cloud (all features on) and self-host (BYOK subset).
 *
 * Must be used within an `<EnvironmentProvider>`.
 */
export function useFeatures(): Features {
  return useEnvironmentConfig().features;
}
