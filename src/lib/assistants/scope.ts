import type { Assistant } from '@/types/assistants/assistant';

export type ContextRoot = { kind: 'personal' } | { kind: 'space'; spaceId: number };

export type ChatRole = 'assistant' | 'user';

export function selfContactId(assistant: Assistant): number {
  return assistant.selfContactId;
}

export function bossContactId(assistant: Assistant): number {
  return assistant.bossContactId;
}

export function isSelf(assistant: Assistant, contactId: number): boolean {
  return contactId === selfContactId(assistant);
}

export function isBoss(assistant: Assistant, contactId: number): boolean {
  return contactId === bossContactId(assistant);
}

export function roleFromSenderId(assistant: Assistant, senderId: number): ChatRole {
  return isSelf(assistant, senderId) ? 'assistant' : 'user';
}

export function conversationFilter(assistant: Assistant, contactId: number): string {
  const selfId = selfContactId(assistant);
  return `(sender_id == ${contactId} or (sender_id == ${selfId} and ${contactId} in receiver_ids))`;
}

export function transcriptFilter(assistant: Assistant, contactId: number): string {
  return `medium == "unify_message" and ${conversationFilter(assistant, contactId)}`;
}

export function meetExchangeFilter(assistant: Assistant, contactId: number): string {
  const selfId = selfContactId(assistant);
  return [
    'medium == "unify_meet"',
    `(sender_id == ${contactId} or sender_id == ${selfId})`,
    `(${contactId} in receiver_ids or receiver_ids == [${selfId}])`,
  ].join(' and ');
}

export function rootContext(
  root: ContextRoot,
  ownerId: string,
  assistantId: string,
  table: string
): string {
  if (root.kind === 'personal') {
    return `${ownerId}/${assistantId}/${table}`;
  }
  return `Spaces/${root.spaceId}/${table}`;
}

export function currentSpaceIds(assistant: Assistant): number[] {
  return Array.from(new Set(assistant.spaceIds ?? [])).sort((left, right) => left - right);
}

export function roots(assistant: Assistant): readonly ContextRoot[] {
  return [
    { kind: 'personal' },
    ...currentSpaceIds(assistant).map((spaceId): ContextRoot => ({ kind: 'space', spaceId })),
  ];
}
