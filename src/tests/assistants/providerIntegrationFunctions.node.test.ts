import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { fetchFunctionsTables } from '@/lib/client/brain';
import type { Assistant } from '@/types/assistants/assistant';

describe('provider integration Functions tab rows', () => {
  it('loads materialized integration primitives from FunctionManager rows', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/context/Assistants')) {
        return new Response(JSON.stringify(['user-1/123/Functions/Primitives']), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.startsWith('/api/logs')) {
        return new Response(
          JSON.stringify({
            logs: [
              {
                entries: {
                  name: 'primitives.integrations.discord.list_my_guilds',
                  language: 'python',
                  argspec: '() -> dict',
                  docstring: 'List Discord guilds for the authenticated user.',
                  integration_source: 'provider_backed',
                  app_slug: 'discord',
                  provider_tool_id: 'DISCORD_LIST_MY_GUILDS',
                  activation_state: 'connected_ready',
                  confirmation_required: true,
                  connection_id: 'conn-discord',
                },
              },
            ],
            count: 1,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ logs: [], count: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const assistant = {
      agentId: 123,
      userId: 'user-1',
      organizationId: null,
    } as unknown as Assistant;

    const data = await fetchFunctionsTables(assistant);

    expect(data.count).toBe(1);
    expect(data.rows[0]).toMatchObject({
      _table: 'Primitives',
      name: 'primitives.integrations.discord.list_my_guilds',
      appSlug: 'discord',
      providerToolId: 'DISCORD_LIST_MY_GUILDS',
      activationState: 'connected_ready',
      confirmationRequired: true,
      connectionId: 'conn-discord',
    });
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).startsWith('/api/integrations/provider/tools/search')
      )
    ).toBe(false);
  });

  it('does not call provider tool search because Functions rows are the source of truth', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/context/Assistants')) {
        return new Response(JSON.stringify(['user-1/123/Functions/Primitives']), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.startsWith('/api/logs')) {
        return new Response(
          JSON.stringify({
            logs: [
              {
                entries: {
                  name: 'primitives.integrations.salesforce.search_leads',
                  integration_source: 'provider_backed',
                  app_slug: 'salesforce',
                },
              },
            ],
            count: 1,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ logs: [], count: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const assistant = {
      agentId: 123,
      userId: 'user-1',
      organizationId: null,
    } as unknown as Assistant;

    const data = await fetchFunctionsTables(assistant, null);

    expect(data.rows).toHaveLength(1);
    expect(data.rows[0]).toMatchObject({
      _table: 'Primitives',
      appSlug: 'salesforce',
    });
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).startsWith('/api/integrations/provider/tools/search')
      )
    ).toBe(false);
  });

  it('keeps local integration primitive warmup active-only and backgrounded', () => {
    const seedScript = readFileSync(
      'src/tests/helpers/seeds/sync-integration-functions.ts',
      'utf8'
    );
    expect(seedScript).toContain("include_unconnected: 'false'");
    expect(seedScript).toContain("integration_source: 'provider_backed'");
    expect(seedScript).toContain('depends_on: []');
    expect(seedScript).not.toContain('primitives.integrations.execute_tool');

    const localScript = readFileSync('scripts/local.sh', 'utf8');
    const startupSection = localScript.slice(
      localScript.indexOf('start_console "$with_pubsub" "$with_chat"')
    );
    expect(startupSection).toContain('start_local_integration_functions_sync');
    expect(startupSection).toContain('active integration primitives warming in background');
  });
});
