import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProviderIntegrationCatalog } from '@/hooks/Assistants/useProviderIntegrationCatalog';
import { listProviderIntegrationDefinitionsPage } from '@/lib/client/integrations';
import type { IntegrationDefinition } from '@/types/integrations';

function providerApp(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    backend_id: 'composio-dev',
    provider_app_id: slug,
    canonical_app_slug: slug,
    display_name: slug.replace(/_/g, ' '),
    source_type: 'third_party',
    auth_modes: ['oauth'],
    available_scopes: [],
    available_actions: [],
    ...overrides,
  };
}

function builtinsLogsResponse(items: Array<Record<string, unknown>>, count = items.length) {
  return new Response(
    JSON.stringify({
      logs: items.map((entries) => ({ entries })),
      count,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
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

  it('loads provider apps from Builtins logs and overlays live connections', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/logs?')) {
        return builtinsLogsResponse([
          providerApp('slack', {
            display_name: 'Slack',
            category: 'Communication',
            available_scopes: [{ id: 'chat:write', label: 'Send messages' }],
            available_actions: ['send_message'],
          }),
        ]);
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
    expect(
      fetchSpy.mock.calls.some(
        ([input]) =>
          String(input).startsWith('/api/logs?') &&
          String(input).includes('context=Integrations%2FApps')
      )
    ).toBe(true);
    expect(
      fetchSpy.mock.calls.some(([input]) =>
        String(input).startsWith('/api/integrations/provider/apps')
      )
    ).toBe(false);
  });

  it('loads additional Builtins catalog pages with limit and offset', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/logs?')) {
        const params = new URL(url, window.location.origin).searchParams;
        const offset = Number(params.get('offset') ?? 0);
        const items =
          offset === 0
            ? Array.from({ length: 100 }, (_, index) => providerApp(`app_${index}`))
            : [providerApp('app_100')];
        return builtinsLogsResponse(items, 101);
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
    expect(
      fetchSpy.mock.calls.some(
        ([input]) =>
          String(input).startsWith('/api/logs?') &&
          String(input).includes('context=Integrations%2FApps') &&
          String(input).includes('limit=100') &&
          String(input).includes('offset=100')
      )
    ).toBe(true);
  });

  it('maps available scope name fields to scope ids instead of scope-N placeholders', async () => {
    vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/logs?')) {
        return builtinsLogsResponse([
          providerApp('apaleo', {
            display_name: 'Apaleo',
            auth_modes: ['oauth'],
            available_scopes: [{ name: 'offline_access' }, { name: 'account.manage' }],
          }),
        ]);
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
    expect(result.current.definitions[0].scopes.map((scope) => scope.id)).toEqual([
      'offline_access',
      'account.manage',
    ]);
    expect(result.current.definitions[0].scopes.map((scope) => scope.label)).toEqual([
      'offline_access',
      'account.manage',
    ]);
  });

  it('normalizes a JSON-schema api key schema into renderable fields', async () => {
    vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/logs?')) {
        return builtinsLogsResponse([
          providerApp('anthropic_administrator', {
            display_name: 'Anthropic Administrator',
            auth_modes: ['api_key'],
            available_scopes: [],
            api_key_schema: {
              type: 'object',
              required: ['generic_api_key'],
              properties: {
                generic_api_key: {
                  type: 'string',
                  title: 'Admin API Key',
                  secret: true,
                  description:
                    "The Admin API key used for authentication, starting with 'sk-ant-admin...'.",
                },
              },
            },
          }),
        ]);
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
    const schema = result.current.definitions[0].apiKeySchema;
    expect(schema).not.toBeNull();
    expect(schema?.fields).toHaveLength(1);
    expect(schema?.fields[0]).toMatchObject({
      id: 'genericApiKey',
      label: 'Admin API Key',
      required: true,
      sensitive: true,
    });
    expect(schema?.submitLabel).toBe('Save credentials');
  });

  it('uses the count metric endpoint for the catalog total', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/logs/count')) {
        return new Response(JSON.stringify({ canonical_app_slug: 247 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.startsWith('/api/logs?')) {
        return builtinsLogsResponse(
          Array.from({ length: 100 }, (_, index) => providerApp(`app_${index}`)),
          100
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
    expect(result.current.total).toBe(247);
    expect(result.current.hasMore).toBe(true);
    const countCalls = fetchSpy.mock.calls.filter(([input]) =>
      String(input).startsWith('/api/logs/count')
    );
    expect(countCalls).toHaveLength(1);
    expect(String(countCalls[0][0])).toContain('context=Integrations%2FApps');
    expect(String(countCalls[0][0])).toContain('key=');
  });

  it('fetches deferred details with tools from Builtins logs', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/logs?')) {
        const params = new URL(url, window.location.origin).searchParams;
        if (params.get('context') === 'Integrations/Tools') {
          return builtinsLogsResponse([
            {
              function_id: 'fn-slack-send-message',
              name: 'primitives.integrations.slack.send_message',
              metadata: {
                source: 'provider_backed',
                integration: {
                  app_slug: 'slack',
                  tool_id: 'composio:slack:send_message',
                  tool_display_name: 'Send message',
                  action_class: 'write',
                  behavior_hints: ['mutates_state'],
                  confirmation_required: true,
                  required_scopes: [{ id: 'chat:write', label: 'Send messages' }],
                },
              },
            },
          ]);
        }
        return builtinsLogsResponse([
          providerApp('slack', {
            display_name: 'Slack',
            available_scopes: [{ id: 'chat:write', label: 'Send messages' }],
            tools: [
              {
                id: 'composio:slack:send_message',
                name: 'primitives.integrations.slack.send_message',
                display_name: 'Send message',
                action_class: 'write',
                behavior_hints: ['mutates_state'],
                confirmation_required: true,
                required_scopes: [{ id: 'chat:write', label: 'Send messages' }],
              },
            ],
          }),
        ]);
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
    let detail: IntegrationDefinition | null = null;
    await act(async () => {
      detail = await result.current.fetchDetails(result.current.definitions[0]);
    });

    expect(detail).not.toBeNull();
    const resolvedDetail = detail as unknown as IntegrationDefinition;
    expect(resolvedDetail.canonicalSlug).toBe('slack');
    expect(resolvedDetail.scopes).toEqual([
      {
        id: 'chat:write',
        label: 'Send messages',
        description: null,
        required: undefined,
      },
    ]);
    expect(resolvedDetail.tools).toHaveLength(1);
    expect(resolvedDetail.tools[0]).toMatchObject({
      displayName: 'Send message',
      actionClass: 'write',
      confirmationRequired: true,
    });
    const toolsRequests = fetchSpy.mock.calls
      .map(([input]) => String(input))
      .filter((url) => {
        if (!url.startsWith('/api/logs?')) return false;
        return (
          new URL(url, window.location.origin).searchParams.get('context') === 'Integrations/Tools'
        );
      });
    expect(toolsRequests.length).toBeGreaterThan(0);
    for (const url of toolsRequests) {
      const params = new URL(url, window.location.origin).searchParams;
      expect(params.get('filterExpr')).toBe('metadata["integration"]["app_slug"] == "slack"');
      expect(params.get('filterExpr')).not.toBe('app_slug == "slack"');
      expect(params.get('fromFields')).toContain('metadata');
      expect(params.get('fromFields')).not.toContain('embedding');
    }
  });

  it('keeps configured apps in the connected status group', async () => {
    vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/logs?')) {
        return builtinsLogsResponse([
          providerApp('hubspot', {
            display_name: 'HubSpot',
            connection_status: 'configured',
          }),
        ]);
      }
      if (url.startsWith('/api/integrations/provider/connections')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });

    const { result } = renderHook(() =>
      useProviderIntegrationCatalog('123', { statusGroups: ['connected'] })
    );

    await waitFor(() => expect(result.current.definitions).toHaveLength(1));
    expect(result.current.definitions[0]).toMatchObject({
      canonicalSlug: 'hubspot',
      status: 'configured',
    });
  });
});

describe('listProviderIntegrationDefinitionsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches Builtins app rows through the logging API', async () => {
    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockResolvedValue(builtinsLogsResponse([providerApp('notion')], 1));

    const page = await listProviderIntegrationDefinitionsPage({
      ownerScope: 'assistant',
      assistantId: 123,
      sourceType: 'third_party',
      limit: 20,
      offset: 20,
    });

    expect(page.definitions[0].canonicalSlug).toBe('notion');
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/api/logs?');
    expect(String(fetchSpy.mock.calls[0][0])).toContain('context=Integrations%2FApps');
    expect(String(fetchSpy.mock.calls[0][0])).toContain('limit=20');
    expect(String(fetchSpy.mock.calls[0][0])).toContain('offset=20');
    expect(String(fetchSpy.mock.calls[0][0])).toContain(
      'filterExpr=source_type+%3D%3D+%22third_party%22'
    );
    const params = new URL(String(fetchSpy.mock.calls[0][0]), window.location.origin).searchParams;
    expect(params.get('fromFields')).toContain('canonical_app_slug');
    expect(params.get('fromFields')).toContain('display_name');
    expect(params.get('fromFields')).not.toContain('embedding');
    expect(String(fetchSpy.mock.calls[0][0])).not.toContain('/api/integrations/provider/apps');
    expect(String(fetchSpy.mock.calls[0][0])).not.toContain('/api/integrations/catalog/apps');
  });
});
