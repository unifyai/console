export const COORDINATOR_REFERENCE_QUIZ_EVENT_TYPE =
  'coordinator_onboarding_reference_quiz_requested';

export type CoordinatorReferenceQuizStepId =
  | 'whatsapp-message'
  | 'whatsapp-call'
  | 'sms-message'
  | 'slack-message'
  | 'discord-message';

export type CoordinatorReferenceQuizChannel =
  | 'whatsapp_message'
  | 'whatsapp_call'
  | 'sms_message'
  | 'slack_message'
  | 'discord_message';

export interface CoordinatorReferenceQuizClue {
  stepId: CoordinatorReferenceQuizStepId;
  channel: CoordinatorReferenceQuizChannel;
  quote: string;
  clue: string;
}

const QUIZ_CLUES: Record<CoordinatorReferenceQuizStepId, CoordinatorReferenceQuizClue> = {
  'whatsapp-message': {
    stepId: 'whatsapp-message',
    channel: 'whatsapp_message',
    quote: 'Wait a minute, Doc. Are you telling me you built a time machine... out of a DeLorean?!',
    clue: 'The clue is: "Wait a minute, Doc. Are you telling me you built a time machine... out of a DeLorean?!"',
  },
  'whatsapp-call': {
    stepId: 'whatsapp-call',
    channel: 'whatsapp_call',
    quote: 'I am completely operational, and all my circuits are functioning perfectly.',
    clue: 'The clue is: "I am completely operational, and all my circuits are functioning perfectly."',
  },
  'sms-message': {
    stepId: 'sms-message',
    channel: 'sms_message',
    quote: 'Do or do not. There is no try.',
    clue: 'The clue is: "Do or do not. There is no try."',
  },
  'slack-message': {
    stepId: 'slack-message',
    channel: 'slack_message',
    quote: 'Phone home.',
    clue: 'The clue is: "Phone home."',
  },
  'discord-message': {
    stepId: 'discord-message',
    channel: 'discord_message',
    quote: 'The needs of the many outweigh the needs of the few.',
    clue: 'The clue is: "The needs of the many outweigh the needs of the few."',
  },
};

export function coordinatorReferenceQuizClueForStep(
  stepId: string
): CoordinatorReferenceQuizClue | null {
  return stepId in QUIZ_CLUES ? QUIZ_CLUES[stepId as CoordinatorReferenceQuizStepId] : null;
}

export async function dispatchCoordinatorReferenceQuizClue(
  assistantId: string | number,
  stepId: string
): Promise<void> {
  const clue = coordinatorReferenceQuizClueForStep(stepId);
  if (!clue) return;

  const response = await fetch(`/api/assistant/${assistantId}/system-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventType: COORDINATOR_REFERENCE_QUIZ_EVENT_TYPE,
      message: clue.clue,
      extraEventFields: {
        stepId: clue.stepId,
        channel: clue.channel,
        clue: clue.clue,
        quote: clue.quote,
      },
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to dispatch coordinator reference quiz clue');
  }
}
