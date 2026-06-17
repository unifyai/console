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

  it('fetches deferred details with tools from Builtins logs', async () => {
    vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
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
    expect(String(fetchSpy.mock.calls[0][0])).not.toContain('/api/integrations/provider/apps');
    expect(String(fetchSpy.mock.calls[0][0])).not.toContain('/api/integrations/catalog/apps');
  });
});
