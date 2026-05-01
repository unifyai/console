import type { Assistant } from '@/types/assistants/assistant';

export type ContextRoot = { kind: 'personal' } | { kind: 'space'; spaceId: number };

export const PERSONAL_SELF_CONTACT_ID = 0;
export const PERSONAL_BOSS_CONTACT_ID = 1;

export function selfContactId(assistant: Assistant): number {
  return assistant.selfContactId ?? PERSONAL_SELF_CONTACT_ID;
}

export function bossContactId(assistant: Assistant): number {
  return assistant.bossContactId ?? PERSONAL_BOSS_CONTACT_ID;
}

export function isSelf(assistant: Assistant, contactId: number): boolean {
  return contactId === selfContactId(assistant);
}

export function isBoss(assistant: Assistant, contactId: number): boolean {
  return contactId === bossContactId(assistant);
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
