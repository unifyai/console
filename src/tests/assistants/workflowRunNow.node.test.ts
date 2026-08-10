import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runWorkflowTask } from '@/lib/client/workflows';
import type { Assistant } from '@/types/assistants/assistant';

/**
 * Running an installed workflow on demand.
 *
 * A workflow has no runtime, so this is a trigger on the task it planted —
 * not a `Workflows/Requests` row, which is the install-state queue and would
 * make an immediate act wait on a wake. When the runtime refuses, the reason
 * it gives is the whole point: "already running" and "cancelled" need
 * different responses from the reader.
 */

const assistant = { agentId: 7, userId: 'u1' } as unknown as Assistant;

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('runWorkflowTask', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('triggers the planted task for this assistant', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ started: true }));

    const result = await runWorkflowTask(assistant, '42');

    expect(result.started).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/workflows/run');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      assistantId: 7,
      taskId: '42',
    });
  });

  it('passes the runtime’s refusal through instead of flattening it', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ started: false, detail: "Task 42 is not runnable (status='active')." }, 409)
    );

    const result = await runWorkflowTask(assistant, '42');

    expect(result.started).toBe(false);
    expect(result.detail).toContain('not runnable');
  });
});
