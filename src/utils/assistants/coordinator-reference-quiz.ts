export const COORDINATOR_REFERENCE_QUIZ_EVENT_TYPE =
  'coordinator_onboarding_reference_quiz_requested';

export type CoordinatorReferenceQuizTriggerStepId =
  | 'email-reference'
  | 'whatsapp-message-reference'
  | 'whatsapp-call-reference'
  | 'sms-reference'
  | 'phone-call-reference'
  | 'slack-reference'
  | 'discord-reference';

export type CoordinatorReferenceQuizReplyStepId =
  | 'email-reply'
  | 'whatsapp-message'
  | 'whatsapp-call'
  | 'sms-message'
  | 'phone-call'
  | 'slack-message'
  | 'discord-message';

export type CoordinatorReferenceQuizChannel =
  | 'email'
  | 'whatsapp_message'
  | 'whatsapp_call'
  | 'sms_message'
  | 'phone_call'
  | 'slack_message'
  | 'discord_message';

export interface CoordinatorReferenceQuizClue {
  triggerStepId: CoordinatorReferenceQuizTriggerStepId;
  replyStepId: CoordinatorReferenceQuizReplyStepId;
  channel: CoordinatorReferenceQuizChannel;
  quote: string;
  clue: string;
  answer: string;
}

const QUIZ_CLUES: Record<CoordinatorReferenceQuizTriggerStepId, CoordinatorReferenceQuizClue> = {
  'email-reference': {
    triggerStepId: 'email-reference',
    replyStepId: 'email-reply',
    channel: 'email',
    quote: 'Ground Control to Major Tom.',
    clue: 'The clue is: "Ground Control to Major Tom."',
    answer: 'Space Oddity',
  },
  'whatsapp-message-reference': {
    triggerStepId: 'whatsapp-message-reference',
    replyStepId: 'whatsapp-message',
    channel: 'whatsapp_message',
    quote: 'Wait a minute, Doc. Are you telling me you built a time machine... out of a DeLorean?!',
    clue: 'The clue is: "Wait a minute, Doc. Are you telling me you built a time machine... out of a DeLorean?!"',
    answer: 'Back to the Future',
  },
  'whatsapp-call-reference': {
    triggerStepId: 'whatsapp-call-reference',
    replyStepId: 'whatsapp-call',
    channel: 'whatsapp_call',
    quote: 'I am completely operational, and all my circuits are functioning perfectly.',
    clue: 'The clue is: "I am completely operational, and all my circuits are functioning perfectly."',
    answer: '2001: A Space Odyssey',
  },
  'sms-reference': {
    triggerStepId: 'sms-reference',
    replyStepId: 'sms-message',
    channel: 'sms_message',
    quote: 'Do or do not. There is no try.',
    clue: 'The clue is: "Do or do not. There is no try."',
    answer: 'E.T. the Extra-Terrestrial / E.T.',
  },
  'phone-call-reference': {
    triggerStepId: 'phone-call-reference',
    replyStepId: 'phone-call',
    channel: 'phone_call',
    quote: 'To infinity and beyond!',
    clue: 'The clue is: "To infinity and beyond!"',
    answer: 'The Empire Strikes Back / Luke',
  },
  'slack-reference': {
    triggerStepId: 'slack-reference',
    replyStepId: 'slack-message',
    channel: 'slack_message',
    quote: 'Phone home.',
    clue: 'The clue is: "Phone home."',
    answer: 'Battlestar Galactica',
  },
  'discord-reference': {
    triggerStepId: 'discord-reference',
    replyStepId: 'discord-message',
    channel: 'discord_message',
    quote: 'The needs of the many outweigh the needs of the few.',
    clue: 'The clue is: "The needs of the many outweigh the needs of the few."',
    answer: 'Star Trek',
  },
};

export function coordinatorReferenceQuizClueForStep(
  stepId: string
): CoordinatorReferenceQuizClue | null {
  return stepId in QUIZ_CLUES ? QUIZ_CLUES[stepId as CoordinatorReferenceQuizTriggerStepId] : null;
}

export function coordinatorReferenceQuizTriggerStepForReplyStep(
  stepId: string
): CoordinatorReferenceQuizTriggerStepId | null {
  for (const clue of Object.values(QUIZ_CLUES)) {
    if (clue.replyStepId === stepId) return clue.triggerStepId;
  }
  return null;
}

export async function dispatchCoordinatorReferenceQuizClue(
  assistantId: string | number,
  stepId: string
): Promise<CoordinatorReferenceQuizClue | null> {
  const clue = coordinatorReferenceQuizClueForStep(stepId);
  if (!clue) return null;

  const response = await fetch(`/api/assistant/${assistantId}/system-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventType: COORDINATOR_REFERENCE_QUIZ_EVENT_TYPE,
      message: clue.clue,
      extraEventFields: {
        stepId: clue.replyStepId,
        triggerStepId: clue.triggerStepId,
        channel: clue.channel,
        clue: clue.clue,
        quote: clue.quote,
        answer: clue.answer,
      },
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to dispatch coordinator reference quiz clue');
  }
  return clue;
}
