'use client';

import { useEffect, useRef } from 'react';
import { IS_SELF_HOST } from '@/lib/auth/self-host';

/**
 * Ensures the local Unity Coordinator runtime is running whenever an
 * authenticated user opens Console in a self-host install. Idempotent —
 * safe on every page load and after stack restarts wipe Pub/Sub topics.
 */
export function SelfHostRuntimeBootstrap() {
  const started = useRef(false);

  useEffect(() => {
    if (!IS_SELF_HOST || started.current) return;
    started.current = true;

    fetch('/api/self-host/start-coordinator', { method: 'POST' }).catch(() => {
      // Unauthenticated or transient failure — login flow retries on sign-in.
    });
  }, []);

  return null;
}
