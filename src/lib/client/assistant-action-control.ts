type ActionControlResult = { ok: true } | { ok: false; status?: number; detail?: string };

async function postAssistantSystemEvent(
  assistantId: string | number,
  body: {
    eventType: string;
    message: string;
    extraEventFields: Record<string, unknown>;
  }
): Promise<ActionControlResult> {
  try {
    const response = await fetch(
      `/api/assistant/${encodeURIComponent(String(assistantId))}/system-event`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    if (response.ok) return { ok: true };
    const data = await response.json().catch(() => ({}));
    return {
      ok: false,
      status: response.status,
      detail: typeof data?.detail === 'string' ? data.detail : response.statusText,
    };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : 'Failed to send assistant system event',
    };
  }
}

/**
 * Ask ConversationManager to stop the in-flight act identified by Live Actions
 * `calling_id` (ManagerMethod root id).
 */
export async function stopAssistantAction(
  assistantId: string | number,
  callingId: string,
  {
    reason = 'Stopped from Console Actions pane.',
    source = 'console',
  }: {
    reason?: string;
    source?: string;
  } = {}
): Promise<ActionControlResult> {
  return postAssistantSystemEvent(assistantId, {
    eventType: 'action_stop',
    message: reason,
    extraEventFields: {
      callingId,
      reason,
      source,
    },
  });
}
