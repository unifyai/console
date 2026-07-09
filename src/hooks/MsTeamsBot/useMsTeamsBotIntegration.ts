/**
 * Hook driving the Microsoft Teams (bot) install panel in the assistant
 * contact manager.
 *
 * Holds the owner's install row in local state seeded from the value the
 * page server-prefetches, and exposes a ``bind`` callback that claims a
 * pending install for the owner via its handshake nonce, plus a
 * ``refresh`` that re-reads the current status.
 *
 * Unlike the Slack workspace connector there is no OAuth dance: the bot
 * is installed tenant-wide from the Teams Store out-of-band, and Console's
 * only job is the tenant→owner bind handshake keyed on the nonce the
 * installer was shown. The owner is an org (owner/admin) or a personal
 * user.
 *
 * ``disconnect`` revokes the bound install (Orchestra-side teardown only —
 * it cannot uninstall the app from the customer's Teams tenant). Because
 * there is no OAuth to re-run, "re-install" is not a one-click action like
 * Slack's: instead ``beginRebind`` re-exposes the bind form so the user can
 * paste a fresh install code after re-adding the app in Teams.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  isMsTeamsBotInstall,
  type MsTeamsBotInstall,
  type MsTeamsBotInstallActions,
  type MsTeamsBotInstallOwner,
} from '@/types/ms-teams-bot/install';

interface UseMsTeamsBotIntegrationArgs {
  owner: MsTeamsBotInstallOwner;
  initialInstall: MsTeamsBotInstall | null;
  actions: MsTeamsBotInstallActions;
}

/** Stable string key for an owner descriptor (for ref comparison). */
function ownerKey(owner: MsTeamsBotInstallOwner): string {
  return owner.kind === 'org' ? `org:${owner.orgId}` : `user:${owner.userId}`;
}

export function useMsTeamsBotIntegration({
  owner,
  initialInstall,
  actions,
}: UseMsTeamsBotIntegrationArgs) {
  const [install, setInstall] = useState<MsTeamsBotInstall | null>(initialInstall);
  const [isBinding, setIsBinding] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  // Whether the bind form is force-shown over a currently-bound install
  // (the "Re-install" affordance). Reset once a bind or disconnect settles.
  const [showRebind, setShowRebind] = useState(false);

  // The page prefetches the install for one owner scope; if the active
  // workspace switches to a different owner the seeded value is stale, so
  // drop it and refetch.
  const lastSyncedOwnerRef = useRef<string>(ownerKey(owner));

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const result = await actions.getInstall(owner);
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
  }, [actions, owner]);

  useEffect(() => {
    const key = ownerKey(owner);
    if (lastSyncedOwnerRef.current === key) return;
    lastSyncedOwnerRef.current = key;
    setInstall(null);
    void refresh();
  }, [owner, refresh]);

  const bind = useCallback(
    async (nonce: string): Promise<boolean> => {
      setIsBinding(true);
      try {
        const result = await actions.bindInstall(owner, nonce);
        if (isMsTeamsBotInstall(result)) {
          setInstall(result);
          setShowRebind(false);
          toast.success(
            owner.kind === 'org'
              ? 'Microsoft Teams bot connected to your organization.'
              : 'Microsoft Teams bot connected to your account.'
          );
          return true;
        }
        console.error('[ms-teams-bot] bind failed:', result);
        toast.error('Could not connect the Teams bot. Check the code and try again.');
        return false;
      } finally {
        setIsBinding(false);
      }
    },
    [actions, owner]
  );

  const disconnect = useCallback(async (): Promise<boolean> => {
    if (!install) return false;
    setIsDisconnecting(true);
    try {
      const result = await actions.revokeInstall(owner, install.id);
      if ('revoked' in result && result.revoked) {
        setInstall(null);
        setShowRebind(false);
        toast.success(
          owner.kind === 'org'
            ? 'Microsoft Teams bot disconnected from your organization.'
            : 'Microsoft Teams bot disconnected from your account.'
        );
        return true;
      }
      console.error('[ms-teams-bot] disconnect failed:', result);
      toast.error('Could not disconnect the Teams bot. Please try again.');
      return false;
    } finally {
      setIsDisconnecting(false);
    }
  }, [actions, owner, install]);

  const beginRebind = useCallback(() => setShowRebind(true), []);
  const cancelRebind = useCallback(() => setShowRebind(false), []);

  return {
    install,
    isBinding,
    isRefreshing,
    isDisconnecting,
    showRebind,
    bind,
    refresh,
    disconnect,
    beginRebind,
    cancelRebind,
  };
}
