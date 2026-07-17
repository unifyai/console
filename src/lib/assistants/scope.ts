import type { Assistant } from '@/types/assistants/assistant';

export type ContextRoot = { kind: 'personal' } | { kind: 'team'; teamId: number };

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

export function rootContext(
  root: ContextRoot,
  ownerId: string,
  assistantId: string,
  table: string
): string {
  if (root.kind === 'personal') {
    return `${ownerId}/${assistantId}/${table}`;
  }
  return `Teams/${root.teamId}/${table}`;
}

export function rootKey(root: ContextRoot): string {
  if (root.kind === 'personal') return 'personal';
  return `team-${root.teamId}`;
}

export function currentTeamIds(assistant: Assistant): number[] {
  return Array.from(new Set(assistant.teamIds ?? [])).sort((left, right) => left - right);
}

export function roots(assistant: Assistant): readonly ContextRoot[] {
  return [
    { kind: 'personal' },
    ...currentTeamIds(assistant).map((teamId): ContextRoot => ({ kind: 'team', teamId })),
  ];
}
