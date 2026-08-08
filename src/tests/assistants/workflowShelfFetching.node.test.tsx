import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRequirementDefinitions } from '@/hooks/Workflows/useRequirementDefinitions';
import { useProviderIntegrationDetail } from '@/hooks/Integrations/useProviderIntegrationDetail';
import type { IntegrationDefinition, IntegrationGalleryItem } from '@/types/integrations';

/**
 * What the workflows shelf is allowed to ask for.
 *
 * The shelf needs a logo, a name, the auth modes and the connection status
 * for each app its bundles require. It was getting them from the per-app
 * *detail* endpoint, once per slug — and that endpoint also pulls up to 500
 * tool rows per app. Eight requirements meant eight tool queries, the
 * slowest measured at forty seconds, for data no workflow surface renders.
 *
 * These pin the shape of the request rather than its speed: a count and an
 * absence, both of which a profiler cannot regress quietly.
 */
const client = vi.hoisted(() => ({
  listProviderIntegrationDefinitionsBySlugs: vi.fn(),
  getProviderIntegrationDetails: vi.fn(),
}));
vi.mock('@/lib/client/integrations', () => client);

function definition(slug: string): IntegrationDefinition {
  return {
    id: slug,
    canonicalSlug: slug,
    displayName: slug,
    description: null,
    category: 'Productivity',
    iconUrl: `https://cdn.example/${slug}.svg`,
    authModes: ['oauth'],
    source: 'provider_backed',
    sourceMetadata: { source: 'provider_backed', label: 'Managed app', backendId: 'composio' },
    scopes: [],
    capabilityGroups: [],
    tools: [],
    connections: [],
    status: 'not_connected',
  } as unknown as IntegrationDefinition;
}

describe('useRequirementDefinitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.listProviderIntegrationDefinitionsBySlugs.mockResolvedValue([
      definition('gmail'),
      definition('slack'),
      definition('hubspot'),
    ]);
  });

  it('asks once for every slug, and never asks for tools', async () => {
    const { result } = renderHook(() =>
      useRequirementDefinitions({
        assistantId: '123',
        slugs: ['gmail', 'slack', 'hubspot'],
        knownSlugs: new Set<string>(),
      })
    );

    await waitFor(() => expect(result.current.isResolving).toBe(false));

    // One request for three apps — not one per app.
    expect(client.listProviderIntegrationDefinitionsBySlugs).toHaveBeenCalledTimes(1);
    expect(client.listProviderIntegrationDefinitionsBySlugs).toHaveBeenCalledWith(
      expect.objectContaining({ slugs: ['gmail', 'slack', 'hubspot'] })
    );
    // The detail endpoint is the one that fetches tools. The shelf must not
    // reach it at all.
    expect(client.getProviderIntegrationDetails).not.toHaveBeenCalled();
  });

  it('records a slug the gallery does not know, rather than asking again', async () => {
    client.listProviderIntegrationDefinitionsBySlugs.mockResolvedValue([definition('gmail')]);

    const { result, rerender } = renderHook(() =>
      useRequirementDefinitions({
        assistantId: '123',
        slugs: ['gmail', 'nonesuch'],
        knownSlugs: new Set<string>(),
      })
    );

    await waitFor(() => expect(result.current.isResolving).toBe(false));
    expect(result.current.bySlug.nonesuch).toBeNull();

    rerender();
    rerender();
    expect(client.listProviderIntegrationDefinitionsBySlugs).toHaveBeenCalledTimes(1);
  });

  it('holds `isResolving` until every slug has an answer either way', async () => {
    let release: (value: IntegrationDefinition[]) => void = () => {};
    client.listProviderIntegrationDefinitionsBySlugs.mockReturnValue(
      new Promise<IntegrationDefinition[]>((resolve) => {
        release = resolve;
      })
    );

    const { result } = renderHook(() =>
      useRequirementDefinitions({
        assistantId: '123',
        slugs: ['gmail'],
        knownSlugs: new Set<string>(),
      })
    );

    expect(result.current.isResolving).toBe(true);
    release([definition('gmail')]);
    await waitFor(() => expect(result.current.isResolving).toBe(false));
  });
});

/**
 * The drawer's detail fetch, and the loop it used to spin.
 *
 * The workflows connect drawer derives its item from a gallery model that
 * re-maps on every render, so the item is a new object each time. An effect
 * keyed on that identity refetched on every render, and each fetch set state
 * that caused the next one — the drawer sat loading forever, reissuing a
 * forty-second tools query.
 */
describe('useProviderIntegrationDetail', () => {
  function galleryItem(slug: string): IntegrationGalleryItem {
    return { ...definition(slug), sources: [], isMock: false } as unknown as IntegrationGalleryItem;
  }

  it('fetches once for a slug even when the item is rebuilt every render', async () => {
    const fetchDetails = vi.fn().mockResolvedValue(null);
    const { rerender } = renderHook(
      ({ nonce }: { nonce: number }) =>
        useProviderIntegrationDetail({
          // A new object every render, exactly as the caller produces it.
          selected: { ...galleryItem('gmail'), nonce } as unknown as IntegrationGalleryItem,
          detailsBySlug: {},
          fetchDetails,
        }),
      { initialProps: { nonce: 0 } }
    );

    rerender({ nonce: 1 });
    rerender({ nonce: 2 });
    rerender({ nonce: 3 });

    await waitFor(() => expect(fetchDetails).toHaveBeenCalledTimes(1));
  });

  it('does not refetch a detail it already holds', async () => {
    const fetchDetails = vi.fn().mockResolvedValue(null);
    renderHook(() =>
      useProviderIntegrationDetail({
        selected: galleryItem('gmail'),
        detailsBySlug: { gmail: definition('gmail') },
        fetchDetails,
      })
    );

    await waitFor(() => expect(fetchDetails).not.toHaveBeenCalled());
  });
});
