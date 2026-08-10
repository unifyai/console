'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { ProviderConnectSurface } from '@/components/Integrations';
import { useProviderIntegrationCatalog } from '@/hooks/Assistants/useProviderIntegrationCatalog';
import { useIntegrationGalleryModel } from '@/hooks/Integrations/useIntegrationGalleryModel';
import { useProviderIntegrationDetail } from '@/hooks/Integrations/useProviderIntegrationDetail';
import type { IntegrationGalleryItem } from '@/types/integrations';

/**
 * Connecting a workflow's required app never leaves the Workflows surface.
 *
 * Everything below the resolution of *which* app is `ProviderConnectSurface`
 * — the same component the Integrations gallery mounts, so the drawer, the
 * account-label step, the OAuth round trip, and disconnect / cancel /
 * reconnect / test / relabel are the same code, not the same-looking code.
 * This file owns only what differs: the shelf knows the slug it needs, and
 * the gallery knows a browse position.
 *
 * Resolution is an exact `in` query on that slug. It used to be the browse
 * search — a substring match over display name, slug and description,
 * returned a page at a time — which could not distinguish "not published"
 * from "crowded off the first page by other apps mentioning the same word".
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
  const slugs = React.useMemo(() => (canonicalSlug ? [canonicalSlug] : []), [canonicalSlug]);
  const catalog = useProviderIntegrationCatalog(assistantId, {
    slugs,
    enabled: open && !!canonicalSlug,
  });

  const items = useIntegrationGalleryModel({
    providerDefinitions: catalog.definitions,
    staticDefinitions: [],
    mockDefinitions: catalog.definitions,
    useMock: catalog.isMock,
  });

  const findLatest = React.useCallback(
    (slug: string) => items.find((candidate) => candidate.canonicalSlug === slug) ?? null,
    [items]
  );

  const listed = React.useMemo<IntegrationGalleryItem | null>(
    () => (canonicalSlug ? findLatest(canonicalSlug) : null),
    [canonicalSlug, findLatest]
  );

  const item = useProviderIntegrationDetail({
    selected: listed,
    latest: listed,
    detailsBySlug: catalog.detailsBySlug,
    fetchDetails: catalog.fetchDetails,
  });

  // `hasLoaded` stays true across requests, so on a second open it reported
  // the previous app's answer for this one — the drawer declared the app
  // missing before its own query had even been issued. Only "this request
  // has landed" is a verdict.
  const resolving = open && !catalog.hasLoadedRequest;

  // The catalogue has answered for this slug and does not carry it. That is
  // a bundle bug — a requirement slug outside the gallery's id space (the
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

  if (!canonicalSlug) return null;

  return (
    <ProviderConnectSurface
      assistantId={assistantId}
      item={item}
      open={open}
      onOpenChange={onOpenChange}
      findLatest={findLatest}
      startConnect={catalog.startConnect}
      refresh={catalog.refresh}
      fetchDetails={catalog.fetchDetails}
      isMock={catalog.isMock}
      isDetailLoading={resolving || catalog.isDetailLoading === canonicalSlug}
      connectingSlug={catalog.isConnecting}
      canManageCustomAuth={canWrite}
      onConnected={onConnected}
      ariaLabel={displayName ? `Connect ${displayName}` : undefined}
    />
  );
}
