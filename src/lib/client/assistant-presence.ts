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
  try {
    // Posts presence facts only. The route attaches the console's orientation
    // text server-side, so prompt content never travels through the browser.
    const response = await fetch(
      `/api/assistant/${encodeURIComponent(assistantId)}/console-presence`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, reason, pageVisibility, occurredAt }),
      }
    );

    if (!response.ok) {
      console.warn(`Assistant presence wake failed (${response.status})`);
    }
  } catch (error) {
    console.warn('Assistant presence wake request failed', error);
  }
}
