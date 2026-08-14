import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CoordinatorOnboardingChecklist } from '@/components/Pages/Assistants/Coordinator/CoordinatorOnboardingChecklist';
import {
  CoordinatorOnboardingProvider,
  type CoordinatorOnboardingContextValue,
} from '@/components/Pages/Assistants/Coordinator/CoordinatorOnboardingContext';
import type {
  OnboardingRender,
  OnboardingStep,
  OnboardingStepDependency,
  OnboardingStepStatus,
} from '@/lib/assistants/coordinatorState';

function dependsOn(id: string, status: OnboardingStepStatus): OnboardingStepDependency {
  return { id, title: id, status, resolution: 'completed', satisfied: status === 'done' };
}

function step(
  id: string,
  status: OnboardingStepStatus,
  dependencies: OnboardingStepDependency[] = []
): OnboardingStep {
  return {
    id,
    title: id,
    phase: 'Communication',
    status,
    canSkip: true,
    description: '',
    estimatedTime: '',
    chipsChat: [],
    chipsCall: [],
    dependencies,
    event: null,
  };
}

function renderChecklist(whatsappStatus: 'skipped' | 'available') {
  const render_: OnboardingRender = {
    activeStepId: null,
    phases: [
      {
        id: 'communication',
        phase: 'Communication',
        title: 'Communication',
        description: '',
        framing: '',
      },
    ],
    steps: [
      step('email-reference', 'available'),
      step('email-reply', 'locked', [dependsOn('email-reference', 'available')]),
      step('whatsapp-number', whatsappStatus),
      step('whatsapp-message-reference', whatsappStatus, [
        dependsOn('whatsapp-number', whatsappStatus),
      ]),
      step('whatsapp-message', whatsappStatus, [
        dependsOn('whatsapp-message-reference', whatsappStatus),
      ]),
      step('whatsapp-call-reference', whatsappStatus, [
        dependsOn('whatsapp-number', whatsappStatus),
      ]),
      step('whatsapp-call', whatsappStatus, [dependsOn('whatsapp-call-reference', whatsappStatus)]),
    ],
    nextTargets: [],
    skippedPhaseIds: [],
  };
  const onSkipStep = vi.fn();
  const onUnskipStep = vi.fn();
  const ctx: CoordinatorOnboardingContextValue = {
    completedStepIds: new Set(),
    markStepCompleted: vi.fn(),
    resetStepProgress: vi.fn(),
    resetStepIds: new Set(),
    skippedStepIds: new Set(),
    markStepSkipped: vi.fn(),
    markStepUnskipped: vi.fn(),
    engagedStepIds: new Set(),
    markStepEngaged: vi.fn(),
    onboardingActive: true,
    setOnboardingActive: vi.fn(),
    onboarding: render_,
    firstLoginCommunicationEmailOpenRequest: 0,
    acknowledgeFirstLoginCommunicationEmailOpen: vi.fn(),
    appsConnectSettling: false,
  };
  render(
    <CoordinatorOnboardingProvider value={ctx}>
      <CoordinatorOnboardingChecklist
        onSkipStep={onSkipStep}
        onUnskipStep={onUnskipStep}
        onTriggerReferenceStep={vi.fn()}
        onAddWhatsappNumber={vi.fn()}
      />
    </CoordinatorOnboardingProvider>
  );
  return { onSkipStep, onUnskipStep };
}

/**
 * The channel header control must never flip its meaning in place. It used
 * to swap a hover-ghost "skip" icon for the same glyph mirrored, meaning
 * "unskip", in the same slot — so a user's second click on what looked like
 * the control they just used silently undid their skip (and unskip emitted
 * no event, so the assistant kept narrating the step as parked). After a
 * skip the slot goes empty and undo is a separate, explicitly labeled
 * control.
 */
describe('channel skip/unskip affordances', () => {
  it('offers only the skip icon on a pending channel', () => {
    renderChecklist('available');

    expect(screen.getByTestId('coordinator-onboarding-skip-channel-whatsapp')).toBeInTheDocument();
    expect(
      screen.queryByTestId('coordinator-onboarding-unskip-channel-whatsapp')
    ).not.toBeInTheDocument();
  });

  it('replaces the icon with a labeled undo control once the channel is skipped', () => {
    const { onUnskipStep } = renderChecklist('skipped');

    expect(
      screen.queryByTestId('coordinator-onboarding-skip-channel-whatsapp')
    ).not.toBeInTheDocument();
    const undo = screen.getByTestId('coordinator-onboarding-unskip-channel-whatsapp');
    expect(undo).toHaveTextContent('Skipped · Undo');

    fireEvent.click(undo);
    expect(onUnskipStep).toHaveBeenCalledTimes(1);
    expect(onUnskipStep).toHaveBeenCalledWith('whatsapp-number');
  });
});
