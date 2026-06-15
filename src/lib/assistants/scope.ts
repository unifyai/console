import type { Assistant, ContactIdentityRoot } from '@/types/assistants/assistant';

export type ContextRoot = { kind: 'personal' } | { kind: 'team'; teamId: number };

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

function parseAssistantIdForAuthoringFilter(assistantId: string): number {
  if (!/^\d+$/.test(assistantId)) {
    throw new Error(`[assistants/scope] assistantId must be numeric, got: ${assistantId}`);
  }
  return Number(assistantId);
}

export function authoringAssistantFilterForRoot(
  root: ContextRoot,
  assistantId: string
): string | null {
  if (root.kind !== 'team') return null;
  const parsedAssistantId = parseAssistantIdForAuthoringFilter(assistantId);
  return `(authoring_assistant_id == ${parsedAssistantId} or authoring_assistant_id == None)`;
}

export function transcriptFilterForRoot(
  query: Pick<ContactScopedRootQuery, 'root' | 'contactId' | 'selfContactId'>,
  assistantId: string
): string {
  const clauses = ['medium == "unify_message"', conversationFilterForRoot(query)];
  const authoringFilter = authoringAssistantFilterForRoot(query.root, assistantId);
  if (authoringFilter) {
    clauses.push(authoringFilter);
  }
  return clauses.join(' and ');
}

export function transcriptFilter(assistant: Assistant, contactId: number): string {
  return transcriptFilterForRoot(
    { root: { kind: 'personal' }, contactId, selfContactId: selfContactId(assistant) },
    assistant.agentId
  );
}

export function meetExchangeFilterForRoot(
  query: Pick<ContactScopedRootQuery, 'root' | 'contactId' | 'selfContactId'>,
  assistantId: string
): string {
  const { contactId, selfContactId: selfId } = query;
  const clauses = [
    'medium == "unify_meet"',
    `(sender_id == ${contactId} or sender_id == ${selfId})`,
    `(${contactId} in receiver_ids or receiver_ids == [${selfId}])`,
  ];
  const authoringFilter = authoringAssistantFilterForRoot(query.root, assistantId);
  if (authoringFilter) {
    clauses.push(authoringFilter);
  }
  return clauses.join(' and ');
}

export function meetExchangeFilter(assistant: Assistant, contactId: number): string {
  return meetExchangeFilterForRoot(
    { root: { kind: 'personal' }, contactId, selfContactId: selfContactId(assistant) },
    assistant.agentId
  );
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

function identityMatchesRoot(identity: ContactIdentityRoot, root: ContextRoot): boolean {
  if (root.kind === 'personal') {
    return identity.targetScope === 'personal';
  }
  return identity.targetScope === 'team' && identity.targetTeamId === root.teamId;
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
            targetTeamId: null,
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
