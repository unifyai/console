/**
 * Convert Droid's flat action-event payloads into the log-shaped frames that
 * Console's live consumers already understand.
 */

export function reshapeActionEventToLogEntry(camelEvent: Record<string, unknown>): {
  type: string;
  data: { id: number; ts: string; entries: Record<string, unknown> };
} {
  const type = (camelEvent.type as string) || 'ManagerMethod';
  if (type === 'CoordinatorActivity') {
    const occurredAt = (camelEvent.occurredAt as string) || new Date().toISOString();
    return {
      type,
      data: {
        id: (camelEvent.rowId as number) ?? 0,
        ts: (camelEvent.eventTimestamp as string) || occurredAt,
        entries: {
          eventId: camelEvent.eventId,
          activityId: camelEvent.activityId,
          phase: camelEvent.phase,
          stage: camelEvent.stage,
          surfaces: camelEvent.surfaces ?? [],
          title: camelEvent.title,
          summary: camelEvent.summary ?? null,
          checklistItemId: camelEvent.checklistItemId ?? null,
          relatedEntities: camelEvent.relatedEntities ?? [],
          chatPrompt: camelEvent.chatPrompt ?? null,
          chatPromptLabel: camelEvent.chatPromptLabel ?? null,
          correlationId: camelEvent.correlationId ?? null,
          occurredAt,
          status: camelEvent.status ?? 'ok',
          error: camelEvent.error ?? null,
        },
      },
    };
  }

  return {
    type,
    data: {
      id: (camelEvent.rowId as number) ?? 0,
      ts: (camelEvent.eventTimestamp as string) || new Date().toISOString(),
      entries: {
        callingId: camelEvent.callingId,
        eventId: camelEvent.eventId,
        manager: camelEvent.manager,
        method: camelEvent.method,
        phase: camelEvent.phase,
        hierarchy: camelEvent.hierarchy,
        hierarchyLabel: camelEvent.hierarchyLabel,
        displayLabel: camelEvent.displayLabel,
        status: camelEvent.status,
        question: camelEvent.question,
        instructions: camelEvent.instructions,
        request: camelEvent.request,
        answer: camelEvent.answer,
        action: camelEvent.action,
        error: camelEvent.error,
        errorType: camelEvent.errorType,
        traceback: camelEvent.traceback,
        kind: camelEvent.kind ?? null,
        message: camelEvent.message,
        toolAliases: camelEvent.toolAliases ?? null,
        persist: camelEvent.persist ?? null,
      },
    },
  };
}
