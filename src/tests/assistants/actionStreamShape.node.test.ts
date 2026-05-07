import { describe, expect, it } from 'vitest';

import { reshapeActionEventToLogEntry } from '@/lib/assistants/action-stream-shape';

describe('reshapeActionEventToLogEntry', () => {
  it('preserves CoordinatorActivity card fields for the workspace panel', () => {
    const shaped = reshapeActionEventToLogEntry({
      type: 'CoordinatorActivity',
      rowId: 42,
      eventTimestamp: '2026-05-01T10:00:01Z',
      eventId: 'event-1',
      activityId: 'activity-1',
      phase: 'progress',
      stage: 'integration_setup',
      surfaces: ['credentials'],
      title: 'Connecting Salesforce',
      summary: 'Checking access.',
      checklistItemId: 7,
      relatedEntities: [{ type: 'credential', id: 'salesforce', name: 'Salesforce' }],
      chatPrompt: 'Want me to keep going?',
      chatPromptLabel: 'Continue',
      correlationId: 'setup-run-1',
      occurredAt: '2026-05-01T10:00:00Z',
      status: 'ok',
      error: null,
    });

    expect(shaped).toEqual({
      type: 'CoordinatorActivity',
      data: {
        id: 42,
        ts: '2026-05-01T10:00:01Z',
        entries: {
          eventId: 'event-1',
          activityId: 'activity-1',
          phase: 'progress',
          stage: 'integration_setup',
          surfaces: ['credentials'],
          title: 'Connecting Salesforce',
          summary: 'Checking access.',
          checklistItemId: 7,
          relatedEntities: [{ type: 'credential', id: 'salesforce', name: 'Salesforce' }],
          chatPrompt: 'Want me to keep going?',
          chatPromptLabel: 'Continue',
          correlationId: 'setup-run-1',
          occurredAt: '2026-05-01T10:00:00Z',
          status: 'ok',
          error: null,
        },
      },
    });
  });

  it('keeps ManagerMethod fields in the existing action-tree shape', () => {
    const shaped = reshapeActionEventToLogEntry({
      type: 'ManagerMethod',
      rowId: 8,
      eventTimestamp: '2026-05-01T10:10:00Z',
      callingId: 'call-1',
      eventId: 'event-2',
      manager: 'WorkspaceManager',
      method: 'create_workspace',
      phase: 'completed',
      hierarchy: ['WorkspaceManager', 'create_workspace'],
      hierarchyLabel: 'WorkspaceManager.create_workspace',
      displayLabel: 'Create workspace',
      status: 'ok',
      question: 'Create it?',
      instructions: 'Use confirmed names only.',
      request: { name: 'Renewals' },
      answer: { workspaceId: 12 },
      action: 'create_workspace',
      error: null,
      errorType: null,
      traceback: null,
    });

    expect(shaped.type).toBe('ManagerMethod');
    expect(shaped.data.id).toBe(8);
    expect(shaped.data.ts).toBe('2026-05-01T10:10:00Z');
    expect(shaped.data.entries).toMatchObject({
      callingId: 'call-1',
      eventId: 'event-2',
      manager: 'WorkspaceManager',
      method: 'create_workspace',
      kind: null,
      toolAliases: null,
      persist: null,
    });
  });

  it('keeps ToolLoop metadata for the live Actions pane', () => {
    const shaped = reshapeActionEventToLogEntry({
      type: 'ToolLoop',
      rowId: 9,
      eventTimestamp: '2026-05-01T10:11:00Z',
      eventId: 'event-3',
      phase: 'completed',
      kind: 'tool_call',
      message: { role: 'assistant', toolCalls: [] },
      toolAliases: ['create_workspace'],
      persist: false,
    });

    expect(shaped.type).toBe('ToolLoop');
    expect(shaped.data.entries).toMatchObject({
      eventId: 'event-3',
      phase: 'completed',
      kind: 'tool_call',
      message: { role: 'assistant', toolCalls: [] },
      toolAliases: ['create_workspace'],
      persist: false,
    });
  });
});
