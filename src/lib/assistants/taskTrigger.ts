'use server';

/**
 * Task trigger server action.
 *
 * Fires an armed (``triggerable``) task on demand through Orchestra's
 * public ``/tasks/{task_id}/trigger`` endpoint, which resolves the task,
 * authorizes it against the calling user, and dispatches a deterministic
 * ``task_trigger`` system event to the assistant runtime — bypassing the
 * inbound-event semantic-judgement path so the task fires reliably.
 *
 * Used by the Coordinator onboarding "tripwire" step so the user can watch
 * a triggered task fire immediately after arming it. The trigger stays armed
 * afterwards (the runtime re-arms triggerable tasks), so it also fires for
 * the real inbound event later.
 *
 * Server Actions cannot be called directly via HTTP — they can only be
 * invoked through React's internal mechanism, which prevents abuse by
 * external scripts.
 */

import { getCurrentUser } from '@/lib/user/user';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

export interface TaskTriggerResult {
  taskId: number;
  assistantId: number | null;
}

function parseTaskId(value: number | string): number {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid task id: ${value}`);
  }
  return parsed;
}

/** Deterministically fire an armed task by its logical task id. */
export async function triggerTask(taskId: number | string): Promise<TaskTriggerResult> {
  const user = await getCurrentUser();
  if (!user?.apiKey) {
    throw new Error('Unauthorized');
  }
  const numericId = parseTaskId(taskId);
  const client = await getOrchestraUserClient(user.apiKey);
  const response = await client.post(`/tasks/${numericId}/trigger`);
  const info = (response.data as { info?: unknown })?.info ?? response.data;
  const record = (info && typeof info === 'object' ? info : {}) as Record<string, unknown>;
  const resolvedAssistantId = Number(record.assistantId ?? record.assistant_id);
  return {
    taskId: numericId,
    assistantId: Number.isFinite(resolvedAssistantId) ? resolvedAssistantId : null,
  };
}
