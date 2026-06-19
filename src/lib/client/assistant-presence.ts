export type AssistantPresenceWakeReason =
  | 'selection'
  | 'focus'
  | 'visibility'
  | 'activity'
  | 'keepwarm';

export type AssistantPresenceWakeSource = 'assistant_profile' | 'assistant_activity';

interface AssistantPresenceWakeArgs {
  assistantId: string;
  source: AssistantPresenceWakeSource;
  reason: AssistantPresenceWakeReason;
  pageVisibility?: DocumentVisibilityState;
  occurredAt?: string;
}

export async function requestAssistantPresenceWake({
  assistantId,
  source,
  reason,
  pageVisibility,
  occurredAt = new Date().toISOString(),
}: AssistantPresenceWakeArgs): Promise<void> {
  const response = await fetch(`/api/assistant/${encodeURIComponent(assistantId)}/system-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventType: 'assistant_presence_observed',
      message: 'User presence observed in Console.',
      extraEventFields: {
        source,
        reason,
        pageVisibility,
        occurredAt,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Assistant presence wake failed (${response.status})`);
  }
}
