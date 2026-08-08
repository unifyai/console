import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { submitWorkflowRequest } from '@/lib/client/workflows';
import type { Assistant } from '@/types/assistants/assistant';

/**
 * The bytes `submitWorkflowRequest` actually puts on the wire.
 *
 * Every other test of this path mocks the function itself, which is why a
 * wrong body shipped: it sent `project` where the route needs `projectName`
 * (the Orchestra client camelizes the body, so only `projectName` becomes
 * `project_name`) and a bare object where `/v0/logs` takes a list of rows.
 * Orchestra answered `422 project_name: Field required` and every install
 * on staging failed while the shelf animated its way to a green tick.
 *
 * So this asserts the request, not the caller.
 */
const assistant = { agentId: 42, userId: 'user-1' } as unknown as Assistant;

function jsonOk(body: unknown = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('submitWorkflowRequest — the request itself', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'req-fixed' } as Crypto);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes the row with the field names the logs route requires', async () => {
    fetchMock.mockResolvedValue(jsonOk({ dispatched: true }));

    await submitWorkflowRequest(assistant, {
      slug: 'daily_briefing',
      action: 'install',
      params: { focus: 'the Q3 launch' },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/logs');
    const body = JSON.parse(String((init as RequestInit).body));

    // The two that were wrong, and the reason each matters.
    expect(body.projectName).toBe('Assistants');
    expect(body).not.toHaveProperty('project');
    expect(Array.isArray(body.entries)).toBe(true);
    expect(body.entries).toHaveLength(1);

    // Row fields are unify's WorkflowRequest model, in its own casing.
    expect(body.entries[0]).toMatchObject({
      request_id: 'req-fixed',
      slug: 'daily_briefing',
      action: 'install',
      destination: 'personal',
      status: 'pending',
    });
    expect(JSON.parse(body.entries[0].params)).toEqual({ focus: 'the Q3 launch' });
    expect(body.context).toContain('Workflows/Requests');
  });

  it('records a team install against the team root', async () => {
    fetchMock.mockResolvedValue(jsonOk({ dispatched: true }));

    await submitWorkflowRequest(assistant, {
      slug: 'daily_briefing',
      action: 'install',
      destination: { kind: 'team', teamId: 7 },
    });

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.entries[0].destination).toBe('team:7');
    expect(body.context).toContain('Teams/7');
  });

  it('reports a failed write rather than pretending it landed', async () => {
    // The install that 422'd looked successful because the shelf drew its
    // own progress. The write throwing is what lets the caller say so.
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => '{"detail":"project_name: Field required"}',
    } as unknown as Response);

    await expect(
      submitWorkflowRequest(assistant, { slug: 'daily_briefing', action: 'install' })
    ).rejects.toThrow(/422/);
  });

  it('treats an undelivered wake as queued, never as a failed change', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonOk({}))
      .mockResolvedValueOnce({ ok: false, status: 500 } as unknown as Response);

    const result = await submitWorkflowRequest(assistant, {
      slug: 'daily_briefing',
      action: 'install',
    });

    expect(result.dispatched).toBe(false);
    expect(result.requestId).toBe('req-fixed');
  });
});
