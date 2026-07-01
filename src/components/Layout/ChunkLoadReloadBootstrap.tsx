'use client';

import { useEffect } from 'react';
import { tryReloadForChunkLoadError } from '@/utils/chunkLoadReload';

/**
 * After a deploy, long-lived tabs can still reference old chunk hashes.
 * Recover with a single full reload instead of leaving users on the error boundary.
 */
export function ChunkLoadReloadBootstrap() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (tryReloadForChunkLoadError(event.error ?? event.message)) {
        event.preventDefault();
      }
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      if (tryReloadForChunkLoadError(event.reason)) {
        event.preventDefault();
      }
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
