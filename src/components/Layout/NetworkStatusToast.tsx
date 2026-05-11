'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { useNetworkStatus } from '@/hooks/Common/useNetworkStatus';

/* --------------------------
   NetworkStatusToast
   --------------------------
   Renders nothing; subscribes to browser `online`/`offline` events
   (via `useNetworkStatus`) and drives a single sonner toast through
   its lifecycle:

     - offline  → sticky error toast (`duration: Infinity`) so the
                  message stays visible for as long as the user is
                  disconnected. The user can still dismiss it via the
                  close button if they want it out of the way.
     - online   → the same toast id is replaced with a transient
                  success toast that auto-dismisses, so the user gets
                  positive confirmation that connectivity is back
                  without leaving stale UI behind. We only fire the
                  recovery toast if we *previously* showed the offline
                  one in this session — first mount with
                  `navigator.onLine === true` is silent, since there
                  is nothing to recover from.

   Sharing a single `id` (`TOAST_ID`) is what lets sonner replace the
   error toast in place rather than stacking offline/online pairs each
   time the user's connection flaps. */

const TOAST_ID = 'network-offline';

const OFFLINE_MESSAGE = "You're offline";
const OFFLINE_DESCRIPTION = 'Some features may not work until you reconnect.';
const ONLINE_MESSAGE = 'Back online';
const ONLINE_TOAST_DURATION_MS = 3_000;

export function NetworkStatusToast() {
  const { isOnline } = useNetworkStatus();

  // Tracks whether the offline toast is currently live, so we know
  // whether a transition to `online` should fire the recovery toast.
  // A ref (not state) is fine — we don't render anything based on it
  // and only read it inside the effect.
  const hasShownOfflineRef = React.useRef(false);

  React.useEffect(() => {
    if (!isOnline) {
      toast.error(OFFLINE_MESSAGE, {
        id: TOAST_ID,
        description: OFFLINE_DESCRIPTION,
        duration: Infinity,
      });
      hasShownOfflineRef.current = true;
      return;
    }

    if (hasShownOfflineRef.current) {
      toast.success(ONLINE_MESSAGE, {
        id: TOAST_ID,
        duration: ONLINE_TOAST_DURATION_MS,
      });
      hasShownOfflineRef.current = false;
    }
  }, [isOnline]);

  return null;
}
