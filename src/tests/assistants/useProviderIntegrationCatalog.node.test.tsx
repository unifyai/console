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

  it('excludes workspace-trigger-facade connections from a facade-only app', async () => {
    vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/logs?')) {
        return builtinsLogsResponse([providerApp('google_meet', { display_name: 'Google Meet' })]);
      }
      if (url.startsWith('/api/integrations/provider/connections')) {
        return new Response(
          JSON.stringify([
            {
              connection_id: 'ic_ws_native_google_google_meet_2693',
              canonical_app_slug: 'google_meet',
              backend_id: 'native_google',
              provider_app_id: 'google_meet',
              status: 'connected',
              credential_storage: 'assistant_workspace_secrets',
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
      canonicalSlug: 'google_meet',
      status: 'not_connected',
    });
    expect(result.current.definitions[0].connections).toHaveLength(0);
  });

  it('keeps only the real connection when an app has both a facade and a real account', async () => {
    vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/logs?')) {
        return builtinsLogsResponse([providerApp('google_meet', { display_name: 'Google Meet' })]);
      }
      if (url.startsWith('/api/integrations/provider/connections')) {
        return new Response(
          JSON.stringify([
            {
              connection_id: 'ic_ws_native_google_google_meet_2693',
              canonical_app_slug: 'google_meet',
              backend_id: 'native_google',
              provider_app_id: 'google_meet',
              status: 'connected',
              credential_storage: 'assistant_workspace_secrets',
            },
            {
              connection_id: 'conn-composio-meet',
              canonical_app_slug: 'google_meet',
              backend_id: 'composio-dev',
              provider_app_id: 'google_meet',
              status: 'connected',
              external_account_label: 'Composio Meet',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    });

    const { result } = renderHook(() => useProviderIntegrationCatalog('123'));

    await waitFor(() => expect(result.current.definitions).toHaveLength(1));
    expect(result.current.definitions[0].status).toBe('connected');
    expect(result.current.definitions[0].connections).toHaveLength(1);
    expect(result.current.definitions[0].connections[0]).toMatchObject({
      id: 'conn-composio-meet',
      accountLabel: 'Composio Meet',
    });
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

  it('ORs pipe-separated provider catalog search terms across searchable fields', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/logs?')) {
        return builtinsLogsResponse([]);
      }
      if (url.startsWith('/api/integrations/provider/connections')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });

    await listProviderIntegrationDefinitionsPage({
      ownerScope: 'assistant',
      assistantId: 123,
      query: 'github|linear|jira|hr|ops',
    });

    const logsCall = fetchSpy.mock.calls.find(([input]) => String(input).startsWith('/api/logs?'));
    expect(logsCall).toBeDefined();
    const params = new URL(String(logsCall?.[0]), window.location.origin).searchParams;
    const filter = params.get('filter') ?? '';
    expect(filter).toContain('display_name.lower().contains("github")');
    expect(filter).toContain('canonical_app_slug.lower().contains("linear")');
    expect(filter).toContain('description.lower().contains("jira")');
    expect(filter).toContain('display_name.lower().contains("hr")');
    expect(filter).toContain('canonical_app_slug.lower().contains("ops")');
    expect(filter).toContain(' or ');
    expect(filter).not.toContain('github|linear|jira|hr|ops');
  });

  it('keeps plain provider catalog searches phrase-based', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/logs?')) {
        return builtinsLogsResponse([]);
      }
      if (url.startsWith('/api/integrations/provider/connections')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });

    await listProviderIntegrationDefinitionsPage({
      ownerScope: 'assistant',
      assistantId: 123,
      query: 'github linear jira hr ops',
    });

    const logsCall = fetchSpy.mock.calls.find(([input]) => String(input).startsWith('/api/logs?'));
    expect(logsCall).toBeDefined();
    const params = new URL(String(logsCall?.[0]), window.location.origin).searchParams;
    const filter = params.get('filter') ?? '';
    expect(filter).toContain('display_name.lower().contains("github linear jira hr ops")');
    expect(filter).not.toContain('display_name.lower().contains("github")');
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

  it('filters search via contains and uses the inline list count (no metric call)', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/logs?')) {
        return builtinsLogsResponse([providerApp('gmail', { display_name: 'Gmail' })], 1);
      }
      if (url.startsWith('/api/integrations/provider/connections')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });

    const { result } = renderHook(() => useProviderIntegrationCatalog('123', { query: 'gmail' }));

    await waitFor(() => expect(result.current.definitions).toHaveLength(1));
    expect(result.current.total).toBe(1);
    expect(result.current.hasMore).toBe(false);

    const countCalls = fetchSpy.mock.calls.filter(([input]) =>
      String(input).startsWith('/api/logs/count')
    );
    expect(countCalls).toHaveLength(0);

    const listCall = fetchSpy.mock.calls.find(([input]) => String(input).startsWith('/api/logs?'));
    const filter = new URL(String(listCall?.[0]), window.location.origin).searchParams.get(
      'filter'
    );
    expect(filter).toContain('display_name.lower().contains("gmail")');
    expect(filter).toContain('canonical_app_slug.lower().contains("gmail")');
    expect(filter).toContain('description.lower().contains("gmail")');
    expect(filter).not.toContain('category.lower()');
    expect(filter).not.toContain('source_label.lower()');
  });

  it('pins connected apps under the All filter even when off the browse page', async () => {
    vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/logs/count')) {
        return new Response(JSON.stringify({ canonical_app_slug: 250 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.startsWith('/api/logs?')) {
        const params = new URL(url, window.location.origin).searchParams;
        // The pinned connected/needs-attention fetch carries a status filter;
        // the unfiltered browse page does not include the connected app.
        if (params.get('filter')) {
          return builtinsLogsResponse([providerApp('gmail', { display_name: 'Gmail' })], 1);
        }
        return builtinsLogsResponse(
          Array.from({ length: 3 }, (_, index) => providerApp(`app_${index}`)),
          3
        );
      }
      if (url.startsWith('/api/integrations/provider/connections')) {
        return new Response(
          JSON.stringify([
            {
              id: 'conn-gmail',
              connection_id: 'conn-gmail',
              canonical_app_slug: 'gmail',
              status: 'connected',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    });

    const { result } = renderHook(() => useProviderIntegrationCatalog('123'));

    await waitFor(() =>
      expect(result.current.definitions.some((d) => d.canonicalSlug === 'gmail')).toBe(true)
    );
    expect(result.current.definitions.find((d) => d.canonicalSlug === 'gmail')?.status).toBe(
      'connected'
    );
    expect(result.current.definitions.some((d) => d.canonicalSlug === 'app_0')).toBe(true);
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
      expect(params.get('filter')).toBe('metadata["integration"]["app_slug"] == "slack"');
      expect(params.get('filter')).not.toBe('app_slug == "slack"');
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
      'filter=source_type+%3D%3D+%22third_party%22'
    );
    const params = new URL(String(fetchSpy.mock.calls[0][0]), window.location.origin).searchParams;
    expect(params.get('fromFields')).toContain('canonical_app_slug');
    expect(params.get('fromFields')).toContain('display_name');
    expect(params.get('fromFields')).not.toContain('embedding');
    expect(String(fetchSpy.mock.calls[0][0])).not.toContain('/api/integrations/provider/apps');
    expect(String(fetchSpy.mock.calls[0][0])).not.toContain('/api/integrations/catalog/apps');
  });

  it('maps labels metadata into definitions, facets, and category filters', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/logs?')) {
        return builtinsLogsResponse(
          [
            providerApp('hubspot', {
              display_name: 'HubSpot',
              category: 'CRM',
              labels: {
                primary_category: { key: 'crm', label: 'CRM' },
                categories: [
                  { key: 'crm', label: 'CRM' },
                  { key: 'sales', label: 'Sales' },
                ],
                tags: [
                  { key: 'crm', label: 'CRM' },
                  { key: 'sales', label: 'Sales' },
                ],
              },
            }),
            providerApp('zendesk', {
              display_name: 'Zendesk',
              category: 'Support',
              labels: {
                primary_category: { key: 'crm', label: 'CRM' },
                categories: [{ key: 'crm', label: 'CRM' }],
                tags: [{ key: 'crm', label: 'CRM' }],
              },
            }),
          ],
          2
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

    const page = await listProviderIntegrationDefinitionsPage({
      ownerScope: 'assistant',
      assistantId: 123,
      category: 'crm',
    });

    expect(page.definitions[0].labels).toEqual({
      primaryCategory: { key: 'crm', label: 'CRM' },
      categories: [
        { key: 'crm', label: 'CRM' },
        { key: 'sales', label: 'Sales' },
      ],
      tags: [
        { key: 'crm', label: 'CRM' },
        { key: 'sales', label: 'Sales' },
      ],
    });
    expect(page.facets?.categories).toEqual([
      { value: 'crm', label: 'CRM', count: 2 },
      { value: 'sales', label: 'Sales', count: 1 },
    ]);

    const params = new URL(String(fetchSpy.mock.calls[0][0]), window.location.origin).searchParams;
    expect(params.get('fromFields')).toContain('labels');
    expect(params.get('filter')).toContain('category.lower() == "crm"');
    expect(params.get('filter')).toContain('labels["categories"]');
    expect(params.get('filter')).toContain('label["key"] == "crm"');
  });
});

/**
 * Resolving named apps, and knowing when the answer is in.
 *
 * A caller with a list of slugs — a workflow's requirements — used the
 * browse `query`, which is a substring match over display name, slug and
 * description returned one page at a time. The app asked for could be
 * crowded off that page by anything else mentioning the same word, and an
 * absent row is indistinguishable from an unpublished app.
 */
describe('useProviderIntegrationCatalog — resolving apps by slug', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.history.replaceState({}, '', '/assistants');
  });

  it('asks for exactly those slugs, and never browses', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input), window.location.origin);
      if (url.pathname.endsWith('/api/logs')) {
        return builtinsLogsResponse([providerApp('slack'), providerApp('gmail')]);
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });

    const { result } = renderHook(() =>
      useProviderIntegrationCatalog('123', { slugs: ['slack', 'gmail'] })
    );

    await waitFor(() => expect(result.current.hasLoadedRequest).toBe(true));
    expect(result.current.definitions.map((item) => item.canonicalSlug).sort()).toEqual([
      'gmail',
      'slack',
    ]);

    const logsCalls = fetchSpy.mock.calls
      .map((call) => new URL(String(call[0]), window.location.origin))
      .filter((url) => url.pathname.endsWith('/api/logs'));
    expect(logsCalls.length).toBeGreaterThan(0);
    for (const url of logsCalls) {
      const filter = url.searchParams.get('filter') ?? '';
      expect(filter).toContain('canonical_app_slug in');
      expect(filter).not.toContain('contains');
    }
  });

  it('reports the rows on hand as stale until this request answers', async () => {
    let release: (() => void) | null = null;
    vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input), window.location.origin);
      if (url.pathname.endsWith('/api/logs')) {
        const filter = url.searchParams.get('filter') ?? '';
        if (filter.includes('gmail')) {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          return builtinsLogsResponse([providerApp('gmail')]);
        }
        return builtinsLogsResponse([providerApp('slack')]);
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });

    const { result, rerender } = renderHook(
      ({ slugs }: { slugs: string[] }) => useProviderIntegrationCatalog('123', { slugs }),
      { initialProps: { slugs: ['slack'] } }
    );

    await waitFor(() => expect(result.current.hasLoadedRequest).toBe(true));

    rerender({ slugs: ['gmail'] });

    // `hasLoaded` is still true — it never goes back — but the rows on hand
    // are Slack's. Only `hasLoadedRequest` distinguishes them, and reading
    // the wrong one is what declared a present app missing.
    await waitFor(() => expect(result.current.hasLoadedRequest).toBe(false));
    expect(result.current.hasLoaded).toBe(true);

    await act(async () => {
      release?.();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.hasLoadedRequest).toBe(true));
    expect(result.current.definitions.map((item) => item.canonicalSlug)).toEqual(['gmail']);
  });
});

