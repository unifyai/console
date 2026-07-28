import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAssistantActions } from '@/hooks/Assistants/useAssistantActions';
import { fetchManagerMethodEvents } from '@/lib/client/actions';
import type { AssistantActionActions, ManagerMethodLog } from '@/types/assistants/action';

vi.mock('@/lib/client/actions', () => ({
  fetchManagerMethodEvents: vi.fn(),
}));

vi.mock('@/lib/client/assistant-action-stream', () => ({
  subscribeToAssistantActionStream: vi.fn(() => () => undefined),
}));

vi.mock('@/lib/client/assistant-action-control', () => ({
  stopAssistantAction: vi.fn(),
}));

const fetchManagerMethodEventsMock = vi.mocked(fetchManagerMethodEvents);
const taskRunRoot = 'Task.run(task_id=15,run_key=offline:scheduled:2693:15:run)';

function managerLog(
  id: number,
  callingId: string,
  phase: 'incoming' | 'outgoing',
  hierarchy: string[],
  ts: string
): ManagerMethodLog {
  return {
    id,
    ts,
    entries: {
      callingId,
      manager: 'CodeActActor',
      method: 'act',
      phase,
      hierarchy,
      hierarchyLabel: hierarchy.join('->'),
      status: 'ok',
      eventTimestamp: ts,
    },
  };
}

describe('useAssistantActions durable task-run hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rebuilds Task.run children after refresh and includes them while paginating', async () => {
    const ordinaryLogs = [
      managerLog(
        1,
        'ordinary-act',
        'incoming',
        ['CodeActActor.act(ordinary-act)'],
        '2026-07-27T09:14:00Z'
      ),
      managerLog(
        2,
        'ordinary-act',
        'outgoing',
        ['CodeActActor.act(ordinary-act)'],
        '2026-07-27T09:14:01Z'
      ),
    ];
    const taskRunLogs = [
      managerLog(
        3,
        'task-act',
        'incoming',
        [taskRunRoot, 'CodeActActor.act(task-act)'],
        '2026-07-27T09:13:00Z'
      ),
      managerLog(
        4,
        'task-act',
        'outgoing',
        [taskRunRoot, 'CodeActActor.act(task-act)'],
        '2026-07-27T09:13:01Z'
      ),
    ];

    fetchManagerMethodEventsMock.mockImplementation(async (...args) => {
      const filter = args[5]?.[0];
      if (filter === 'len(hierarchy) == 1') {
        return { logs: ordinaryLogs, count: ordinaryLogs.length };
      }
      if (filter === "hierarchy_label.startswith('Task.run(')") {
        return { logs: taskRunLogs, count: taskRunLogs.length };
      }
      throw new Error(`Unexpected filter: ${filter}`);
    });

    const { result } = renderHook(() =>
      useAssistantActions('2693', '2693', {} as AssistantActionActions, { enabled: true })
    );

    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(result.current.roots).toHaveLength(2);

    const taskRoot = result.current.roots.find((node) => node.hierarchy[0] === taskRunRoot);
    expect(taskRoot).toMatchObject({ type: 'boundary', hierarchy: [taskRunRoot] });
    expect(taskRoot?.children).toMatchObject([
      {
        id: 'task-act',
        hierarchy: [taskRunRoot, 'CodeActActor.act(task-act)'],
        status: 'completed',
      },
    ]);

    await act(async () => {
      await result.current.loadMore();
    });
    expect(fetchManagerMethodEventsMock.mock.calls.slice(2, 4).map((call) => call[5]?.[0])).toEqual(
      ['len(hierarchy) == 1', "hierarchy_label.startswith('Task.run(')"]
    );

    await act(async () => {
      await result.current.refresh(true);
    });
    await waitFor(() => expect(fetchManagerMethodEventsMock).toHaveBeenCalledTimes(6));

    const rebuiltTaskRoot = result.current.roots.find((node) => node.hierarchy[0] === taskRunRoot);
    expect(rebuiltTaskRoot?.children).toMatchObject([
      {
        id: 'task-act',
        hierarchy: [taskRunRoot, 'CodeActActor.act(task-act)'],
        status: 'completed',
      },
    ]);
  });
});
