'use client';

import * as React from 'react';

/**
 * Tracks the browser's reported network connectivity via the `online`
 * and `offline` `window` events plus `navigator.onLine`.
 *
 * Notes on accuracy:
 *   - `navigator.onLine` reflects the OS link state, not real internet
 *     reachability. A laptop on a captive-portal Wi-Fi or a tethered
 *     phone with no upstream data will still read `true`. That's fine
 *     for the "warn me when I've unplugged / Wi-Fi dropped" use case
 *     this hook drives; chasing true reachability would require
 *     periodic pings and isn't worth it for a passive indicator.
 *   - The initial value is `true` (assumed online) so SSR and the very
 *     first client render match. The real value is read in the effect
 *     on mount; if we were already offline at mount, the state flips
 *     in the same tick and any consumer effect (toast, banner, …)
 *     fires immediately.
 */
export function useNetworkStatus(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = React.useState<boolean>(true);

  React.useEffect(() => {
    setIsOnline(typeof navigator === 'undefined' ? true : navigator.onLine);

    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return { isOnline };
}
