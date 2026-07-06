import { snakeToCamelObject } from '@/utils/casing';

export function voiceEnrollmentSuggestedFrame(
  payload: Record<string, unknown>
): { type: string; data: { numSpeakers: number } } | null {
  if (payload.thread !== 'unity_system_event') return null;

  const event = snakeToCamelObject<Record<string, unknown>>(payload.event ?? {});
  if (event.eventType !== 'voice_enrollment_suggested') return null;

  const numSpeakers = Number(event.numSpeakers);
  if (!Number.isFinite(numSpeakers) || numSpeakers < 2) return null;

  return {
    type: 'VoiceEnrollmentSuggested',
    data: { numSpeakers },
  };
}

export function encodeVoiceEnrollmentSuggestedSse(payload: Record<string, unknown>): string | null {
  const frame = voiceEnrollmentSuggestedFrame(payload);
  if (!frame) return null;
  return `data: ${JSON.stringify(frame)}\n\n`;
}
