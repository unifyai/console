'use client';

import { useEffect, useRef } from 'react';
import { useEnvironment } from '@/components/Pages/Providers/EnvironmentProvider';

/**
 * Ensures the local Unity Coordinator runtime is running whenever an
 * authenticated user opens Console in a self-host install. Idempotent —
 * safe on every page load; Pub/Sub topics are owned by unity stack up.
 */
export function SelfHostRuntimeBootstrap() {
  const { isSelfHost } = useEnvironment();
  const started = useRef(false);

  useEffect(() => {
    if (!isSelfHost || started.current) return;
    started.current = true;

    fetch('/api/self-host/start-coordinator', { method: 'POST' }).catch(() => {
      // Unauthenticated or transient failure — login flow retries on sign-in.
    });
  }, [isSelfHost]);

  return null;
}
