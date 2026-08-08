'use client';

import * as React from 'react';
import type { IntegrationDefinition, IntegrationGalleryItem } from '@/types/integrations';

/**
 * The app drawer's data, wherever the drawer is opened from.
 *
 * The gallery list carries a *summary* of each app — enough for a card.
 * Scopes, the tool list, the API-key schema and the bring-your-own-OAuth
 * fields arrive only from the per-app detail fetch, so a surface that
 * mounts `ProviderIntegrationDetailSheet` without fetching shows the same
 * component with most of it missing.
 *
 * That is exactly what happened: connecting Slack from Integrations showed
 * 47 scopes, 157 tools and the admin OAuth form; connecting the same Slack
 * from a workflow showed the scopes alone. Same component, different data,
 * and the difference read as a different product.
 *
 * So the fetch and the merge live here, once, and both surfaces use them.
 */

/** Apps whose detail is fetched lazily rather than carried by the list. */
function hasDeferredDetail(item: IntegrationGalleryItem): boolean {
  return item.source === 'provider_backed' || item.source === 'overlay_curated';
}

/**
 * Fold a fetched detail over the list's summary.
 *
 * The list wins on connection state — it is refreshed by the catalogue and
 * the detail is a snapshot — while the detail supplies everything the
 * summary omits. Each field falls back rather than overwriting with empty,
 * so a partial detail never blanks a populated summary.
 */
export function mergeIntegrationDetail(
  base: IntegrationGalleryItem,
  detail: IntegrationDefinition | null | undefined
): IntegrationGalleryItem {
  if (!detail) return base;
  const baseConnection =
    base.primaryConnection ??
    base.connections.find((connection) => connection.status !== 'disconnected') ??
    null;
  const detailConnection =
    detail.connections.find((connection) => connection.status !== 'disconnected') ?? null;
  return {
    ...detail,
    ...base,
    scopes: detail.scopes.length > 0 ? detail.scopes : base.scopes,
    tools: detail.tools.length > 0 ? detail.tools : base.tools,
    capabilityGroups:
      detail.capabilityGroups.length > 0 ? detail.capabilityGroups : base.capabilityGroups,
    apiKeySchema: detail.apiKeySchema ?? base.apiKeySchema,
    docsUrl: detail.docsUrl ?? base.docsUrl,
    sources: base.sources,
    isMock: base.isMock,
    primaryConnection: baseConnection ?? detailConnection,
    connections: base.connections.length > 0 ? base.connections : detail.connections,
  } as IntegrationGalleryItem;
}

/**
 * Fetch the selected app's detail and hand back the merged display item.
 *
 * `selected` is the list's summary (or null when the drawer is closed);
 * `latest` re-reads it from the current gallery so connection state stays
 * fresh while the drawer is open.
 */
export function useProviderIntegrationDetail({
  selected,
  latest,
  detailsBySlug,
  fetchDetails,
}: {
  selected: IntegrationGalleryItem | null;
  latest?: IntegrationGalleryItem | null;
  detailsBySlug: Record<string, IntegrationDefinition>;
  fetchDetails: (item: IntegrationDefinition) => Promise<unknown>;
}): IntegrationGalleryItem | null {
  // Keyed on the slug, never on the item.
  //
  // A caller that derives `selected` from a list — the workflows connect
  // drawer finds it in a freshly-mapped gallery model on every render — hands
  // in a new object each time, so an effect keyed on identity refetches on
  // every render, and each fetch sets state that causes the next render. The
  // detail fetch pulls up to 500 tool rows, so the drawer sat in a loading
  // state issuing forty-second queries forever.
  const slug = selected && hasDeferredDetail(selected) ? selected.canonicalSlug : null;
  const selectedRef = React.useRef(selected);
  selectedRef.current = selected;
  const alreadyFetched = slug ? slug in detailsBySlug : true;
  React.useEffect(() => {
    if (!slug || alreadyFetched) return;
    const item = selectedRef.current;
    if (!item) return;
    void fetchDetails(item);
  }, [fetchDetails, slug, alreadyFetched]);

  return React.useMemo(() => {
    if (!selected) return null;
    const base = latest ?? selected;
    return mergeIntegrationDetail(base, detailsBySlug[selected.canonicalSlug]);
  }, [selected, latest, detailsBySlug]);
}
