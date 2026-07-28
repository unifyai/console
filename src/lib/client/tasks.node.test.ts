import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchHasRunningTaskRun, RUNNING_TASK_RUN_FILTER_EXPR } from './tasks';
import type { Assistant } from '@/types/assistants/assistant';
import { getRunWhyLabel } from '@/utils/assistants/tasks';

const assistant = {
  agentId: 2693,
  userId: 'twin-owner',
  teamIds: [42],
} as unknown as Assistant;

function response(rows: Record<string, unknown>[]) {
  return new Response(
    JSON.stringify({
      logs: rows.map((entries) => ({ entries })),
      count: rows.length,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

describe('fetchHasRunningTaskRun', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('reads running executions from the canonical task execution ledger', async () => {
    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockImplementation(() => Promise.resolve(response([{ state: 'running' }])));

    await expect(fetchHasRunningTaskRun(assistant)).resolves.toBe(true);

    const requestUrl = new URL(String(fetchSpy.mock.calls[0][0]), 'http://localhost');
    expect(requestUrl.searchParams.get('context')).toBe('twin-owner/2693/Tasks/Executions');
    expect(requestUrl.searchParams.get('filter')).toBe(RUNNING_TASK_RUN_FILTER_EXPR);
  });

  it('reads the selected team root instead of the personal execution ledger', async () => {
    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockImplementation(() => Promise.resolve(response([{ state: 'running' }])));

    await expect(fetchHasRunningTaskRun(assistant, { kind: 'team', teamId: 42 })).resolves.toBe(
      true
    );

    const requestUrl = new URL(String(fetchSpy.mock.calls[0][0]), 'http://localhost');
    expect(requestUrl.searchParams.get('context')).toBe('Teams/42/Tasks/Executions');
  });

  it('reads every accessible execution ledger when no root is selected', async () => {
    const fetchSpy = vi
      .spyOn(window, 'fetch')
      .mockImplementation(() => Promise.resolve(response([{ state: 'running' }])));

    await expect(fetchHasRunningTaskRun(assistant)).resolves.toBe(true);

    const contexts = fetchSpy.mock.calls.map(([input]) =>
      new URL(String(input), 'http://localhost').searchParams.get('context')
    );
    expect(contexts).toEqual(['twin-owner/2693/Tasks/Executions', 'Teams/42/Tasks/Executions']);
  });

  it('uses the canonical execution wake to describe why a task started', () => {
    expect(
      getRunWhyLabel({
        taskId: 14,
        taskName: null,
        taskDescription: null,
        wake: 'scheduled',
        state: 'completed',
        scheduledFor: null,
        sourceMedium: null,
        sourceContactDisplayName: null,
        startedAt: null,
        completedAt: null,
      })
    ).toBe('On schedule');
  });
});
