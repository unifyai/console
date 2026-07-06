/**
 * Hook driving the Slack workspace install panel in Org Settings.
 *
 * Holds the install row in local state seeded from the
 * server-prefetched value the org page hands down, exposes
 * ``connect`` / ``disconnect`` callbacks, and consumes the
 * ``slack_install`` / ``slack_install_error`` query params the
 * OAuth callback sets on redirect to surface a one-shot toast.
 *
 * Reads/revoke go through the server actions bound on the page
 * (``slackInstallActions.getInstall`` / ``revokeInstall``). Connect
 * goes through the ``/api/slack/oauth/start`` route because it has
 * to mint a server-side cookie (the state nonce) — which a server
 * action can do too in principle, but having a dedicated POST route
 * lets the browser open the returned authorize URL in a new tab
 * without flickering through an intermediate render.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { startSlackOAuth } from '@/lib/client/slack';
import {
  isSlackInstall,
  type SlackInstall,
  type SlackInstallActions,
  type SlackInstallOwner,
} from '@/types/slack/install';
import type { ResponseProps } from '@/types/common';

interface UseSlackIntegrationArgs {
  owner: SlackInstallOwner;
  initialInstall: SlackInstall | null;
  actions: SlackInstallActions;
  /** Path the OAuth callback should redirect back to. Falls back to
   *  the assistants page (where the Slack connector lives). */
  redirectAfter?: string;
}

/** Stable string key for an owner descriptor (for ref comparison). */
function ownerKey(owner: SlackInstallOwner): string {
  return owner.kind === 'org' ? `org:${owner.orgId}` : `user:${owner.userId}`;
}

interface FlashState {
  success: { team: string | null } | null;
  error: { reason: string } | null;
}

/* Keys are the raw error tokens emitted by the OAuth callback (and
 * by Slack itself, e.g. ``access_denied``); they reach the browser
 * as the value of the ``slack_install_error`` query param and must
 * stay byte-identical so the lookup hits. */
/* eslint-disable @typescript-eslint/naming-convention */
const FRIENDLY_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Slack install was cancelled.',
  state_invalid: 'The Slack install link expired. Please try again.',
  missing_params: 'The Slack install link was incomplete. Please try again.',
  owner_mismatch: 'You are not allowed to manage this Slack workspace install.',
  token_exchange_failed: 'Could not complete the Slack install. Please try again.',
  persist_failed: 'Could not save the Slack install. Please try again.',
};
/* eslint-enable @typescript-eslint/naming-convention */

function describeError(reason: string): string {
  return FRIENDLY_ERROR_MESSAGES[reason] ?? 'Could not complete the Slack install.';
}

export function useSlackCallbackFlash(): FlashState & { clear: () => void } {
  const [state, setState] = useState<FlashState>({ success: null, error: null });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const success = params.get('slack_install');
    const error = params.get('slack_install_error');
    if (success === 'success') {
      setState({ success: { team: params.get('slack_team') }, error: null });
    } else if (error) {
      setState({ success: null, error: { reason: error } });
    }
  }, []);

  const clear = useCallback(() => {
    setState({ success: null, error: null });
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('slack_install');
    url.searchParams.delete('slack_install_error');
    url.searchParams.delete('slack_team');
    window.history.replaceState({}, '', url.toString());
  }, []);

  return { ...state, clear };
}

export function useSlackIntegration({
  owner,
  initialInstall,
  actions,
  redirectAfter,
}: UseSlackIntegrationArgs) {
  const [install, setInstall] = useState<SlackInstall | null>(initialInstall);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Track the owner the current install state is for. The page
  // prefetches the install for one owner scope; if the owner changes
  // (e.g. the active workspace switches) the seeded value is stale, so
  // we drop it and refetch.
  const lastSyncedOwnerRef = useRef<string>(ownerKey(owner));

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const result = await actions.getInstall(owner);
      if (result === null) {
        setInstall(null);
      } else if (isSlackInstall(result)) {
        setInstall(result);
      } else {
        console.error('[slack] failed to refresh install:', result);
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

  const flash = useSlackCallbackFlash();

  // Surface the post-redirect toast once, then re-read the install
  // row server-side so the panel shows the freshly-persisted team.
  useEffect(() => {
    if (flash.success) {
      const team = flash.success.team;
      toast.success(team ? `Slack workspace "${team}" connected.` : 'Slack workspace connected.');
      void refresh();
      flash.clear();
    } else if (flash.error) {
      toast.error(describeError(flash.error.reason));
      console.error(`[slack] install failed: ${flash.error.reason}`);
      flash.clear();
    }
    // intentionally fires once; ``flash`` reads the URL on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const { authorizeUrl } = await startSlackOAuth({
        owner,
        redirectAfter: redirectAfter ?? '/assistants',
      });
      window.open(authorizeUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('[slack] failed to start OAuth:', err);
      toast.error('Could not start the Slack install. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  }, [owner, redirectAfter]);

  const disconnect = useCallback(async () => {
    if (!install) return;
    setIsDisconnecting(true);
    try {
      const result = await actions.revokeInstall(owner, install.id);
      if ('revoked' in result && result.revoked) {
        toast.success('Slack workspace disconnected.');
        setInstall(null);
      } else {
        const detail = (result as ResponseProps).detail ?? 'Failed to disconnect Slack workspace.';
        toast.error('Could not disconnect Slack. Please try again.');
        console.error(`[slack] disconnect failed: ${detail}`);
      }
    } finally {
      setIsDisconnecting(false);
    }
  }, [actions, install, owner]);

  return {
    install,
    isConnecting,
    isDisconnecting,
    isRefreshing,
    connect,
    disconnect,
    refresh,
  };
}
