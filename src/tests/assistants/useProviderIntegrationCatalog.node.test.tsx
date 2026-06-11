import { renderHook, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProviderIntegrationCatalog } from '@/hooks/Assistants/useProviderIntegrationCatalog';
import {
  listProviderIntegrationDefinitionsPage,
  listProviderIntegrationBackends,
  patchProviderIntegrationBackend,
  syncIntegrations,
  upsertProviderIntegrationBackend,
} from '@/lib/client/integrations';

function providerApp(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    backend_id: 'composio-dev',
    provider_app_id: slug,
    canonical_app_slug: slug,
    display_name: slug.replace(/_/g, ' '),
    auth_modes: ['oauth'],
    available_scopes: [],
    available_actions: [],
    connection_status: 'connected',
    ...overrides,
  };
}

describe('useProviderIntegrationCatalog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.history.replaceState({}, '', '/assistants');
  });

  it('uses mock data without calling Orchestra when mock mode is enabled', async () => {
    window.localStorage.setItem('console:integrations:mock', 'true');
    const fetchSpy = vi.spyOn(window, 'fetch');

    const { result } = renderHook(() => useProviderIntegrationCatalog('123'));

    await waitFor(() => expect(result.current.definitions.length).toBeGreaterThan(0));
    expect(result.current.isMock).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(
      result.current.definitions.some((definition) => definition.canonicalSlug === 'slack')
    ).toBe(true);
  });

  it('loads provider apps and connections through the Console proxy', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/integrations/provider/apps')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                backend_id: 'composio-dev',
                provider_app_id: 'slack',
                canonical_app_slug: 'slack',
                display_name: 'Slack',
                category: 'Communication',
                auth_modes: ['oauth'],
                available_scopes: [{ id: 'chat:write', label: 'Send messages' }],
                available_actions: ['send_message'],
                connection_status: 'connected',
              },
            ],
            total: 1,
            limit: 100,
            offset: 0,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.startsWith('/api/integrations/provider/connections')) {
        return new Response(
          JSON.stringify([
            {
              connection_id: 'conn-slack',
              canonical_app_slug: 'slack',
              backend_id: 'composio-dev',
              provider_app_id: 'slack',
              status: 'connected',
              external_account_label: 'Team Slack',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    });

    const { result } = renderHook(() => useProviderIntegrationCatalog('123'));

    await waitFor(() => expect(result.current.definitions).toHaveLength(1));
    expect(result.current.definitions[0]).toMatchObject({
      canonicalSlug: 'slack',
      displayName: 'Slack',
      status: 'connected',
    });
    expect(result.current.definitions[0].connections[0]).toMatchObject({
      id: 'conn-slack',
      accountLabel: 'Team Slack',
    });
    expect(result.current.hasLoaded).toBe(true);
    expect(
      fetchSpy.mock.calls.some(([input]) => String(input).includes('status_group=connected'))
    ).toBe(true);
    expect(
      fetchSpy.mock.calls.some(([input]) => String(input).includes('status_group=needs_attention'))
    ).toBe(true);
  });

  it('loads additional catalog pages with limit, offset, and total metadata', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/integrations/provider/apps')) {
        const params = new URL(url, window.location.origin).searchParams;
        const offset = Number(params.get('offset') ?? 0);
        const items =
          offset === 0
            ? Array.from({ length: 100 }, (_, index) => providerApp(`app_${index}`))
            : [providerApp('app_100')];
        return new Response(
          JSON.stringify({
            items,
            total: 101,
            limit: 100,
            offset,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.startsWith('/api/integrations/provider/connections')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });

    const { result } = renderHook(() => useProviderIntegrationCatalog('123'));

    await waitFor(() => expect(result.current.definitions).toHaveLength(100));
    expect(result.current.total).toBe(101);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });

    await waitFor(() => expect(result.current.definitions).toHaveLength(101));
    expect(result.current.hasMore).toBe(false);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/integrations/provider/apps?'),
      expect.objectContaining({ cache: 'no-store' })
    );
    expect(
      fetchSpy.mock.calls.some(
        ([input]) => String(input).includes('limit=100') && String(input).includes('offset=100')
      )
    ).toBe(true);
  });

  it('resets catalog pagination when server-side filters change', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/integrations/provider/apps')) {
        const params = new URL(url, window.location.origin).searchParams;
        const query = params.get('query');
        return new Response(
          JSON.stringify({
            items: [providerApp(query === 'slack' ? 'slack' : 'discord')],
            total: 1,
            limit: 100,
            offset: 0,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.startsWith('/api/integrations/provider/connections')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });

    const { result, rerender } = renderHook(
      ({ query, statusGroups }) =>
        useProviderIntegrationCatalog('123', {
          query,
          sourceType: 'third_party',
          statusGroups,
        }),
      { initialProps: { query: '', statusGroups: ['connected' as const] } }
    );

    await waitFor(() => expect(result.current.definitions[0].canonicalSlug).toBe('discord'));
    rerender({ query: 'slack', statusGroups: ['connected'] });
    await waitFor(() => expect(result.current.definitions[0].canonicalSlug).toBe('slack'));

    expect(
      fetchSpy.mock.calls.some(
        ([input]) =>
          String(input).includes('query=slack') &&
          String(input).includes('source_type=third_party') &&
          String(input).includes('status_group=connected') &&
          String(input).includes('offset=0')
      )
    ).toBe(true);
  });

  it('maps a paginated app response through the explicit client helper', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [providerApp('notion')],
          total: 40,
          limit: 20,
          offset: 20,
          facets: {
            total: 40,
            source_type: { native: 0, third_party: 40 },
            status: {
              connected: 4,
              configured: 2,
              pending: 0,
              missing_scope: 0,
              missing_secrets: 0,
              needs_reconnect: 0,
              expired: 0,
              revoked: 0,
              error: 0,
              not_connected: 34,
            },
            status_group: {
              connected: 6,
              needs_attention: 0,
              not_connected: 34,
            },
          },
          catalog_version: 'catalog-v1',
          generated_at: '2026-06-11T16:00:00Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const page = await listProviderIntegrationDefinitionsPage({
      ownerScope: 'assistant',
      assistantId: 123,
      query: 'notion',
      sourceType: 'third_party',
      statusGroups: ['connected'],
      detailLevel: 'summary',
      limit: 20,
      offset: 20,
    });

    expect(page).toMatchObject({
      total: 40,
      limit: 20,
      offset: 20,
      facets: {
        total: 40,
        statusGroup: {
          connected: 6,
          needsAttention: 0,
          notConnected: 34,
        },
      },
      catalogVersion: 'catalog-v1',
      generatedAt: '2026-06-11T16:00:00Z',
      definitions: [{ canonicalSlug: 'notion' }],
    });
    expect(String(fetchSpy.mock.calls[0][0])).toContain(
      '/api/integrations/provider/apps?owner_scope=assistant&limit=20&offset=20&detail_level=summary&assistant_id=123&query=notion&source_type=third_party&status_group=connected'
    );
  });

  it('maps Orchestra native apps without provider connect semantics', async () => {
    vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/integrations/provider/apps')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                backend_id: 'unity_native',
                provider_app_id: 'matterport',
                canonical_app_slug: 'matterport',
                display_name: 'Matterport',
                source_type: 'native',
                source_label: 'Native',
                auth_modes: ['native'],
                native_metadata: { tier: 'api', function_names: ['matterport_sync'] },
              },
            ],
            total: 1,
            limit: 100,
            offset: 0,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.startsWith('/api/integrations/provider/connections')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });

    const { result } = renderHook(() => useProviderIntegrationCatalog('123'));

    await waitFor(() => expect(result.current.definitions).toHaveLength(1));
    expect(result.current.definitions[0]).toMatchObject({
      canonicalSlug: 'matterport',
      source: 'static_package',
      sourceMetadata: {
        sourceType: 'native',
        nativeMetadata: { tier: 'api', functionNames: ['matterport_sync'] },
      },
    });

    await act(async () => {
      await result.current.startConnect(result.current.definitions[0]);
    });

    expect(window.fetch).not.toHaveBeenCalledWith(
      '/api/integrations/provider/connect/start',
      expect.anything()
    );
  });

  it('uses local details for built-in apps without provider detail calls', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/integrations/provider/apps')) {
        return new Response(JSON.stringify({ items: [], total: 0, limit: 100, offset: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.startsWith('/api/integrations/provider/connections')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });

    const { result } = renderHook(() => useProviderIntegrationCatalog('123'));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    const builtInDefinition = {
      id: 'salto_ks',
      canonicalSlug: 'salto_ks',
      displayName: 'Salto KS',
      description: 'Native access control connector.',
      category: 'Access control',
      iconUrl: null,
      status: 'not_connected' as const,
      authModes: ['api_key' as const],
      source: 'static_package' as const,
      sourceMetadata: {
        source: 'static_package' as const,
        label: 'Native connector',
      },
      scopes: [],
      capabilityGroups: [],
      tools: [],
      connections: [],
      isMock: false,
    };

    await act(async () => {
      await result.current.fetchDetails(builtInDefinition);
    });

    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/integrations/provider/apps/salto_ks'),
      expect.anything()
    );
    expect(result.current.detailsBySlug.salto_ks).toMatchObject({
      canonicalSlug: 'salto_ks',
      displayName: 'Salto KS',
    });
  });

  it('starts API-key connections with a snake_case Orchestra payload', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.startsWith('/api/integrations/provider/apps')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                backend_id: 'composio-dev',
                provider_app_id: 'clay',
                canonical_app_slug: 'clay',
                display_name: 'Clay',
                auth_modes: ['api_key'],
                available_scopes: [],
                available_actions: [],
                connection_status: 'not_connected',
              },
            ],
            total: 1,
            limit: 100,
            offset: 0,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.startsWith('/api/integrations/provider/connections')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url === '/api/integrations/provider/connect/start') {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          owner_scope: 'assistant',
          assistant_id: 123,
          canonical_app_slug: 'clay',
          backend_id: 'composio-dev',
          auth_mode: 'api_key',
          api_key_fields: { CLAY_API_KEY: 'secret' },
        });
        return new Response(
          JSON.stringify({
            connection: {
              connection_id: 'conn-clay',
              status: 'pending',
              canonical_app_slug: 'clay',
              backend_id: 'composio-dev',
              provider_app_id: 'clay',
            },
            auth_mode: 'api_key',
            requires_browser_redirect: false,
            requested_scopes: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    });

    const { result } = renderHook(() => useProviderIntegrationCatalog('123'));
    await waitFor(() => expect(result.current.definitions).toHaveLength(1));

    await act(async () => {
      await result.current.startConnect(result.current.definitions[0], { CLAY_API_KEY: 'secret' });
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/integrations/provider/connect/start',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('requests Unity sync after API-key connect returns connected', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.startsWith('/api/integrations/provider/apps')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                backend_id: 'composio-dev',
                provider_app_id: 'clay',
                canonical_app_slug: 'clay',
                display_name: 'Clay',
                auth_modes: ['api_key'],
                available_scopes: [],
                available_actions: [],
                connection_status: 'not_connected',
              },
            ],
            total: 1,
            limit: 100,
            offset: 0,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.startsWith('/api/integrations/provider/connections')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url === '/api/integrations/provider/connect/start') {
        return new Response(
          JSON.stringify({
            connection: {
              connection_id: 'conn-clay',
              status: 'connected',
              canonical_app_slug: 'clay',
              backend_id: 'composio-dev',
              provider_app_id: 'clay',
            },
            auth_mode: 'api_key',
            requires_browser_redirect: false,
            requested_scopes: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url === '/api/assistant/123/system-event') {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          eventType: 'integration_tools_sync_requested',
          extraEventFields: {
            appSlug: 'clay',
            connectionId: 'conn-clay',
            backendId: 'composio-dev',
            operation: 'materialize',
          },
        });
        return new Response(JSON.stringify({ ok: true }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });

    const { result } = renderHook(() => useProviderIntegrationCatalog('123'));
    await waitFor(() => expect(result.current.definitions).toHaveLength(1));

    await act(async () => {
      await result.current.startConnect(result.current.definitions[0], { CLAY_API_KEY: 'secret' });
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/assistant/123/system-event',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('keeps setup helpers transport-only through the Console admin proxy', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await upsertProviderIntegrationBackend({
      backendId: 'pipedream',
      kind: 'pipedream',
      environment: 'prod',
      displayName: 'Pipedream',
      status: 'enabled',
      configJson: { timeoutSeconds: 30, maxPages: 100 },
    });
    await listProviderIntegrationBackends();
    await patchProviderIntegrationBackend('pipedream', { status: 'enabled' });
    await syncIntegrations({
      backendId: 'pipedream',
      sourceType: 'third_party',
      apps: [{ providerAppId: 'linear', displayName: 'Linear' }],
      tools: [],
    });
    await syncIntegrations({
      backendId: 'composio',
      appSlugs: ['DISCORD', 'GOOGLEDRIVE'],
      toolLimitPerApp: 10,
      createAuthConfigs: true,
    });
    await syncIntegrations({
      backendId: 'pipedream',
      appSlugs: ['slack'],
      componentLimitPerApp: 10,
      includeAllApps: false,
    });

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      '/api/integrations/provider-admin/backends',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"backend_id":"pipedream"'),
      })
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      '/api/integrations/provider-admin/backends',
      expect.objectContaining({
        cache: 'no-store',
      })
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      3,
      '/api/integrations/provider-admin/backends/pipedream',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('"status":"enabled"'),
      })
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      4,
      '/api/integrations/provider-admin/sync',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"provider_app_id":"linear"'),
      })
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      5,
      '/api/integrations/provider-admin/sync',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"backend_id":"composio"'),
      })
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      5,
      '/api/integrations/provider-admin/sync',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"app_slugs":["DISCORD","GOOGLEDRIVE"]'),
      })
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      6,
      '/api/integrations/provider-admin/sync',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"component_limit_per_app":10'),
      })
    );
  });
});
