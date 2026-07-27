import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTasksData } from './useTasksData';
import type { Assistant } from '@/types/assistants/assistant';

let assistantSequence = 0;

function makeAssistant(): Assistant {
  assistantSequence += 1;
  return {
    agentId: 2693,
    userId: `tasks-owner-${assistantSequence}`,
    teamIds: [42],
  } as unknown as Assistant;
}

function emptyResponse() {
  return new Response(JSON.stringify({ logs: [], count: 0 }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('useTasksData', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('reads Activity executions across personal and team roots in All scope', async () => {
    const assistant = makeAssistant();
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue(emptyResponse());

    const { result } = renderHook(() =>
      useTasksData({
        assistant,
        ownerId: assistant.userId,
        assistantId: String(assistant.agentId),
      })
    );

    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    const activityContexts = fetchSpy.mock.calls
      .map(([input]) => new URL(String(input), 'http://localhost'))
      .filter((url) => url.pathname === '/api/logs' && !url.searchParams.has('filter'))
      .map((url) => url.searchParams.get('context'))
      .filter((context): context is string => context?.endsWith('/Tasks/Executions') ?? false);

    expect(activityContexts).toEqual([
      `${assistant.userId}/${assistant.agentId}/Tasks/Executions`,
      'Teams/42/Tasks/Executions',
    ]);
  });
});
