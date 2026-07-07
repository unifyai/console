import * as React from 'react';
import { OrgRoster, parseOrgRoster } from '@/types/orgChat';

const POLLING_INTERVAL = 60000;
/** Keep optimistic online through slow roster polls after live signals. */
const OPTIMISTIC_ONLINE_GRACE_MS = 30_000;

/**
 * Fetches the org roster (human members + teams) and keeps it fresh with a
 * 60s poll while the document is visible. `markHumanOnline` optimistically
 * flips a human to online (e.g. when a live chat frame arrives) so presence
 * doesn't wait for the next poll.
 */
export function useOrgRoster(orgId: string | null) {
  const [roster, setRoster] = React.useState<OrgRoster | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const optimisticOnlineUntilRef = React.useRef<Map<string, number>>(new Map());

  const applyOptimisticOnline = React.useCallback((next: OrgRoster): OrgRoster => {
    const now = Date.now();
    const overrides = optimisticOnlineUntilRef.current;
    if (overrides.size === 0) return next;
    return {
      ...next,
      humans: next.humans.map((human) => {
        const graceUntil = overrides.get(human.userId) ?? 0;
        if (!human.online && graceUntil > now) {
          return { ...human, online: true };
        }
        return human;
      }),
    };
  }, []);

  const fetchRoster = React.useCallback(async () => {
    if (!orgId) {
      setRoster(null);
      return;
    }
    try {
      const response = await fetch(`/api/organizations/${orgId}/roster`);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.detail ?? `Failed to fetch roster (${response.status})`);
        return;
      }
      const data = await response.json();
      setError(null);
      setRoster(applyOptimisticOnline(parseOrgRoster(data)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch roster');
    } finally {
      setIsLoading(false);
    }
  }, [orgId, applyOptimisticOnline]);

  React.useEffect(() => {
    if (!orgId) {
      setRoster(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    fetchRoster();

    const poller = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      fetchRoster();
    }, POLLING_INTERVAL);

    return () => clearInterval(poller);
  }, [orgId, fetchRoster]);

  const markHumanOnline = React.useCallback((userId: string) => {
    optimisticOnlineUntilRef.current.set(userId, Date.now() + OPTIMISTIC_ONLINE_GRACE_MS);
    setRoster((prev) => {
      if (!prev) return prev;
      const human = prev.humans.find((h) => h.userId === userId);
      if (!human || human.online) return prev;
      return {
        ...prev,
        humans: prev.humans.map((h) => (h.userId === userId ? { ...h, online: true } : h)),
      };
    });
  }, []);

  return { roster, isLoading, error, refresh: fetchRoster, markHumanOnline };
}
