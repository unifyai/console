import { describe, expect, it } from 'vitest';
import { onboardingStateUpdatedFrame } from '@/lib/assistants/onboarding-stream-frame';

describe('onboardingStateUpdatedFrame', () => {
  it('returns null for unrelated pubsub payloads', () => {
    expect(onboardingStateUpdatedFrame({ thread: 'comms_activity' })).toBeNull();
  });

  it('maps silent onboarding render updates to invalidation frames', () => {
    const frame = onboardingStateUpdatedFrame(
      {
        thread: 'unity_system_event',
        event: {
          eventType: 'coordinator_onboarding_event',
          subtype: 'onboarding_render_updated',
          details: { reason: 'contact_identity_updated' },
        },
      },
      '2026-07-03T12:00:00.000Z'
    );

    expect(frame).toEqual({
      type: 'OnboardingStateUpdated',
      data: {
        ts: '2026-07-03T12:00:00.000Z',
        reason: 'contact_identity_updated',
      },
    });
  });
});
