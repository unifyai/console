import type { OnboardingEventSpec, OnboardingStep } from '@/lib/assistants/coordinatorState';

function eventDetailString(
  event: OnboardingEventSpec | null | undefined,
  key: string
): string | null {
  const value = event?.details?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

export function coordinatorTriggerStepForReplyStep(
  stepId: string,
  steps: readonly OnboardingStep[]
): string | null {
  for (const step of steps) {
    const replyStepId = eventDetailString(step.event, 'reply_step_id');
    if (replyStepId === stepId) return step.id;
  }
  return null;
}

export function replyStepForCoordinatorTriggerStep(
  step: OnboardingStep | null | undefined
): string | null {
  return eventDetailString(step?.event, 'reply_step_id');
}

export async function dispatchCoordinatorOnboardingStepEvent(
  assistantId: string | number,
  step: OnboardingStep
): Promise<OnboardingEventSpec | null> {
  if (!step.event) return null;

  const response = await fetch('/api/coordinator-onboarding-step-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      coordinatorId: String(assistantId),
      stepId: step.id,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to dispatch coordinator onboarding event');
  }
  return step.event;
}
