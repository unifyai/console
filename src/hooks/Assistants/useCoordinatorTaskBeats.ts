/**
 * Sources the live task data the Coordinator onboarding "Tasks" beats need.
 *
 * Two beats sit in the Delegate phase:
 *   - "Create a scheduled task" (scheduled boomerang) — surfaces a countdown
 *     to the nearest upcoming scheduled task so the ~minute wait before the
 *     assistant reports back reads as progress rather than dead air.
 *   - "Create a triggerable task" (event-triggered) — surfaces the armed
 *     task's id so the checklist can offer a deterministic "Test it" control
 *     that fires the trigger on demand.
 *
 * Beat *completion* is derived server-side by Orchestra (a schedule-bearing
 * task exists → create-scheduled-task; a trigger-bearing task exists →
 * create-triggerable-task) and flows back through the Coordinator state read,
 * so this hook only
 * provides the interactive affordances. It polls task data on a short
 * interval while active so a freshly-created task lights up its beat without
 * a manual refresh.
 */

import * as React from 'react';
import type { Assistant } from '@/types/assistants/assistant';
import type { TaskRow } from '@/types/assistants/brain';
import { useTasksData } from '@/hooks/Assistants/useTasksData';
import { triggerTask } from '@/lib/assistants/taskTrigger';

const REFRESH_INTERVAL_MS = 4000;

function hasScheduleShape(row: TaskRow): boolean {
  const schedule = row.schedule;
  if (schedule && typeof schedule === 'object' && Object.keys(schedule).length > 0) return true;
  return (
    String(row.triggerType ?? '')
      .trim()
      .toLowerCase() === 'scheduled'
  );
}

function hasTriggerShape(row: TaskRow): boolean {
  const trigger = row.trigger;
  if (trigger && typeof trigger === 'object' && Object.keys(trigger).length > 0) return true;
  return (
    String(row.triggerType ?? '')
      .trim()
      .toLowerCase() === 'triggered'
  );
}

function readTaskDueAt(row: TaskRow): string | null {
  const schedule = row.schedule as Record<string, unknown> | null | undefined;
  const startAt = schedule?.startAt ?? schedule?.start_at;
  const value = typeof startAt === 'string' && startAt ? startAt : row.nextDueAt;
  return typeof value === 'string' && value ? value : null;
}

export interface CoordinatorTaskBeats {
  /** Id of an armed (trigger-only) task, or null when none exists yet. */
  armedTriggerableTaskId: number | null;
  /** Nearest upcoming scheduled task's due time (ISO), or null when none. */
  nextScheduledTaskDueAt: string | null;
  /** Deterministically fire the armed triggerable task, then refresh task data. */
  testTriggerableTask: (taskId: number) => Promise<void>;
}

export function useCoordinatorTaskBeats(
  assistant: Assistant,
  { enabled, isActiveSurface = true }: { enabled: boolean; isActiveSurface?: boolean }
): CoordinatorTaskBeats {
  const tasksDataEnabled = enabled && isActiveSurface;
  const { tasks, refetch } = useTasksData({
    assistant,
    ownerId: assistant.userId,
    assistantId: assistant.agentId,
    enabled: tasksDataEnabled,
  });

  React.useEffect(() => {
    if (!tasksDataEnabled) return;
    const interval = setInterval(() => refetch(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [tasksDataEnabled, refetch]);

  const armedTriggerableTaskId = React.useMemo(() => {
    const match = tasks.rows.find((row) => hasTriggerShape(row) && !hasScheduleShape(row));
    return match ? match.taskId : null;
  }, [tasks.rows]);

  const nextScheduledTaskDueAt = React.useMemo(() => {
    const now = Date.now();
    let best: { at: string; ms: number } | null = null;
    for (const row of tasks.rows) {
      if (!hasScheduleShape(row)) continue;
      const due = readTaskDueAt(row);
      if (!due) continue;
      const ms = Date.parse(due);
      if (Number.isNaN(ms) || ms < now) continue;
      if (!best || ms < best.ms) best = { at: due, ms };
    }
    return best ? best.at : null;
  }, [tasks.rows]);

  const testTriggerableTask = React.useCallback(
    async (taskId: number) => {
      await triggerTask(taskId);
      refetch();
    },
    [refetch]
  );

  return { armedTriggerableTaskId, nextScheduledTaskDueAt, testTriggerableTask };
}
