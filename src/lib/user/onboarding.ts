'use server';

import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

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
 *
 * Uses the axios-based Orchestra client (which auto-converts
 * camelCase → snake_case) because the onboarding endpoint is not yet
 * in the generated OpenAPI schema.
 */
export async function updateOnboardingAction(apiKey: string) {
  return async (update: {
    currentStep: string;
    stepData?: Record<string, unknown>;
  }): Promise<void> => {
    'use server';

    const client = await getOrchestraUserClient(apiKey);

    await client.put('/user/onboarding', {
      currentStep: update.currentStep,
      ...(update.stepData && { stepData: update.stepData }),
    });
  };
}
