import { describe, expect, it } from 'vitest';
import {
  buildDisplayedAssistantStatuses,
  displayAssistantPresenceStatus,
  shouldOptimisticallyShowCoordinatorOnline,
} from '@/lib/assistants/coordinatorOnboardingPresence';

const baseCtx = {
  canonicalCoordinatorId: '7330',
  showCoordinatorOnboardingIntro: false,
  awaitingCoordinatorChatIntro: false,
};

describe('coordinatorOnboardingPresence', () => {
  it('shows online only for the canonical coordinator during onboarding intro gates', () => {
    const ctx = { ...baseCtx, showCoordinatorOnboardingIntro: true };

    expect(shouldOptimisticallyShowCoordinatorOnline('7330', ctx)).toBe(true);
    expect(shouldOptimisticallyShowCoordinatorOnline('9999', ctx)).toBe(false);
    expect(shouldOptimisticallyShowCoordinatorOnline('7330', baseCtx)).toBe(false);
  });

  it('overrides offline status for the coordinator during chat intro wait', () => {
    const ctx = { ...baseCtx, awaitingCoordinatorChatIntro: true };

    expect(displayAssistantPresenceStatus({ running: false, jobName: null }, '7330', ctx)).toEqual({
      running: true,
      jobName: null,
    });
    expect(displayAssistantPresenceStatus({ running: false, jobName: null }, '9999', ctx)).toEqual({
      running: false,
      jobName: null,
    });
  });

  it('preserves an already-online status without cloning the whole map', () => {
    const statuses = new Map<string, { running: boolean; jobName: string | null }>([
      ['7330', { running: true, jobName: 'unity-7330' }],
    ]);
    const ctx = { ...baseCtx, awaitingCoordinatorChatIntro: true };

    expect(buildDisplayedAssistantStatuses(statuses, ctx)).toBe(statuses);
  });
});
