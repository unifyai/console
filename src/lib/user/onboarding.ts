'use server';

import { createOrchestraClient } from '@/lib/orchestra/client';

/**
 * Server action factory that returns a function to update the user's
 * onboarding progress in Orchestra.
 *
 * Accepts any valid step + step_data, so callers can advance from any
 * step to any other (including "completed").  This keeps the action
 * generic — new onboarding steps don't require a new server action.
 *
 * OnboardingStatus is the single source of truth for where the user
 * is in the onboarding flow.
 */
export async function updateOnboardingAction(apiKey: string) {
  return async (update: {
    currentStep: string;
    stepData?: Record<string, unknown>;
  }): Promise<void> => {
    'use server';

    const client = createOrchestraClient(apiKey);

    await client.PUT('/v0/user/onboarding', {
      body: {
        current_step: update.currentStep,
        ...(update.stepData && { step_data: update.stepData }),
      } as never,
    });
  };
}
