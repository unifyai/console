/**
 * Hook driving the Microsoft Teams (bot) install panel in the assistant
 * contact manager.
 *
 * Holds the org's install row in local state seeded from the value the
 * page server-prefetches, and exposes a ``bind`` callback that claims a
 * pending install for the org via its handshake nonce, plus a
 * ``refresh`` that re-reads the current status.
 *
 * Unlike the Slack workspace connector there is no OAuth dance: the bot
 * is installed org-wide from the Teams Store out-of-band, and Console's
 * only job is the tenant→org bind handshake keyed on the nonce the
 * installer was shown.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  isMsTeamsBotInstall,
  type MsTeamsBotInstall,
  type MsTeamsBotInstallActions,
} from '@/types/ms-teams-bot/install';

interface UseMsTeamsBotIntegrationArgs {
  orgId: number;
  initialInstall: MsTeamsBotInstall | null;
  actions: MsTeamsBotInstallActions;
}

export function useMsTeamsBotIntegration({
  orgId,
  initialInstall,
  actions,
}: UseMsTeamsBotIntegrationArgs) {
  const [install, setInstall] = useState<MsTeamsBotInstall | null>(initialInstall);
  const [isBinding, setIsBinding] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // The page prefetches the install for one org scope; if the active
  // workspace switches to a different org the seeded value is stale, so
  // drop it and refetch.
  const lastSyncedOrgRef = useRef<number>(orgId);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const result = await actions.getInstall(orgId);
      if (result === null) {
        setInstall(null);
      } else if (isMsTeamsBotInstall(result)) {
        setInstall(result);
      } else {
        console.error('[ms-teams-bot] failed to refresh install:', result);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [actions, orgId]);

  useEffect(() => {
    if (lastSyncedOrgRef.current === orgId) return;
    lastSyncedOrgRef.current = orgId;
    setInstall(null);
    void refresh();
  }, [orgId, refresh]);

  const bind = useCallback(
    async (nonce: string): Promise<boolean> => {
      setIsBinding(true);
      try {
        const result = await actions.bindInstall(orgId, nonce);
        if (isMsTeamsBotInstall(result)) {
          setInstall(result);
          toast.success('Microsoft Teams bot connected to your organization.');
          return true;
        }
        console.error('[ms-teams-bot] bind failed:', result);
        toast.error('Could not connect the Teams bot. Check the code and try again.');
        return false;
      } finally {
        setIsBinding(false);
      }
    },
    [actions, orgId]
  );

  return {
    install,
    isBinding,
    isRefreshing,
    bind,
    refresh,
  };
}
