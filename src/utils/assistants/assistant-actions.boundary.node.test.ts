import { describe, it, expect } from 'vitest';
import { buildActionTree } from '@/utils/assistants/assistant-actions';
import type { ManagerMethodLog } from '@/types/assistants/action';

const taskRunRoot = 'Task.run(task_id=15,run_key=offline:scheduled:2693:15:run)';

function managerLog(
  id: number,
  callingId: string,
  phase: 'incoming' | 'outgoing',
  hierarchy: string[],
  ts: string,
  status: 'ok' | 'error' = 'ok'
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
      status,
      answer: phase === 'outgoing' ? 'done' : undefined,
      eventTimestamp: ts,
    },
  };
}

describe('boundary node completion', () => {
  it('completes the root Task.run(...) boundary once its only child finishes', () => {
    const logs = [
      managerLog(
        1,
        'task-act',
        'incoming',
        [taskRunRoot, 'CodeActActor.act(task-act)'],
        '2026-07-27T09:14:00Z'
      ),
      managerLog(
        2,
        'task-act',
        'outgoing',
        [taskRunRoot, 'CodeActActor.act(task-act)'],
        '2026-07-27T09:14:05Z'
      ),
    ];

    const { roots } = buildActionTree(logs);

    const boundary = roots.find((node) => node.hierarchy[0] === taskRunRoot);
    expect(boundary).toMatchObject({ type: 'boundary', status: 'completed' });
    expect(boundary?.endTime).toBe('2026-07-27T09:14:05Z');
  });

  it('keeps the boundary running until every child reaches a terminal status', () => {
    const logs = [
      managerLog(
        1,
        'child-a',
        'incoming',
        [taskRunRoot, 'CodeActActor.act(child-a)'],
        '2026-07-27T09:14:00Z'
      ),
      managerLog(
        2,
        'child-b',
        'incoming',
        [taskRunRoot, 'CodeActActor.act(child-b)'],
        '2026-07-27T09:14:01Z'
      ),
      managerLog(
        3,
        'child-a',
        'outgoing',
        [taskRunRoot, 'CodeActActor.act(child-a)'],
        '2026-07-27T09:14:05Z'
      ),
    ];

    const { roots } = buildActionTree(logs);
    const boundary = roots.find((node) => node.hierarchy[0] === taskRunRoot);
    expect(boundary?.status).toBe('running');

    const followUp = [
      managerLog(
        4,
        'child-b',
        'outgoing',
        [taskRunRoot, 'CodeActActor.act(child-b)'],
        '2026-07-27T09:14:06Z',
        'error'
      ),
    ];

    const { roots: settledRoots } = buildActionTree([...logs, ...followUp]);
    const settledBoundary = settledRoots.find((node) => node.hierarchy[0] === taskRunRoot);
    expect(settledBoundary?.status).toBe('completed');
  });
});
