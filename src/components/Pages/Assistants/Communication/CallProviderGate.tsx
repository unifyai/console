'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import type { CallProviderActions } from './CallProvider';

const CallProviderLazy = dynamic(
  () => import('./CallProvider').then((m) => ({ default: m.CallProvider })),
  { ssr: false }
);

const CALL_ACTIVE_STORAGE_KEY = 'console:call-active';

/**
 * Mounts the LiveKit call engine for the authenticated home layout so calls,
 * chat SSE, and action streams survive navigation across assistants, settings,
 * and admin routes.
 */
export function CallProviderGate({
  callActions,
  userMeta,
  children,
}: {
  callActions: CallProviderActions;
  userMeta: {
    email: string | null | undefined;
    image: string | null | undefined;
    voiceSample?: string | null;
  };
  children: React.ReactNode;
}) {
  const handleCallLifecycleChange = React.useCallback((active: boolean) => {
    sessionStorage.setItem(CALL_ACTIVE_STORAGE_KEY, active ? '1' : '0');
  }, []);

  return (
    <CallProviderLazy
      callActions={callActions}
      userMeta={userMeta}
      onCallLifecycleChange={handleCallLifecycleChange}
    >
      {children}
    </CallProviderLazy>
  );
}
