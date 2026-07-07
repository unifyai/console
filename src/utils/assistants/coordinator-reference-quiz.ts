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
  step: OnboardingStep,
  chipId?: string
): Promise<OnboardingEventSpec | null> {
  // Row clicks must carry their graph-owned event. Chip clicks only need the
  // owning step id: Orchestra resolves the chip-specific event server-side from
  // ``chipId``. This lets connect rows like ``apps`` keep no row event while
  // still having clickable chips.
  if (!step.event && !chipId) return null;

  const response = await fetch('/api/coordinator-onboarding-step-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      coordinatorId: String(assistantId),
      stepId: step.id,
      ...(chipId ? { chipId } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to dispatch coordinator onboarding event');
  }
  return (
    step.event ?? {
      eventType: 'coordinator_onboarding_event',
      message: '',
      subtype: 'chip_event_requested',
      details: { stepId: step.id, chipId },
    }
  );
}
