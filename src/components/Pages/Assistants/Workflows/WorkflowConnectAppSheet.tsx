'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { ProviderIntegrationDetailSheet } from '@/components/Integrations';
import { useProviderIntegrationCatalog } from '@/hooks/Assistants/useProviderIntegrationCatalog';
import { useIntegrationGalleryModel } from '@/hooks/Integrations/useIntegrationGalleryModel';
import { useProviderIntegrationDetail } from '@/hooks/Integrations/useProviderIntegrationDetail';
import type { IntegrationGalleryItem } from '@/types/integrations';

/**
 * Connecting a workflow's required app never leaves the Workflows surface.
 *
 * This mounts the ordinary provider drawer — the same component the
 * Integrations gallery opens — as a nested overlay above the workflow
 * sheet, so OAuth, API keys, scopes, tools and the bring-your-own-OAuth
 * form all behave exactly as they do on the Integrations tab. Sending the
 * user to Integrations and expecting them to navigate back mid-install is
 * the flow this replaces.
 *
 * Same component is not enough on its own: the gallery list carries a
 * *summary* of each app, and scopes, tools and the API-key schema arrive
 * only from the per-app detail fetch. Mounting the drawer without that
 * showed Slack with its scopes and none of its 157 tools, which read as a
 * different product. `useProviderIntegrationDetail` is the same fetch and
 * merge the Integrations pane uses, so the two cannot drift again.
 */
export function WorkflowConnectAppSheet({
  assistantId,
  canonicalSlug,
  displayName,
  open,
  canWrite = true,
  onOpenChange,
  onConnected,
}: {
  assistantId: string;
  /** Requirement being connected; null closes the sheet. */
  canonicalSlug: string | null;
  displayName: string | null;
  open: boolean;
  /** Gates the admin bring-your-own-OAuth form, as on the Integrations tab. */
  canWrite?: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired once the app reports connected, so held jobs can arm. */
  onConnected: (canonicalSlug: string) => void;
}) {
  const catalog = useProviderIntegrationCatalog(assistantId, {
    query: canonicalSlug ?? undefined,
    enabled: open && !!canonicalSlug,
  });

  const items = useIntegrationGalleryModel({
    providerDefinitions: catalog.definitions,
    staticDefinitions: [],
    mockDefinitions: catalog.definitions,
    useMock: catalog.isMock,
  });

  const listed = React.useMemo<IntegrationGalleryItem | null>(
    () => items.find((candidate) => candidate.canonicalSlug === canonicalSlug) ?? null,
    [items, canonicalSlug]
  );

  const item = useProviderIntegrationDetail({
    selected: listed,
    latest: listed,
    detailsBySlug: catalog.detailsBySlug,
    fetchDetails: catalog.fetchDetails,
  });

  const resolving = open && !catalog.hasLoaded;

  // The provider catalog has settled and does not carry this app. That is a
  // bundle bug — a requirement slug outside the gallery's id space (the
  // shipped bundle once said `google_workspace`, a valid OAuth alias
  // upstream but invisible here).
  //
  // This used to call `onConnected` and close, on the reasoning that the
  // shelf must not dead-end. That was worse than a dead end: it toasted
  // "Gmail connected", armed the held jobs and left the app unconnected,
  // so the user was told the opposite of what happened. An honest failure
  // is the only acceptable outcome — say what went wrong and change
  // nothing.
  const unresolved = open && !!canonicalSlug && !resolving && !item;
  React.useEffect(() => {
    if (!unresolved || !canonicalSlug) return;
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        `[workflows] Requirement slug "${canonicalSlug}" does not resolve to an ` +
          `integrations gallery app. Requirement slugs must be provider app ` +
          `slugs from the same id space as IntegrationDefinition.canonicalSlug ` +
          `— fix the bundle manifest rather than the UI.`
      );
    }
    toast.error(`Couldn't open ${displayName || canonicalSlug}.`, {
      description: 'This app is not in the integrations catalogue. Nothing was connected.',
    });
    onOpenChange(false);
  }, [unresolved, canonicalSlug, displayName, onOpenChange]);

  const handleConnect = React.useCallback(
    async (
      target: IntegrationGalleryItem,
      options?: { accountLabel?: string },
      apiKeyValues?: Record<string, string>
    ) => {
      const result = await catalog.startConnect(target, apiKeyValues, {
        accountLabel: options?.accountLabel,
      });
      if (result?.connection?.status === 'connected') {
        onConnected(target.canonicalSlug);
        onOpenChange(false);
        return;
      }
      if (!result) {
        toast.error('Could not start the connection. Please try again.');
      }
      // OAuth popups settle asynchronously; the catalog's own connect-settled
      // subscription refreshes this drawer, and the effect below arms the
      // workflow when the connection lands.
    },
    [catalog, onConnected, onOpenChange]
  );

  // Arm held jobs the moment the catalog reports the app connected, however
  // the connection settled (popup, manual authorize, or API key).
  React.useEffect(() => {
    if (!open || !canonicalSlug || !item) return;
    if (item.status === 'connected' || item.status === 'configured') {
      onConnected(canonicalSlug);
    }
  }, [open, canonicalSlug, item, onConnected]);

  if (!canonicalSlug) return null;

  return (
    <ProviderIntegrationDetailSheet
      item={item}
      open={open}
      assistantId={assistantId}
      isDetailLoading={resolving || catalog.isDetailLoading === canonicalSlug}
      busy={catalog.isConnecting === canonicalSlug}
      canManageCustomAuth={canWrite}
      onOpenChange={onOpenChange}
      onPrimaryAction={(target, options) => void handleConnect(target, options)}
      onApiKeySubmit={(target, values, options) => void handleConnect(target, options, values)}
      aria-label={displayName ? `Connect ${displayName}` : undefined}
    />
  );
}