/**
 * Both surfaces hand the drawer the same connection rows.
 *
 * The app row carries a flattened *summary* of one connection. Rebuilding a
 * synthetic row from it drops eleven of the eighteen fields a real row has,
 * and every account after the first — so the by-slug path showed one
 * account where the gallery showed several, and the drawer's per-connection
 * affordances ("Authorization in progress", Cancel setup, Disconnect) read
 * off data that was not the same on the two surfaces.
 */
describe('useProviderIntegrationCatalog — connection rows reach the drawer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.history.replaceState({}, '', '/assistants');
  });

  function pendingGmailConnections() {
    return [
      {
        connection_id: 'ic_pending',
        canonical_app_slug: 'gmail',
        status: 'pending',
        external_account_label: 'work@example.com',
        provider_connection_id: 'ca_upstream',
        owner_scope: 'assistant',
      },
      {
        connection_id: 'ic_second',
        canonical_app_slug: 'gmail',
        status: 'connected',
        external_account_label: 'personal@example.com',
        provider_connection_id: 'ca_second',
        owner_scope: 'assistant',
      },
    ];
  }

  it('carries every account, with the fields the drawer acts on', async () => {
    vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input), window.location.origin);
      if (url.pathname.endsWith('/api/logs')) {
        return builtinsLogsResponse([providerApp('gmail')]);
      }
      return new Response(JSON.stringify(pendingGmailConnections()), { status: 200 });
    });

    const { result } = renderHook(() => useProviderIntegrationCatalog('123', { slugs: ['gmail'] }));

    await waitFor(() => expect(result.current.hasLoadedRequest).toBe(true));
    const gmail = result.current.definitions.find((item) => item.canonicalSlug === 'gmail');

    // Both accounts, not just the one flattened onto the app row.
    expect(gmail?.connections).toHaveLength(2);

    // A pending row is what renders "Authorization in progress" and the
    // Cancel setup button; losing its status loses both.
    const pending = gmail?.connections.find((connection) => connection.status === 'pending');
    expect(pending).toBeTruthy();
    expect(pending?.accountLabel).toBe('work@example.com');
    expect(pending?.sourceMetadata?.providerConnectionId).toBe('ca_upstream');
  });
});
