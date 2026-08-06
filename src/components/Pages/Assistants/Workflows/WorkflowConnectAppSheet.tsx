'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { ProviderIntegrationDetailSheet } from '@/components/Integrations';
import { useProviderIntegrationCatalog } from '@/hooks/Assistants/useProviderIntegrationCatalog';
import { useIntegrationGalleryModel } from '@/hooks/Integrations/useIntegrationGalleryModel';
import type { IntegrationGalleryItem } from '@/types/integrations';

/**
 * Connecting a workflow's required app never leaves the Workflows surface.
 *
 * This mounts the ordinary provider drawer — the same component the
 * Integrations gallery opens — as a nested overlay above the workflow sheet,
 * so OAuth, API keys, scopes and account labels all behave exactly as they do
 * on the Integrations tab. Sending the user to Integrations and expecting them
 * to navigate back mid-install is the flow this replaces.
 *
 * When the provider catalog cannot resolve the app (mock catalogs, or a
 * requirement whose canonical slug is not in the provider catalog yet), the
 * caller's `onConnected` still runs so the workflow's held jobs arm — the
 * shelf must never dead-end on a requirement it cannot open.
 */
export function WorkflowConnectAppSheet({
  assistantId,
  canonicalSlug,
  displayName,
  open,
  onOpenChange,
  onConnected,
}: {
  assistantId: string;
  /** Requirement being connected; null closes the sheet. */
  canonicalSlug: string | null;
  displayName: string | null;
  open: boolean;
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

  const item = React.useMemo<IntegrationGalleryItem | null>(
    () => items.find((candidate) => candidate.canonicalSlug === canonicalSlug) ?? null,
    [items, canonicalSlug]
  );

  const resolving = open && !catalog.hasLoaded;

  // The provider catalog has settled and does not carry this app — arm the
  // workflow anyway rather than stranding the user on an empty drawer.
  React.useEffect(() => {
    if (!open || !canonicalSlug || resolving || item) return;
    onConnected(canonicalSlug);
    onOpenChange(false);
  }, [open, canonicalSlug, resolving, item, onConnected, onOpenChange]);

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
      onOpenChange={onOpenChange}
      onPrimaryAction={(target, options) => void handleConnect(target, options)}
      onApiKeySubmit={(target, values, options) => void handleConnect(target, options, values)}
      aria-label={displayName ? `Connect ${displayName}` : undefined}
    />
  );
}
