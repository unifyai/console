import * as React from 'react';

const HEARTBEAT_INTERVAL = 60000;

/**
 * Sends a presence heartbeat (PUT /api/user/presence) immediately and every
 * 60s while `enabled` and the tab is visible. Pauses while the tab is
 * hidden and beats again as soon as it becomes visible. Errors are
 * swallowed — presence is best-effort.
 */
export function usePresenceHeartbeat(enabled: boolean) {
  React.useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const beat = () => {
      fetch('/api/user/presence', { method: 'PUT' }).catch(() => {
        // Best-effort heartbeat; the next beat will retry.
      });
    };

    const start = () => {
      if (timer) return;
      beat();
      timer = setInterval(beat, HEARTBEAT_INTERVAL);
    };

    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        start();
      } else {
        stop();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    if (document.visibilityState === 'visible') {
      start();
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      stop();
    };
  }, [enabled]);
}
