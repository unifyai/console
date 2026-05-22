import type { Assistant } from '@/types/assistants/assistant';

export interface CoordinatorWorkspaceScope {
  type: 'personal' | 'organization';
  organizationId: number | null;
}

export function isCoordinatorAssistant(
  assistant: Assistant | null | undefined
): assistant is Assistant {
  return assistant?.isCoordinator === true;
}

function normalizeAssistantRows(assistants: readonly Assistant[]): Assistant[] {
  const dedupedRows: Assistant[] = [];
  const seenAgentIds = new Set<string>();

  for (const assistant of assistants) {
    if (!assistant || !assistant.agentId) continue;
    if (seenAgentIds.has(assistant.agentId)) continue;
    seenAgentIds.add(assistant.agentId);
    dedupedRows.push({
      ...assistant,
      isCoordinator: assistant.isCoordinator === true,
    });
  }

  return dedupedRows;
}

export function resolveCanonicalWorkspaceCoordinator(
  assistants: readonly Assistant[],
  currentUserId: string | null | undefined,
  workspace: CoordinatorWorkspaceScope
): Assistant | null {
  const coordinatorRows = assistants.filter(isCoordinatorAssistant);
  if (coordinatorRows.length === 0) return null;

  if (workspace.type === 'organization' && workspace.organizationId != null) {
    if (currentUserId) {
      const ownedOrgCoordinator = coordinatorRows.find(
        (assistant) =>
          assistant.userId === currentUserId &&
          assistant.organizationId === workspace.organizationId
      );
      if (ownedOrgCoordinator) return ownedOrgCoordinator;
    }

    const orgCoordinator = coordinatorRows.find(
      (assistant) => assistant.organizationId === workspace.organizationId
    );
    return orgCoordinator ?? null;
  }

  if (currentUserId) {
    const ownedPersonalCoordinator = coordinatorRows.find(
      (assistant) => assistant.userId === currentUserId && assistant.organizationId === null
    );
    if (ownedPersonalCoordinator) return ownedPersonalCoordinator;

    const ownedCoordinator = coordinatorRows.find(
      (assistant) => assistant.userId === currentUserId
    );
    if (ownedCoordinator) return ownedCoordinator;
  }

  const personalCoordinator = coordinatorRows.find(
    (assistant) => assistant.organizationId === null
  );
  if (personalCoordinator) return personalCoordinator;

  return coordinatorRows[0] ?? null;
}

/**
 * Legacy helper retained for call sites that only care about personal context.
 */
export function resolveCanonicalPersonalCoordinator(
  assistants: readonly Assistant[],
  currentUserId: string | null | undefined
): Assistant | null {
  return resolveCanonicalWorkspaceCoordinator(assistants, currentUserId, {
    type: 'personal',
    organizationId: null,
  });
}

export function canonicalizeAssistantList(
  assistants: readonly Assistant[],
  options: {
    currentUserId?: string | null;
    pinCanonicalCoordinatorFirst?: boolean;
    workspace?: CoordinatorWorkspaceScope;
  } = {}
): Assistant[] {
  const normalizedAssistants = normalizeAssistantRows(assistants);
  if (!options.pinCanonicalCoordinatorFirst) return normalizedAssistants;

  const canonicalCoordinator = resolveCanonicalWorkspaceCoordinator(
    normalizedAssistants,
    options.currentUserId ?? null,
    options.workspace ?? {
      type: 'personal',
      organizationId: null,
    }
  );
  if (!canonicalCoordinator) return normalizedAssistants;

  return [
    canonicalCoordinator,
    ...normalizedAssistants.filter(
      (assistant) => assistant.agentId !== canonicalCoordinator.agentId
    ),
  ];
}
