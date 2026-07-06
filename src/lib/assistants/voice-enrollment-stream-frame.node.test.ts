import { describe, expect, it } from 'vitest';
import { voiceEnrollmentSuggestedFrame } from '@/lib/assistants/voice-enrollment-stream-frame';

describe('voiceEnrollmentSuggestedFrame', () => {
  it('returns null for unrelated pubsub payloads', () => {
    expect(voiceEnrollmentSuggestedFrame({ thread: 'comms_activity' })).toBeNull();
  });

  it('maps voice enrollment suggested system events to SSE frames', () => {
    const frame = voiceEnrollmentSuggestedFrame({
      thread: 'unity_system_event',
      event: {
        eventType: 'voice_enrollment_suggested',
        numSpeakers: 3,
      },
    });

    expect(frame).toEqual({
      type: 'VoiceEnrollmentSuggested',
      data: { numSpeakers: 3 },
    });
  });
});
