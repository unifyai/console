import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { submitWorkflowRequest } from '@/lib/client/workflows';
import type { Assistant } from '@/types/assistants/assistant';

/**
 * Recording an install-state change.
 *
 * The order is the contract: persist the row, then ask for a wake. Dispatching
 * first could wake an assistant for work no row records, and an undelivered
 * wake is not a failure because the assistant's boot sweep drains the same
 * queue. Both are asserted here because getting either backwards is silent.
 */

const assistant = { agentId: 7, userId: 'u1' } as unknown as Assistant;

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('submitWorkflowRequest', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes the row first, then asks for the wake', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({ dispatched: true }));

    const result = await submitWorkflowRequest(assistant, {
      slug: 'daily_briefing',
      action: 'install',
      params: { focus: 'Q3' },
    });

    expect(result.dispatched).toBe(true);
    expect(result.requestId).toBeTruthy();

    const [writeUrl, writeInit] = fetchMock.mock.calls[0];
    expect(writeUrl).toBe('/api/logs');
    const written = JSON.parse((writeInit as RequestInit).body as string);
    // The assistant's own context, and Orchestra's row casing rather than the
    // view model's.
    expect(written.context).toBe('u1/7/Workflows/Requests');
    // `/v0/logs` takes a list of rows, and this asserted a bare object — so
    // it agreed with the bug that 422'd every install on staging rather
    // than catching it. See workflowRequestWire.node.test.ts, which pins
    // the whole body including `projectName`.
    expect(written.entries).toHaveLength(1);
    expect(written.entries[0]).toMatchObject({
      request_id: result.requestId,
      slug: 'daily_briefing',
      action: 'install',
      status: 'pending',
      destination: 'personal',
    });
    expect(JSON.parse(written.entries[0].params)).toEqual({ focus: 'Q3' });

    const [dispatchUrl] = fetchMock.mock.calls[1];
    expect(dispatchUrl).toBe('/api/workflows/requests/dispatch');
  });

  it('reports an undelivered wake as queued rather than failing', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({ dispatched: false }));

    const result = await submitWorkflowRequest(assistant, {
      slug: 'daily_briefing',
      action: 'uninstall',
    });

    // The change is durable, so this is latency, not failure.
    expect(result.dispatched).toBe(false);
    expect(result.requestId).toBeTruthy();
  });

  it('survives an unreachable dispatch endpoint', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockRejectedValueOnce(new Error('network down'));

    await expect(
      submitWorkflowRequest(assistant, { slug: 'daily_briefing', action: 'update' })
    ).resolves.toMatchObject({ dispatched: false });
  });

  it('throws when the row itself could not be recorded', async () => {
    // Nothing is durable in this case, so the caller must hear about it.
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'nope' }, false));

    await expect(
      submitWorkflowRequest(assistant, { slug: 'daily_briefing', action: 'install' })
    ).rejects.toThrow(/could not record the request/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('targets the team context for a team install', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({ dispatched: true }));

    await submitWorkflowRequest(assistant, {
      slug: 'daily_briefing',
      action: 'install',
      destination: { kind: 'team', teamId: 11 },
    });

    const written = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(written.context).toBe('Teams/11/Workflows/Requests');
    expect(written.entries[0].destination).toBe('team:11');
  });
});
