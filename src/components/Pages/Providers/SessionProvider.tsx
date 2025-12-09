"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { ReactNode } from "react";

interface SessionProviderProps {
  children: ReactNode;
}

/**
 * Custom SessionProvider that disables aggressive session polling.
 * 
 * Why disabled:
 * - refetchOnWindowFocus causes HTTP connection queuing when combined with long-running requests
 * - Browser limit of 6 concurrent connections means session checks queue behind API calls
 * - Sessions are long-lived and API calls handle 401s gracefully
 */
export function SessionProvider({ children }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider
      refetchInterval={0}           // Don't poll for session updates
      refetchOnWindowFocus={false}  // Don't refetch when tab regains focus
      refetchWhenOffline={false}    // Don't refetch when coming back online
    >
      {children}
    </NextAuthSessionProvider>
  );
}
