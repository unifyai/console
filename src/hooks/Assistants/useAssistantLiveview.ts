'use client';

import * as React from 'react';
import { useDesktopReady } from '@/hooks/Assistants/useDesktopReady';
import { resolveManagedDesktopMode } from '@/utils/assistants/managed-desktop';
import type { AssistantActions } from '@/types/assistants/assistant';

const LIVEVIEW_POLL_INTERVAL_MS = 3_000;

/** The subset of an assistant needed to resolve its desktop liveview. */
export interface LiveviewAssistant {
  agentId: string;
  ownerUserId: string | null;
  organizationId: number | null;
  desktopMode: 'ubuntu' | 'windows' | 'macos' | null;
  managedDesktopStatus: 'active' | 'grace_period' | 'disabled' | null;
}

export type LiveviewStatus = 'idle' | 'connecting' | 'ready' | 'error' | 'unavailable';

export interface AssistantLiveview {
  liveviewUrl: string | null;
  status: LiveviewStatus;
  error: string | null;
}

/**
 * Resolve and health-check one assistant's desktop liveview.
 *
 * The desktop is a page served by the assistant's own VM, so "showing it"
 * means mounting that URL — there is no media track to subscribe to. Several
 * viewers can mount the same desktop at once, which is why this resolves
 * per-viewer rather than being handed down from whoever started the share.
 *
 * A missing URL is not an error: the VM may still be starting, so the hook
 * keeps polling while `enabled` and reports `connecting`. `unavailable` means
 * the assistant has no managed desktop at all, which no amount of waiting
 * fixes.
 */
export function useAssistantLiveview(
  assistant: LiveviewAssistant | null,
  desktopActions: Pick<AssistantActions, 'desktop'>,
  enabled: boolean
): AssistantLiveview {
  const [liveviewUrl, setLiveviewUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const agentId = assistant?.agentId;
  const ownerUserId = assistant?.ownerUserId ?? null;
  const organizationId = assistant?.organizationId ?? null;
  const hasManagedDesktop = assistant ? resolveManagedDesktopMode(assistant) != null : false;
  const active = enabled && Boolean(agentId) && Boolean(ownerUserId) && hasManagedDesktop;

  const boundGetLiveviewUrl = React.useCallback(
    (id: string) => desktopActions.desktop.getLiveviewUrl(id, ownerUserId ?? '', organizationId),
    [desktopActions, ownerUserId, organizationId]
  );

  const { eventLiveviewUrl, eventLiveviewPassword } = useDesktopReady(
    active ? agentId : undefined,
    boundGetLiveviewUrl,
    false,
    active ? LIVEVIEW_POLL_INTERVAL_MS : null,
    0,
    undefined,
    undefined,
    true
  );

  React.useEffect(() => {
    if (!active) {
      setLiveviewUrl(null);
      setError(null);
      return;
    }
    let cancelled = false;

    const resolve = async () => {
      try {
        let resolved: string | undefined;
        if (eventLiveviewUrl) {
          const built = await desktopActions.desktop.buildLiveviewUrl(
            eventLiveviewUrl,
            ownerUserId ?? '',
            organizationId,
            eventLiveviewPassword
          );
          resolved = built.liveviewUrl;
        } else {
          const result = await desktopActions.desktop.getLiveviewUrl(
            agentId as string,
            ownerUserId ?? '',
            organizationId
          );
          if ('liveviewUrl' in result) resolved = result.liveviewUrl;
        }
        if (cancelled) return;
        if (!resolved) {
          // Still starting, or not ours to see. Either way there is nothing to
          // mount yet and the poll above will come back around.
          setLiveviewUrl(null);
          return;
        }
        const healthy = await desktopActions.desktop.checkLiveviewHealth(resolved);
        if (cancelled) return;
        if (!healthy) {
          setLiveviewUrl(null);
          return;
        }
        setLiveviewUrl(resolved);
        setError(null);
      } catch (e: unknown) {
        if (cancelled) return;
        setLiveviewUrl(null);
        setError(e instanceof Error ? e.message : 'Could not open the desktop.');
      }
    };

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [
    active,
    agentId,
    ownerUserId,
    organizationId,
    eventLiveviewUrl,
    eventLiveviewPassword,
    desktopActions,
  ]);

  const status: LiveviewStatus = !enabled
    ? 'idle'
    : !hasManagedDesktop
      ? 'unavailable'
      : error
        ? 'error'
        : liveviewUrl
          ? 'ready'
          : 'connecting';

  return { liveviewUrl, status, error };
}
