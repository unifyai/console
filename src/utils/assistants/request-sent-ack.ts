import { v4 as uuidv4 } from 'uuid';
import type { Dispatch, SetStateAction } from 'react';
import type { RequestSentAck } from '@/types/assistants/chat';

/** Step ids whose "start/check" click should echo in chat. */
export const ONBOARDING_START_ACK_STEP_IDS = new Set([
  'email-reply',
  'whatsapp-message',
  'whatsapp-call',
  'sms-message',
  'phone-call',
  'slack-message',
  'discord-message',
]);

export function appendRequestSentAck(
  setRequestAckHistories: Dispatch<SetStateAction<Record<string, RequestSentAck[]>>>,
  assistantId: string,
  label: string
): void {
  const ack: RequestSentAck = {
    id: `request-sent-${uuidv4()}`,
    type: 'request_sent_ack',
    timestamp: new Date(),
    label,
  };
  setRequestAckHistories((prev) => {
    const current = prev[assistantId] ?? [];
    const lastTs =
      current.length > 0
        ? Math.max(...current.map((entry) => new Date(entry.timestamp).getTime()))
        : 0;
    const clampedTs = new Date(Math.max(ack.timestamp.getTime(), lastTs + 1));
    return {
      ...prev,
      [assistantId]: [...current, { ...ack, timestamp: clampedTs }],
    };
  });
}
