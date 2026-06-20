type VoiceControlSource = 'twin_onboarding_intro' | 'console';

type VoiceControlResult = { ok: true } | { ok: false; status?: number; detail?: string };

async function postAssistantSystemEvent(
  assistantId: string | number,
  body: {
    eventType: string;
    message: string;
    extraEventFields: Record<string, unknown>;
  }
): Promise<VoiceControlResult> {
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

export async function setAssistantProactiveSpeech(
  assistantId: string | number,
  enabled: boolean,
  {
    source = 'console',
    reason = '',
    scheduleNow = false,
  }: {
    source?: VoiceControlSource;
    reason?: string;
    scheduleNow?: boolean;
  } = {}
): Promise<VoiceControlResult> {
  return postAssistantSystemEvent(assistantId, {
    eventType: 'proactive_speech_control',
    message: enabled ? 'Enable proactive speech.' : 'Disable proactive speech.',
    extraEventFields: {
      enabled,
      source,
      reason,
      scheduleNow,
    },
  });
}

export async function injectAssistantVoiceTurn(
  assistantId: string | number,
  content: string,
  {
    source = 'console',
    scheduleProactive = false,
  }: {
    source?: VoiceControlSource;
    scheduleProactive?: boolean;
  } = {}
): Promise<VoiceControlResult> {
  return postAssistantSystemEvent(assistantId, {
    eventType: 'assistant_turn_injected',
    message: content,
    extraEventFields: {
      content,
      source,
      scheduleProactive,
    },
  });
}
