import type { Assistant, ContactIdentityRoot } from '@/types/assistants/assistant';

export type ContextRoot = { kind: 'personal' } | { kind: 'space'; spaceId: number };

export type ChatRole = 'assistant' | 'user';

export interface ContactScopedRootQuery {
  root: ContextRoot;
  rootKey: string;
  context: string;
  contactId: number;
  selfContactId: number;
}

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

export function roleFromRootSenderId(
  query: Pick<ContactScopedRootQuery, 'selfContactId'>,
  senderId: number
): ChatRole {
  return senderId === query.selfContactId ? 'assistant' : 'user';
}

export function conversationFilterForRoot(
  query: Pick<ContactScopedRootQuery, 'contactId' | 'selfContactId'>
): string {
  const { contactId, selfContactId: selfId } = query;
  return `(sender_id == ${contactId} or (sender_id == ${selfId} and ${contactId} in receiver_ids))`;
}

export function conversationFilter(assistant: Assistant, contactId: number): string {
  return conversationFilterForRoot({ contactId, selfContactId: selfContactId(assistant) });
}

export function transcriptFilterForRoot(
  query: Pick<ContactScopedRootQuery, 'contactId' | 'selfContactId'>
): string {
  return `medium == "unify_message" and ${conversationFilterForRoot(query)}`;
}

export function transcriptFilter(assistant: Assistant, contactId: number): string {
  return transcriptFilterForRoot({ contactId, selfContactId: selfContactId(assistant) });
}

export function meetExchangeFilterForRoot(
  query: Pick<ContactScopedRootQuery, 'contactId' | 'selfContactId'>
): string {
  const { contactId, selfContactId: selfId } = query;
  return [
    'medium == "unify_meet"',
    `(sender_id == ${contactId} or sender_id == ${selfId})`,
    `(${contactId} in receiver_ids or receiver_ids == [${selfId}])`,
  ].join(' and ');
}

export function meetExchangeFilter(assistant: Assistant, contactId: number): string {
  return meetExchangeFilterForRoot({ contactId, selfContactId: selfContactId(assistant) });
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

export function rootKey(root: ContextRoot): string {
  if (root.kind === 'personal') return 'personal';
  return `space-${root.spaceId}`;
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

function identityMatchesRoot(identity: ContactIdentityRoot, root: ContextRoot): boolean {
  if (root.kind === 'personal') {
    return identity.targetScope === 'personal';
  }
  return identity.targetScope === 'space' && identity.targetSpaceId === root.spaceId;
}

export function contactIdentityForRoot(
  assistant: Assistant,
  root: ContextRoot
): ContactIdentityRoot | null {
  const identities =
    assistant.contactIdentityRoots?.length > 0
      ? assistant.contactIdentityRoots
      : [
          {
            targetScope: 'personal' as const,
            targetSpaceId: null,
            selfContactId: assistant.selfContactId,
            bossContactId: assistant.bossContactId,
          },
        ];
  return identities.find((identity) => identityMatchesRoot(identity, root)) ?? null;
}

function rootLocalContactId(
  assistant: Assistant,
  identity: ContactIdentityRoot,
  contactId: number
): number | null {
  if (identity.targetScope === 'personal') {
    return contactId;
  }
  if (contactId === assistant.selfContactId) {
    return identity.selfContactId;
  }
  if (contactId === assistant.bossContactId) {
    return identity.bossContactId;
  }
  return null;
}

export function contactScopedRootQueries(
  assistant: Assistant,
  contactId: number,
  table: string
): ContactScopedRootQuery[] {
  return roots(assistant).flatMap((root) => {
    const identity = contactIdentityForRoot(assistant, root);
    if (!identity) {
      console.warn('[contactScopedRootQueries] Omitting root with unresolved contact identity', {
        assistantId: assistant.agentId,
        root,
      });
      return [];
    }

    const scopedContactId = rootLocalContactId(assistant, identity, contactId);
    if (scopedContactId === null) {
      console.warn('[contactScopedRootQueries] Omitting root without selected contact identity', {
        assistantId: assistant.agentId,
        root,
        contactId,
      });
      return [];
    }

    return [
      {
        root,
        rootKey: rootKey(root),
        context: rootContext(root, assistant.userId, assistant.agentId, table),
        contactId: scopedContactId,
        selfContactId: identity.selfContactId,
      },
    ];
  });
}
