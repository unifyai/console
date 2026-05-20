import type { Assistant } from '@/types/assistants/assistant';

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

/**
 * Selects the user's canonical personal coordinator from a mixed assistant list.
 *
 * Preference order:
 * 1) Coordinator owned by the current user in personal scope
 * 2) Any coordinator owned by the current user
 * 3) Any personal-scope coordinator
 * 4) First coordinator row as a final fallback
 */
export function resolveCanonicalPersonalCoordinator(
  assistants: readonly Assistant[],
  currentUserId: string | null | undefined
): Assistant | null {
  const coordinatorRows = assistants.filter(isCoordinatorAssistant);
  if (coordinatorRows.length === 0) return null;

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

export function canonicalizeAssistantList(
  assistants: readonly Assistant[],
  options: {
    currentUserId?: string | null;
    pinCanonicalCoordinatorFirst?: boolean;
  } = {}
): Assistant[] {
  const normalizedAssistants = normalizeAssistantRows(assistants);
  if (!options.pinCanonicalCoordinatorFirst) return normalizedAssistants;

  const canonicalCoordinator = resolveCanonicalPersonalCoordinator(
    normalizedAssistants,
    options.currentUserId ?? null
  );
  if (!canonicalCoordinator) return normalizedAssistants;

  return [
    canonicalCoordinator,
    ...normalizedAssistants.filter(
      (assistant) => assistant.agentId !== canonicalCoordinator.agentId
    ),
  ];
}
