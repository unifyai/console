'use client';

import React, { createContext, useContext } from 'react';

/**
 * Environment configuration passed from the server layout to client components.
 *
 * Values are resolved server-side (where all env vars are available) and
 * injected into React context so that client components never need direct
 * access to server-only environment variables.
 */
export interface EnvironmentConfig {
  /** Whether the app is running in a staging / development environment. */
  isStaging: boolean;
}

const EnvironmentContext = createContext<EnvironmentConfig | undefined>(undefined);

export function EnvironmentProvider({
  children
}: {
  children: React.ReactNode;
}) {
    const envConfig: EnvironmentConfig = {
        isStaging: (process.env.ORCHESTRA_URL ?? '').includes('staging'),
    };
    return (
        <EnvironmentContext.Provider value={envConfig}>
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

