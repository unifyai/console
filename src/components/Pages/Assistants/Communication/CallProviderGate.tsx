'use client';

import * as React from 'react';
import { CallProvider, type CallProviderActions } from './CallProvider';

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
    <CallProvider
      callActions={callActions}
      userMeta={userMeta}
      onCallLifecycleChange={handleCallLifecycleChange}
    >
      {children}
    </CallProvider>
  );
}
