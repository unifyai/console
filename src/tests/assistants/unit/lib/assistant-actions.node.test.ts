/**
 * Unit tests for src/utils/assistants/assistant-actions.ts
 *
 * Tests the tree-building algorithm and event parsing for the Actions panel.
 * These are pure function tests - no API mocking needed.
 *
 * @group unit
 */

import { describe, it, expect } from 'vitest';
import {
  buildActionTree,
  mergeNewEvents,
  parseManagerMethodLog,
  createActionNode,
  applyOutgoingEvent,
  isMeaningfulContent,
  findNodeByCallingId,
  hasActiveRootAction,
} from '@/utils/assistants/assistant-actions';
import type { ActionNode, ManagerMethodLog, ActionNodeStatus } from '@/types/assistants/action';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Creates a mock ManagerMethod log entry as returned from the API
 */
function createMockLog(overrides: Partial<ManagerMethodLog> = {}): ManagerMethodLog {
  const defaults: ManagerMethodLog = {
    id: 1,
    ts: new Date().toISOString(),
    entries: {
      manager: 'ContactManager',
      method: 'ask',
      phase: 'incoming',
      callingId: 'call-1',
      hierarchy: ['ContactManager.ask'],
      hierarchyLabel: 'ContactManager.ask(a1b2)',
      status: 'ok',
    },
  };

  return {
    ...defaults,
    ...overrides,
    entries: { ...defaults.entries, ...overrides.entries },
  };
}

// =============================================================================
// parseManagerMethodLog Tests
// =============================================================================

describe('parseManagerMethodLog', () => {
  it(
    'parses a valid incoming log entry',
    {
      meta: {
        alias: 'ParseLog-IncomingValid',
        scenario: 'Log has all required fields for an incoming event',
        behavior: 'Returns parsed event with correct fields',
      },
    },
    () => {
      const log = createMockLog({
        id: 42,
        ts: '2024-01-15T10:30:00.000Z',
        entries: {
          manager: 'ContactManager',
          method: 'ask',
          phase: 'incoming',
          callingId: 'abc-123',
          hierarchy: ['CodeActActor.act', 'ContactManager.ask'],
          hierarchyLabel: 'CodeActActor.act->ContactManager.ask(abc1)',
          question: 'Find John',
          status: 'ok',
        },
      });

      const result = parseManagerMethodLog(log);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(42);
      expect(result!.timestamp).toBe('2024-01-15T10:30:00.000Z');
      expect(result!.manager).toBe('ContactManager');
      expect(result!.method).toBe('ask');
      expect(result!.phase).toBe('incoming');
      expect(result!.callingId).toBe('abc-123');
      expect(result!.hierarchy).toEqual(['CodeActActor.act', 'ContactManager.ask']);
      expect(result!.hierarchyLabel).toBe('CodeActActor.act->ContactManager.ask(abc1)');
      expect(result!.content).toBe('Find John');
      expect(result!.status).toBe('ok');
    }
  );

  it(
    'parses an outgoing log with answer content',
    {
      meta: {
        alias: 'ParseLog-OutgoingWithAnswer',
        scenario: 'Outgoing event has answer field',
        behavior: 'Content is set from answer field',
      },
    },
    () => {
      const log = createMockLog({
        entries: {
          manager: 'ContactManager',
          method: 'ask',
          phase: 'outgoing',
          callingId: 'abc-123',
          hierarchy: ['ContactManager.ask'],
          hierarchyLabel: 'ContactManager.ask(abc1)',
          answer: 'Found 3 contacts',
          status: 'ok',
        },
      });

      const result = parseManagerMethodLog(log);

      expect(result).not.toBeNull();
      expect(result!.phase).toBe('outgoing');
      expect(result!.content).toBe('Found 3 contacts');
    }
  );

  it(
    'returns null for logs missing required fields',
    {
      meta: {
        alias: 'ParseLog-MissingFields',
        scenario: 'Log is missing calling_id',
        behavior: 'Returns null for invalid log',
      },
    },
    () => {
      const log = createMockLog({
        entries: {
          manager: 'ContactManager',
          method: 'ask',
          phase: 'incoming',
          callingId: undefined as any, // Missing required field
          hierarchy: ['ContactManager.ask'],
          hierarchyLabel: 'ContactManager.ask(a1b2)',
          status: 'ok',
        },
      });

      const result = parseManagerMethodLog(log);

      expect(result).toBeNull();
    }
  );

  it(
    'handles instructions field for update/execute methods',
    {
      meta: {
        alias: 'ParseLog-InstructionsField',
        scenario: 'Log has instructions instead of question',
        behavior: 'Content is set from instructions field',
      },
    },
    () => {
      const log = createMockLog({
        entries: {
          manager: 'TaskScheduler',
          method: 'execute',
          phase: 'incoming',
          callingId: 'task-exec-1',
          hierarchy: ['TaskScheduler.execute'],
          hierarchyLabel: 'TaskScheduler.execute(t1e2)',
          instructions: 'Send email to John',
          status: 'ok',
        },
      });

      const result = parseManagerMethodLog(log);

      expect(result).not.toBeNull();
      expect(result!.content).toBe('Send email to John');
    }
  );

  it(
    'returns null for infrastructure noise phase: null events',
    {
      meta: {
        alias: 'ParseLog-NullPhaseNoise',
        scenario: 'Log has phase: null with infrastructure action (done, result, etc.)',
        behavior: 'Returns null — infrastructure noise is discarded',
      },
    },
    () => {
      for (const action of ['done', 'result', 'next_notification', 'next_clarification']) {
        const log = createMockLog({
          entries: {
            manager: 'CodeActActor',
            method: 'act',
            phase: null,
            callingId: 'act-123',
            hierarchy: ['CodeActActor.act'],
            hierarchyLabel: 'CodeActActor.act(30d0)',
            action,
            status: 'ok',
          },
        });

        expect(parseManagerMethodLog(log)).toBeNull();
      }
    }
  );

  it(
    'discards user-facing phase: null action events',
    {
      meta: {
        alias: 'ParseLog-UserFacingAction',
        scenario: 'Log has phase: null with user-facing action (interject, stop, etc.)',
        behavior: 'Returns null — steering annotations are now represented in ToolLoop data',
      },
    },
    () => {
      for (const action of ['interject', 'stop', 'pause', 'resume', 'ask', 'answerClarification']) {
        const log = createMockLog({
          entries: {
            manager: 'CodeActActor',
            method: 'act',
            phase: null,
            callingId: 'act-123',
            hierarchy: ['CodeActActor.act'],
            hierarchyLabel: 'CodeActActor.act(30d0)',
            action,
            status: 'ok',
          },
        });

        expect(parseManagerMethodLog(log)).toBeNull();
      }
    }
  );

  it(
    'passes through displayLabel from entries',
    {
      meta: {
        alias: 'ParseLog-DisplayLabel',
        scenario: 'Log has displayLabel field from Unity',
        behavior: 'Parsed event includes displayLabel',
      },
    },
    () => {
      const log = createMockLog({
        id: 42,
        ts: '2024-01-15T10:30:00.000Z',
        entries: {
          manager: 'ContactManager',
          method: 'ask',
          phase: 'incoming',
          callingId: 'abc-123',
          hierarchy: ['CodeActActor.act', 'ContactManager.ask'],
          hierarchyLabel: 'CodeActActor.act->ContactManager.ask(abc1)',
          question: 'Find John',
          status: 'ok',
          displayLabel: 'Checking Contact Book',
        },
      });

      const result = parseManagerMethodLog(log);

      expect(result).not.toBeNull();
      expect(result!.displayLabel).toBe('Checking Contact Book');
    }
  );

  it(
    'passes through eventId for deduplication',
    {
      meta: {
        alias: 'ParseLog-EventId',
        scenario: 'Log has eventId field',
        behavior: 'Parsed event includes eventId',
      },
    },
    () => {
      const log = createMockLog({
        entries: {
          manager: 'ContactManager',
          method: 'ask',
          phase: 'incoming',
          callingId: 'abc-123',
          hierarchy: ['ContactManager.ask'],
          hierarchyLabel: 'ContactManager.ask(abc1)',
          status: 'ok',
          eventId: 'evt-uuid-001',
        },
      });

      const result = parseManagerMethodLog(log);

      expect(result).not.toBeNull();
      expect(result!.eventId).toBe('evt-uuid-001');
    }
  );

  it(
    'passes through error detail fields',
    {
      meta: {
        alias: 'ParseLog-ErrorDetails',
        scenario: 'Outgoing error event has errorType and traceback',
        behavior: 'Parsed event includes errorType and traceback',
      },
    },
    () => {
      const log = createMockLog({
        entries: {
          manager: 'ContactManager',
          method: 'ask',
          phase: 'outgoing',
          callingId: 'abc-123',
          hierarchy: ['ContactManager.ask'],
          hierarchyLabel: 'ContactManager.ask(abc1)',
          status: 'error',
          error: 'Connection timeout',
          errorType: 'TimeoutError',
          traceback: 'Traceback (most recent call last):\n  ...',
        },
      });

      const result = parseManagerMethodLog(log);

      expect(result).not.toBeNull();
      expect(result!.error).toBe('Connection timeout');
      expect(result!.errorType).toBe('TimeoutError');
      expect(result!.traceback).toBe('Traceback (most recent call last):\n  ...');
    }
  );
});

// =============================================================================
// createActionNode Tests
// =============================================================================

describe('createActionNode', () => {
  it(
    'creates a running node from incoming event',
    {
      meta: {
        alias: 'CreateNode-Running',
        scenario: 'Incoming event creates a new node',
        behavior: 'Node has running status and correct fields',
      },
    },
    () => {
      const event = parseManagerMethodLog(
        createMockLog({
          ts: '2024-01-15T10:30:00.000Z',
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'incoming',
            callingId: 'call-abc',
            hierarchy: ['CodeActActor.act', 'ContactManager.ask'],
            hierarchyLabel: 'CodeActActor.act->ContactManager.ask(abc1)',
            question: 'Find John',
            status: 'ok',
          },
        })
      )!;

      const node = createActionNode(event);

      expect(node.id).toBe('call-abc');
      expect(node.type).toBe('manager');
      expect(node.label).toBe('ContactManager.ask');
      expect(node.displayLabel).toBeUndefined();
      expect(node.hierarchy).toEqual(['CodeActActor.act', 'ContactManager.ask']);
      expect(node.hierarchyLabel).toBe('CodeActActor.act->ContactManager.ask(abc1)');
      expect(node.status).toBe('running');
      expect(node.startTime).toBe('2024-01-15T10:30:00.000Z');
      expect(node.endTime).toBeUndefined();
      expect(node.content).toBe('Find John');
      expect(node.children).toEqual([]);
    }
  );

  it(
    'uses displayLabel as node label when available',
    {
      meta: {
        alias: 'CreateNode-DisplayLabel',
        scenario: 'Event has displayLabel from Unity',
        behavior:
          'Node label is set to displayLabel, raw hierarchy preserved in displayLabel field',
      },
    },
    () => {
      const event = parseManagerMethodLog(
        createMockLog({
          ts: '2024-01-15T10:30:00.000Z',
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'incoming',
            callingId: 'call-abc',
            hierarchy: ['CodeActActor.act', 'ContactManager.ask'],
            hierarchyLabel: 'CodeActActor.act->ContactManager.ask(abc1)',
            question: 'Find John',
            status: 'ok',
            displayLabel: 'Checking Contact Book',
          },
        })
      )!;

      const node = createActionNode(event);

      expect(node.label).toBe('Checking Contact Book');
      expect(node.displayLabel).toBe('Checking Contact Book');
      expect(node.type).toBe('manager');
    }
  );

  it(
    'falls back to hierarchy segment when displayLabel is absent',
    {
      meta: {
        alias: 'CreateNode-FallbackLabel',
        scenario: 'Event has no displayLabel',
        behavior: 'Node label is the last hierarchy segment',
      },
    },
    () => {
      const event = parseManagerMethodLog(
        createMockLog({
          ts: '2024-01-15T10:30:00.000Z',
          entries: {
            manager: 'CodeActActor',
            method: 'act',
            phase: 'incoming',
            callingId: 'call-root',
            hierarchy: ['CodeActActor.act'],
            hierarchyLabel: 'CodeActActor.act(r001)',
            status: 'ok',
          },
        })
      )!;

      const node = createActionNode(event);

      expect(node.label).toBe('CodeActActor.act');
      expect(node.displayLabel).toBeUndefined();
    }
  );
});

// =============================================================================
// isMeaningfulContent Tests
// =============================================================================

describe('isMeaningfulContent', () => {
  it.each([
    [undefined, false],
    ['', false],
    ['true', false],
    ['false', false],
    ['True', false],
    ['FALSE', false],
    ['  true  ', false],
    ['null', false],
    ['undefined', false],
  ])('returns false for trivial value: %j', (input, expected) => {
    expect(isMeaningfulContent(input)).toBe(expected);
  });

  it.each([
    ['Found 3 contacts', true],
    ['Here are all 4 contacts on file...', true],
    ['Connection timeout', true],
    ['done', true],
  ])('returns true for meaningful value: %j', (input, expected) => {
    expect(isMeaningfulContent(input)).toBe(expected);
  });
});

// =============================================================================
// applyOutgoingEvent Tests
// =============================================================================

describe('applyOutgoingEvent', () => {
  it(
    'marks node as completed on successful outgoing',
    {
      meta: {
        alias: 'ApplyOutgoing-Completed',
        scenario: 'Outgoing event with status ok',
        behavior: 'Node status becomes completed, endTime set',
      },
    },
    () => {
      const node: ActionNode = {
        id: 'call-1',
        type: 'manager',
        label: 'ContactManager.ask',
        hierarchy: ['ContactManager.ask'],
        hierarchyLabel: 'ContactManager.ask(a1b2)',
        status: 'running',
        startTime: '2024-01-15T10:30:00.000Z',
        children: [],
      };

      const outgoingEvent = parseManagerMethodLog(
        createMockLog({
          ts: '2024-01-15T10:30:05.000Z',
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'outgoing',
            callingId: 'call-1',
            hierarchy: ['ContactManager.ask'],
            hierarchyLabel: 'ContactManager.ask(a1b2)',
            answer: 'Found 3 contacts',
            status: 'ok',
          },
        })
      )!;

      applyOutgoingEvent(node, outgoingEvent);

      expect(node.status).toBe('completed');
      expect(node.endTime).toBe('2024-01-15T10:30:05.000Z');
      expect(node.content).toBe('Found 3 contacts');
    }
  );

  it(
    'marks node as error on failed outgoing',
    {
      meta: {
        alias: 'ApplyOutgoing-Error',
        scenario: 'Outgoing event with status error',
        behavior: 'Node status becomes error',
      },
    },
    () => {
      const node: ActionNode = {
        id: 'call-1',
        type: 'manager',
        label: 'ContactManager.ask',
        hierarchy: ['ContactManager.ask'],
        hierarchyLabel: 'ContactManager.ask(a1b2)',
        status: 'running',
        startTime: '2024-01-15T10:30:00.000Z',
        children: [],
      };

      const outgoingEvent = parseManagerMethodLog(
        createMockLog({
          ts: '2024-01-15T10:30:05.000Z',
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'outgoing',
            callingId: 'call-1',
            hierarchy: ['ContactManager.ask'],
            hierarchyLabel: 'ContactManager.ask(a1b2)',
            error: 'Connection timeout',
            status: 'error',
          },
        })
      )!;

      applyOutgoingEvent(node, outgoingEvent);

      expect(node.status).toBe('error');
      expect(node.endTime).toBe('2024-01-15T10:30:05.000Z');
    }
  );

  it(
    'clears toolLoopSteps when node completes with meaningful content',
    {
      meta: {
        alias: 'ApplyOutgoing-ClearsToolLoops',
        scenario: 'Node had loaded toolLoopSteps, outgoing has meaningful answer',
        behavior: 'toolLoopSteps cleared, isToolLoopLoaded reset',
      },
    },
    () => {
      const node: ActionNode = {
        id: 'call-1',
        type: 'manager',
        label: 'ContactManager.ask',
        hierarchy: ['ContactManager.ask'],
        hierarchyLabel: 'ContactManager.ask(a1b2)',
        status: 'running',
        startTime: '2024-01-15T10:30:00.000Z',
        children: [],
        toolLoopSteps: [{ id: 'step-1', type: 'llm', content: 'Thinking...' }],
        isToolLoopLoaded: true,
      };

      const outgoingEvent = parseManagerMethodLog(
        createMockLog({
          ts: '2024-01-15T10:30:05.000Z',
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'outgoing',
            callingId: 'call-1',
            hierarchy: ['ContactManager.ask'],
            hierarchyLabel: 'ContactManager.ask(a1b2)',
            answer: 'Here are all 4 contacts',
            status: 'ok',
          },
        })
      )!;

      applyOutgoingEvent(node, outgoingEvent);

      expect(node.status).toBe('completed');
      expect(node.toolLoopSteps).toBeUndefined();
      expect(node.isToolLoopLoaded).toBe(false);
    }
  );

  it(
    'does not overwrite meaningful content with trivial value',
    {
      meta: {
        alias: 'ApplyOutgoing-TrivialSkipped',
        scenario: 'Node has meaningful content, outgoing has answer "true"',
        behavior: 'Existing content preserved',
      },
    },
    () => {
      const node: ActionNode = {
        id: 'call-1',
        type: 'manager',
        label: 'ContactManager.ask',
        hierarchy: ['ContactManager.ask'],
        hierarchyLabel: 'ContactManager.ask(a1b2)',
        status: 'completed',
        startTime: '2024-01-15T10:30:00.000Z',
        endTime: '2024-01-15T10:30:05.000Z',
        content: 'Here are all 4 contacts',
        children: [],
      };

      const outgoingEvent = parseManagerMethodLog(
        createMockLog({
          ts: '2024-01-15T10:30:06.000Z',
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'outgoing',
            callingId: 'call-1',
            hierarchy: ['ContactManager.ask'],
            hierarchyLabel: 'ContactManager.ask(a1b2)',
            answer: 'true',
            status: 'ok',
          },
        })
      )!;

      applyOutgoingEvent(node, outgoingEvent);

      expect(node.content).toBe('Here are all 4 contacts');
      expect(node.endTime).toBe('2024-01-15T10:30:06.000Z');
    }
  );

  it(
    'keeps node running on trivial "false" outgoing (loop-control signal)',
    {
      meta: {
        alias: 'ApplyOutgoing-FalseKeepsRunning',
        scenario: 'Running node receives outgoing with answer "false"',
        behavior:
          'Status stays running — trivial outgoing is a loop-control signal, not completion',
      },
    },
    () => {
      const node: ActionNode = {
        id: 'call-1',
        type: 'manager',
        label: 'ContactManager.ask',
        hierarchy: ['ContactManager.ask'],
        hierarchyLabel: 'ContactManager.ask(a1b2)',
        status: 'running',
        startTime: '2024-01-15T10:30:00.000Z',
        content: 'List all contacts',
        children: [],
      };

      const outgoingEvent = parseManagerMethodLog(
        createMockLog({
          ts: '2024-01-15T10:30:03.000Z',
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'outgoing',
            callingId: 'call-1',
            hierarchy: ['ContactManager.ask'],
            hierarchyLabel: 'ContactManager.ask(a1b2)',
            answer: 'false',
            status: 'ok',
          },
        })
      )!;

      applyOutgoingEvent(node, outgoingEvent);

      expect(node.status).toBe('running');
      expect(node.content).toBe('List all contacts');
      expect(node.endTime).toBeUndefined();
    }
  );

  it(
    'marks node as completed when answer is null (no content to report)',
    {
      meta: {
        alias: 'ApplyOutgoing-NullAnswerCompletes',
        scenario: 'Running node receives outgoing with answer null (e.g. execute_code)',
        behavior:
          'Status becomes completed — null answer means the operation finished with nothing to report, not a loop-control signal',
      },
    },
    () => {
      const node: ActionNode = {
        id: 'call-exec-1',
        type: 'manager',
        label: 'Running Code',
        hierarchy: ['CodeActActor.act', 'execute_code'],
        hierarchyLabel: 'CodeActActor.act->execute_code(b21f)',
        status: 'running',
        startTime: '2024-01-15T10:30:00.000Z',
        children: [],
      };

      const outgoingEvent = parseManagerMethodLog(
        createMockLog({
          ts: '2024-01-15T10:30:45.000Z',
          entries: {
            manager: 'CodeActActor',
            method: 'execute_code',
            phase: 'outgoing',
            callingId: 'call-exec-1',
            hierarchy: ['CodeActActor.act', 'execute_code'],
            hierarchyLabel: 'CodeActActor.act->execute_code(b21f)',
            answer: undefined,
            status: 'ok',
          },
        })
      )!;

      applyOutgoingEvent(node, outgoingEvent);

      expect(node.status).toBe('completed');
      expect(node.content).toBeUndefined();
      expect(node.endTime).toBe('2024-01-15T10:30:45.000Z');
    }
  );

  it(
    'keeps node running when answer is string "null" (void handle interaction)',
    {
      meta: {
        alias: 'ApplyOutgoing-StringNullKeepsRunning',
        scenario:
          'Running node receives outgoing with answer "null" (from stop/pause/resume/interject)',
        behavior:
          'Status stays running — string "null" is a void-returning handle interaction, not a completion',
      },
    },
    () => {
      const node: ActionNode = {
        id: 'call-1',
        type: 'manager',
        label: 'Taking Action',
        hierarchy: ['CodeActActor.act'],
        hierarchyLabel: 'CodeActActor.act(a1b2)',
        status: 'running',
        startTime: '2024-01-15T10:30:00.000Z',
        children: [],
      };

      const outgoingEvent = parseManagerMethodLog(
        createMockLog({
          ts: '2024-01-15T10:30:03.000Z',
          entries: {
            manager: 'CodeActActor',
            method: 'act',
            phase: 'outgoing',
            callingId: 'call-1',
            hierarchy: ['CodeActActor.act'],
            hierarchyLabel: 'CodeActActor.act(a1b2)',
            answer: 'null',
            status: 'ok',
          },
        })
      )!;

      applyOutgoingEvent(node, outgoingEvent);

      expect(node.status).toBe('running');
      expect(node.endTime).toBeUndefined();
    }
  );
});

// =============================================================================
// buildActionTree Tests
// =============================================================================

describe('buildActionTree', () => {
  it(
    'builds a flat tree from single root event',
    {
      meta: {
        alias: 'BuildTree-SingleRoot',
        scenario: 'One incoming event with depth 1 hierarchy',
        behavior: 'Tree has single root node',
      },
    },
    () => {
      const logs = [
        createMockLog({
          ts: '2024-01-15T10:30:00.000Z',
          entries: {
            manager: 'CodeActActor',
            method: 'act',
            phase: 'incoming',
            callingId: 'root-1',
            hierarchy: ['CodeActActor.act'],
            hierarchyLabel: 'CodeActActor.act(r001)',
            question: 'Find John',
            status: 'ok',
          },
        }),
      ];

      const { roots, nodeMap } = buildActionTree(logs);

      expect(roots).toHaveLength(1);
      expect(roots[0].id).toBe('root-1');
      expect(roots[0].label).toBe('CodeActActor.act');
      expect(roots[0].status).toBe('running');
      expect(nodeMap.size).toBe(1);
    }
  );

  it(
    'builds nested tree from parent-child events',
    {
      meta: {
        alias: 'BuildTree-Nested',
        scenario: 'Parent and child events with different hierarchies',
        behavior: 'Child is nested under parent',
      },
    },
    () => {
      const logs = [
        createMockLog({
          ts: '2024-01-15T10:30:00.000Z',
          entries: {
            manager: 'CodeActActor',
            method: 'act',
            phase: 'incoming',
            callingId: 'root-1',
            hierarchy: ['CodeActActor.act'],
            hierarchyLabel: 'CodeActActor.act(r001)',
            status: 'ok',
          },
        }),
        createMockLog({
          id: 2,
          ts: '2024-01-15T10:30:01.000Z',
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'incoming',
            callingId: 'child-1',
            hierarchy: ['CodeActActor.act', 'ContactManager.ask'],
            hierarchyLabel: 'CodeActActor.act->ContactManager.ask(c001)',
            question: 'Find John',
            status: 'ok',
          },
        }),
      ];

      const { roots } = buildActionTree(logs);

      expect(roots).toHaveLength(1);
      expect(roots[0].children).toHaveLength(1);
      expect(roots[0].children[0].id).toBe('child-1');
      expect(roots[0].children[0].label).toBe('ContactManager.ask');
    }
  );

  it(
    'matches incoming/outgoing pairs by calling_id',
    {
      meta: {
        alias: 'BuildTree-MatchPairs',
        scenario: 'Incoming and outgoing events for same calling_id',
        behavior: 'Node status updated to completed',
      },
    },
    () => {
      const logs = [
        createMockLog({
          ts: '2024-01-15T10:30:00.000Z',
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'incoming',
            callingId: 'call-1',
            hierarchy: ['ContactManager.ask'],
            hierarchyLabel: 'ContactManager.ask(c001)',
            question: 'Find John',
            status: 'ok',
          },
        }),
        createMockLog({
          id: 2,
          ts: '2024-01-15T10:30:05.000Z',
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'outgoing',
            callingId: 'call-1',
            hierarchy: ['ContactManager.ask'],
            hierarchyLabel: 'ContactManager.ask(c001)',
            answer: 'Found 3 contacts',
            status: 'ok',
          },
        }),
      ];

      const { roots } = buildActionTree(logs);

      expect(roots).toHaveLength(1);
      expect(roots[0].status).toBe('completed');
      expect(roots[0].content).toBe('Found 3 contacts');
    }
  );

  it(
    'handles out-of-order events (outgoing before incoming)',
    {
      meta: {
        alias: 'BuildTree-OutOfOrder',
        scenario: 'Outgoing event arrives before incoming (sorted by timestamp)',
        behavior: 'Both events matched correctly after sorting',
      },
    },
    () => {
      // Events arrive out of order but timestamps are correct
      const logs = [
        createMockLog({
          id: 2,
          ts: '2024-01-15T10:30:05.000Z', // Later timestamp
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'outgoing',
            callingId: 'call-1',
            hierarchy: ['ContactManager.ask'],
            hierarchyLabel: 'ContactManager.ask(c001)',
            answer: 'Found 3 contacts',
            status: 'ok',
          },
        }),
        createMockLog({
          id: 1,
          ts: '2024-01-15T10:30:00.000Z', // Earlier timestamp
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'incoming',
            callingId: 'call-1',
            hierarchy: ['ContactManager.ask'],
            hierarchyLabel: 'ContactManager.ask(c001)',
            question: 'Find John',
            status: 'ok',
          },
        }),
      ];

      const { roots } = buildActionTree(logs);

      // After sorting by timestamp, incoming comes first, then outgoing
      expect(roots).toHaveLength(1);
      expect(roots[0].status).toBe('completed');
    }
  );

  it(
    'stores orphan outgoing events and matches when incoming arrives',
    {
      meta: {
        alias: 'BuildTree-OrphanOutgoing',
        scenario: 'Outgoing event arrives with same timestamp as incoming but processed first',
        behavior: 'Orphan is stored and matched when incoming is processed',
      },
    },
    () => {
      // Same timestamp but outgoing in array first
      const logs = [
        createMockLog({
          id: 2,
          ts: '2024-01-15T10:30:00.000Z',
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'outgoing',
            callingId: 'call-1',
            hierarchy: ['ContactManager.ask'],
            hierarchyLabel: 'ContactManager.ask(c001)',
            answer: 'Result',
            status: 'ok',
          },
        }),
        createMockLog({
          id: 1,
          ts: '2024-01-15T10:30:00.000Z', // Same timestamp
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'incoming',
            callingId: 'call-1',
            hierarchy: ['ContactManager.ask'],
            hierarchyLabel: 'ContactManager.ask(c001)',
            question: 'Find John',
            status: 'ok',
          },
        }),
      ];

      const { roots, orphanOutgoing } = buildActionTree(logs);

      // The orphan should have been matched
      expect(roots).toHaveLength(1);
      expect(roots[0].status).toBe('completed');
      expect(orphanOutgoing).toHaveLength(0);
    }
  );

  it(
    'creates boundary nodes for execute_code segments',
    {
      meta: {
        alias: 'BuildTree-BoundaryNodes',
        scenario: 'Hierarchy includes execute_code segment',
        behavior: 'Intermediate boundary node is created',
      },
    },
    () => {
      const logs = [
        createMockLog({
          ts: '2024-01-15T10:30:00.000Z',
          entries: {
            manager: 'CodeActActor',
            method: 'act',
            phase: 'incoming',
            callingId: 'root-1',
            hierarchy: ['CodeActActor.act'],
            hierarchyLabel: 'CodeActActor.act(r001)',
            status: 'ok',
          },
        }),
        createMockLog({
          id: 2,
          ts: '2024-01-15T10:30:01.000Z',
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'incoming',
            callingId: 'child-1',
            hierarchy: ['CodeActActor.act', 'execute_code', 'ContactManager.ask'],
            hierarchyLabel: 'CodeActActor.act->execute_code->ContactManager.ask(c001)',
            question: 'Find John',
            status: 'ok',
          },
        }),
      ];

      const { roots } = buildActionTree(logs);

      expect(roots).toHaveLength(1);
      expect(roots[0].children).toHaveLength(1);
      // The intermediate boundary node
      expect(roots[0].children[0].label).toBe('execute_code');
      expect(roots[0].children[0].type).toBe('boundary');
      // The actual manager node
      expect(roots[0].children[0].children).toHaveLength(1);
      expect(roots[0].children[0].children[0].label).toBe('ContactManager.ask');
    }
  );

  it(
    'handles multiple root-level sibling actions',
    {
      meta: {
        alias: 'BuildTree-MultipleSiblings',
        scenario: 'Two separate root actions',
        behavior: 'Both appear as root nodes',
      },
    },
    () => {
      const logs = [
        createMockLog({
          ts: '2024-01-15T10:30:00.000Z',
          entries: {
            manager: 'CodeActActor',
            method: 'act',
            phase: 'incoming',
            callingId: 'root-1',
            hierarchy: ['CodeActActor.act'],
            hierarchyLabel: 'CodeActActor.act(r001)',
            status: 'ok',
          },
        }),
        createMockLog({
          id: 2,
          ts: '2024-01-15T10:31:00.000Z',
          entries: {
            manager: 'CodeActActor',
            method: 'act',
            phase: 'incoming',
            callingId: 'root-2',
            hierarchy: ['CodeActActor.act'],
            hierarchyLabel: 'CodeActActor.act(r002)',
            status: 'ok',
          },
        }),
      ];

      const { roots } = buildActionTree(logs);

      expect(roots).toHaveLength(2);
      expect(roots[0].id).toBe('root-1');
      expect(roots[1].id).toBe('root-2');
    }
  );

  it(
    'returns empty tree for empty input',
    {
      meta: {
        alias: 'BuildTree-Empty',
        scenario: 'No logs provided',
        behavior: 'Returns empty roots and nodeMap',
      },
    },
    () => {
      const { roots, nodeMap } = buildActionTree([]);

      expect(roots).toHaveLength(0);
      expect(nodeMap.size).toBe(0);
    }
  );

  it(
    'keeps meaningful answer when multiple outgoings arrive (initial poll)',
    {
      meta: {
        alias: 'BuildTree-MultiOutgoing',
        scenario: 'Unity emits incoming + many outgoings with "false", real answer, then "true"',
        behavior: 'Node content is the real answer, not the last trivial signal',
      },
    },
    () => {
      const logs = [
        createMockLog({
          id: 1,
          ts: '2024-01-15T10:30:00.000Z',
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'incoming',
            callingId: 'call-1',
            hierarchy: ['ContactManager.ask'],
            hierarchyLabel: 'ContactManager.ask(f97b)',
            question: 'List all contacts',
            status: 'ok',
            displayLabel: 'Checking Contact Book',
          },
        }),
        createMockLog({
          id: 2,
          ts: '2024-01-15T10:30:03.000Z',
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'outgoing',
            callingId: 'call-1',
            hierarchy: ['ContactManager.ask'],
            hierarchyLabel: 'ContactManager.ask(709e)',
            answer: 'false',
            status: 'ok',
          },
        }),
        createMockLog({
          id: 3,
          ts: '2024-01-15T10:30:05.000Z',
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'outgoing',
            callingId: 'call-1',
            hierarchy: ['ContactManager.ask'],
            hierarchyLabel: 'ContactManager.ask(709e)',
            answer: 'Here are all 4 contacts on file...',
            status: 'ok',
          },
        }),
        createMockLog({
          id: 4,
          ts: '2024-01-15T10:30:06.000Z',
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'outgoing',
            callingId: 'call-1',
            hierarchy: ['ContactManager.ask'],
            hierarchyLabel: 'ContactManager.ask(709e)',
            answer: 'true',
            status: 'ok',
          },
        }),
      ];

      const { roots } = buildActionTree(logs);

      expect(roots).toHaveLength(1);
      expect(roots[0].status).toBe('completed');
      expect(roots[0].content).toBe('Here are all 4 contacts on file...');
      expect(roots[0].endTime).toBe('2024-01-15T10:30:06.000Z');
    }
  );

  it(
    'preserves multiple sibling children with the same hierarchy path',
    {
      meta: {
        alias: 'BuildTree-MultipleSiblingChildren',
        scenario: 'Three execute_code children under CodeActActor.act with different callingIds',
        behavior:
          'All three are preserved as separate siblings, not replaced by boundary-matching logic',
      },
    },
    () => {
      const logs: ManagerMethodLog[] = [
        // Root incoming
        createMockLog({
          id: 1,
          ts: '2024-01-15T15:13:53.000Z',
          entries: {
            manager: 'CodeActActor',
            method: 'act',
            phase: 'incoming',
            callingId: 'root-1',
            hierarchy: ['CodeActActor.act'],
            hierarchyLabel: 'CodeActActor.act(4501)',
            displayLabel: 'Taking Action',
            status: 'ok',
          },
        }),
        // Child 1 incoming
        createMockLog({
          id: 2,
          ts: '2024-01-15T15:14:50.000Z',
          entries: {
            manager: 'CodeActActor',
            method: 'execute_code',
            phase: 'incoming',
            callingId: 'child-1',
            hierarchy: ['CodeActActor.act', 'execute_code'],
            hierarchyLabel: 'CodeActActor.act->execute_code(b21f)',
            displayLabel: 'Running Code',
            status: 'ok',
          },
        }),
        // Child 1 outgoing (answer: null → completed)
        createMockLog({
          id: 3,
          ts: '2024-01-15T15:15:28.000Z',
          entries: {
            manager: 'CodeActActor',
            method: 'execute_code',
            phase: 'outgoing',
            callingId: 'child-1',
            hierarchy: ['CodeActActor.act', 'execute_code'],
            hierarchyLabel: 'CodeActActor.act->execute_code(b21f)',
            status: 'ok',
          },
        }),
        // Child 2 incoming — same hierarchy, different callingId
        createMockLog({
          id: 4,
          ts: '2024-01-15T15:15:44.000Z',
          entries: {
            manager: 'CodeActActor',
            method: 'execute_code',
            phase: 'incoming',
            callingId: 'child-2',
            hierarchy: ['CodeActActor.act', 'execute_code'],
            hierarchyLabel: 'CodeActActor.act->execute_code(d172)',
            displayLabel: 'Running Code',
            status: 'ok',
          },
        }),
        // Child 2 outgoing
        createMockLog({
          id: 5,
          ts: '2024-01-15T15:16:16.000Z',
          entries: {
            manager: 'CodeActActor',
            method: 'execute_code',
            phase: 'outgoing',
            callingId: 'child-2',
            hierarchy: ['CodeActActor.act', 'execute_code'],
            hierarchyLabel: 'CodeActActor.act->execute_code(d172)',
            status: 'ok',
          },
        }),
        // Child 3 incoming — same hierarchy, different callingId
        createMockLog({
          id: 6,
          ts: '2024-01-15T15:16:32.000Z',
          entries: {
            manager: 'CodeActActor',
            method: 'execute_code',
            phase: 'incoming',
            callingId: 'child-3',
            hierarchy: ['CodeActActor.act', 'execute_code'],
            hierarchyLabel: 'CodeActActor.act->execute_code(36c4)',
            displayLabel: 'Running Code',
            status: 'ok',
          },
        }),
        // Child 3 outgoing
        createMockLog({
          id: 7,
          ts: '2024-01-15T15:17:17.000Z',
          entries: {
            manager: 'CodeActActor',
            method: 'execute_code',
            phase: 'outgoing',
            callingId: 'child-3',
            hierarchy: ['CodeActActor.act', 'execute_code'],
            hierarchyLabel: 'CodeActActor.act->execute_code(36c4)',
            status: 'ok',
          },
        }),
        // Root outgoing (final answer)
        createMockLog({
          id: 8,
          ts: '2024-01-15T15:17:51.000Z',
          entries: {
            manager: 'CodeActActor',
            method: 'act',
            phase: 'outgoing',
            callingId: 'root-1',
            hierarchy: ['CodeActActor.act'],
            hierarchyLabel: 'CodeActActor.act(4501)',
            answer: 'Here is the AAPL quote...',
            status: 'ok',
          },
        }),
      ];

      const { roots, nodeMap } = buildActionTree(logs);

      // 1 root node
      expect(roots).toHaveLength(1);
      const root = roots[0];
      expect(root.id).toBe('root-1');
      expect(root.label).toBe('Taking Action');
      expect(root.status).toBe('completed');

      // 3 distinct children — NOT replaced by boundary matching
      expect(root.children).toHaveLength(3);
      expect(root.children[0].id).toBe('child-1');
      expect(root.children[1].id).toBe('child-2');
      expect(root.children[2].id).toBe('child-3');

      // All children are 'manager' type, not 'boundary'
      for (const child of root.children) {
        expect(child.type).toBe('manager');
        expect(child.label).toBe('Running Code');
        expect(child.status).toBe('completed');
      }

      // All 4 nodes in nodeMap (1 root + 3 children)
      expect(nodeMap.size).toBe(4);
      expect(nodeMap.has('root-1')).toBe(true);
      expect(nodeMap.has('child-1')).toBe(true);
      expect(nodeMap.has('child-2')).toBe(true);
      expect(nodeMap.has('child-3')).toBe(true);
    }
  );

  it(
    'discards phase=null action events from tree building',
    {
      meta: {
        alias: 'BuildTree-ActionEventsDiscarded',
        scenario: 'Log stream includes phase=null action events alongside incoming events',
        behavior: 'Action events are silently discarded; only the incoming event creates a node',
      },
    },
    () => {
      const logs = [
        createMockLog({
          id: 1,
          ts: '2024-01-15T10:30:00.000Z',
          entries: {
            manager: 'CodeActActor',
            method: 'act',
            phase: 'incoming',
            callingId: 'root-1',
            hierarchy: ['CodeActActor.act'],
            hierarchyLabel: 'CodeActActor.act(r001)',
            displayLabel: 'Taking Action',
            status: 'ok',
          },
        }),
        createMockLog({
          id: 2,
          ts: '2024-01-15T10:30:10.000Z',
          entries: {
            manager: 'CodeActActor',
            method: 'act',
            phase: null,
            callingId: 'root-1',
            hierarchy: ['CodeActActor.act'],
            hierarchyLabel: 'CodeActActor.act(r001)',
            action: 'interject',
            instructions: 'Focus on AAPL only',
            status: 'ok',
          },
        }),
      ];

      const { roots } = buildActionTree(logs);

      expect(roots).toHaveLength(1);
      expect(roots[0].id).toBe('root-1');
    }
  );
});

// =============================================================================
// mergeNewEvents Tests
// =============================================================================

describe('mergeNewEvents', () => {
  it(
    'adds new root node to empty tree',
    {
      meta: {
        alias: 'MergeEvents-NewRoot',
        scenario: 'Empty tree receives new incoming event',
        behavior: 'New root node added',
      },
    },
    () => {
      const roots: ActionNode[] = [];
      const nodeMap = new Map<string, ActionNode>();

      const newLogs = [
        createMockLog({
          ts: '2024-01-15T10:30:00.000Z',
          entries: {
            manager: 'CodeActActor',
            method: 'act',
            phase: 'incoming',
            callingId: 'new-root',
            hierarchy: ['CodeActActor.act'],
            hierarchyLabel: 'CodeActActor.act(n001)',
            status: 'ok',
          },
        }),
      ];

      const result = mergeNewEvents(roots, nodeMap, newLogs);

      expect(result.roots).toHaveLength(1);
      expect(result.roots[0].id).toBe('new-root');
      expect(result.nodeMap.has('new-root')).toBe(true);
    }
  );

  it(
    'updates existing node with outgoing event',
    {
      meta: {
        alias: 'MergeEvents-UpdateExisting',
        scenario: 'Existing running node receives outgoing',
        behavior: 'Node status updated to completed',
      },
    },
    () => {
      // Setup existing tree
      const existingNode: ActionNode = {
        id: 'call-1',
        type: 'manager',
        label: 'ContactManager.ask',
        hierarchy: ['ContactManager.ask'],
        hierarchyLabel: 'ContactManager.ask(c001)',
        status: 'running',
        startTime: '2024-01-15T10:30:00.000Z',
        children: [],
      };
      const roots: ActionNode[] = [existingNode];
      const nodeMap = new Map<string, ActionNode>([['call-1', existingNode]]);

      const newLogs = [
        createMockLog({
          ts: '2024-01-15T10:30:05.000Z',
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'outgoing',
            callingId: 'call-1',
            hierarchy: ['ContactManager.ask'],
            hierarchyLabel: 'ContactManager.ask(c001)',
            answer: 'Done',
            status: 'ok',
          },
        }),
      ];

      const result = mergeNewEvents(roots, nodeMap, newLogs);

      expect(result.roots[0].status).toBe('completed');
      expect(result.roots[0].content).toBe('Done');
    }
  );

  it(
    'preserves existing nodes when adding new ones',
    {
      meta: {
        alias: 'MergeEvents-PreserveExisting',
        scenario: 'Tree has existing nodes, new node added',
        behavior: 'Existing nodes remain unchanged',
      },
    },
    () => {
      const existingNode: ActionNode = {
        id: 'existing-1',
        type: 'manager',
        label: 'ContactManager.ask',
        hierarchy: ['ContactManager.ask'],
        hierarchyLabel: 'ContactManager.ask(e001)',
        status: 'completed',
        startTime: '2024-01-15T10:30:00.000Z',
        endTime: '2024-01-15T10:30:05.000Z',
        content: 'Done',
        children: [],
      };
      const roots: ActionNode[] = [existingNode];
      const nodeMap = new Map<string, ActionNode>([['existing-1', existingNode]]);

      const newLogs = [
        createMockLog({
          ts: '2024-01-15T10:31:00.000Z',
          entries: {
            manager: 'CodeActActor',
            method: 'act',
            phase: 'incoming',
            callingId: 'new-1',
            hierarchy: ['CodeActActor.act'],
            hierarchyLabel: 'CodeActActor.act(n001)',
            status: 'ok',
          },
        }),
      ];

      const result = mergeNewEvents(roots, nodeMap, newLogs);

      expect(result.roots).toHaveLength(2);
      expect(result.roots[0].id).toBe('existing-1');
      expect(result.roots[0].status).toBe('completed');
      expect(result.roots[1].id).toBe('new-1');
    }
  );

  it(
    'deduplicates incoming events with same callingId (SSE + polling overlap)',
    {
      meta: {
        alias: 'MergeEvents-Dedup',
        scenario: 'Same incoming event arrives via both SSE and polling',
        behavior: 'No duplicate node created, original preserved',
      },
    },
    () => {
      // Simulate: event first arrived via SSE and is already in the tree
      const existingNode: ActionNode = {
        id: 'call-dup',
        type: 'manager',
        label: 'Checking Contact Book',
        displayLabel: 'Checking Contact Book',
        hierarchy: ['CodeActActor.act', 'ContactManager.ask'],
        hierarchyLabel: 'CodeActActor.act->ContactManager.ask(d001)',
        status: 'running',
        startTime: '2024-01-15T10:30:00.000Z',
        children: [],
      };
      const rootNode: ActionNode = {
        id: 'root-1',
        type: 'manager',
        label: 'CodeActActor.act',
        hierarchy: ['CodeActActor.act'],
        hierarchyLabel: 'CodeActActor.act(r001)',
        status: 'running',
        startTime: '2024-01-15T10:29:59.000Z',
        children: [existingNode],
      };
      const roots: ActionNode[] = [rootNode];
      const nodeMap = new Map<string, ActionNode>([
        ['root-1', rootNode],
        ['call-dup', existingNode],
      ]);

      // Same event arrives again via polling
      const newLogs = [
        createMockLog({
          ts: '2024-01-15T10:30:00.000Z',
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'incoming',
            callingId: 'call-dup',
            hierarchy: ['CodeActActor.act', 'ContactManager.ask'],
            hierarchyLabel: 'CodeActActor.act->ContactManager.ask(d001)',
            question: 'Find John',
            status: 'ok',
            displayLabel: 'Checking Contact Book',
          },
        }),
      ];

      const result = mergeNewEvents(roots, nodeMap, newLogs);

      // Should NOT create a duplicate — still 1 root with 1 child
      expect(result.roots).toHaveLength(1);
      expect(result.roots[0].children).toHaveLength(1);
      expect(result.roots[0].children[0].id).toBe('call-dup');
      expect(result.nodeMap.size).toBe(2);
    }
  );

  it(
    'preserves meaningful content when duplicate outgoing arrives',
    {
      meta: {
        alias: 'MergeEvents-DedupOutgoing',
        scenario: 'Same outgoing event arrives for already-completed node',
        behavior: 'Node status and content remain unchanged',
      },
    },
    () => {
      const existingNode: ActionNode = {
        id: 'call-1',
        type: 'manager',
        label: 'ContactManager.ask',
        hierarchy: ['ContactManager.ask'],
        hierarchyLabel: 'ContactManager.ask(c001)',
        status: 'completed',
        startTime: '2024-01-15T10:30:00.000Z',
        endTime: '2024-01-15T10:30:05.000Z',
        content: 'Found 3 contacts',
        children: [],
      };
      const roots: ActionNode[] = [existingNode];
      const nodeMap = new Map<string, ActionNode>([['call-1', existingNode]]);

      // Same outgoing arrives again (duplicate from polling + SSE)
      const newLogs = [
        createMockLog({
          ts: '2024-01-15T10:30:05.000Z',
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'outgoing',
            callingId: 'call-1',
            hierarchy: ['ContactManager.ask'],
            hierarchyLabel: 'ContactManager.ask(c001)',
            answer: 'Found 3 contacts',
            status: 'ok',
          },
        }),
      ];

      const result = mergeNewEvents(roots, nodeMap, newLogs);

      expect(result.roots[0].status).toBe('completed');
      expect(result.roots[0].content).toBe('Found 3 contacts');
    }
  );

  it(
    'updates content from later outgoing with meaningful answer (multi-outgoing)',
    {
      meta: {
        alias: 'MergeEvents-MultiOutgoing',
        scenario:
          'Unity sends multiple outgoing events: first with trivial answer, then real answer',
        behavior: 'Content is updated to the real answer, trivial values are skipped',
      },
    },
    () => {
      const existingNode: ActionNode = {
        id: 'call-1',
        type: 'manager',
        label: 'ContactManager.ask',
        hierarchy: ['ContactManager.ask'],
        hierarchyLabel: 'ContactManager.ask(c001)',
        status: 'running',
        startTime: '2024-01-15T10:30:00.000Z',
        children: [],
      };
      const roots: ActionNode[] = [existingNode];
      const nodeMap = new Map<string, ActionNode>([['call-1', existingNode]]);

      // First outgoing: loop-continuation signal
      const firstOutgoing = [
        createMockLog({
          ts: '2024-01-15T10:30:03.000Z',
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'outgoing',
            callingId: 'call-1',
            hierarchy: ['ContactManager.ask'],
            hierarchyLabel: 'ContactManager.ask(c001)',
            answer: 'false',
            status: 'ok',
          },
        }),
      ];

      const afterFirst = mergeNewEvents(roots, nodeMap, firstOutgoing);

      // Trivial outgoing keeps node running (loop-control signal, not completion)
      expect(afterFirst.roots[0].status).toBe('running');
      expect(afterFirst.roots[0].content).toBeUndefined();

      // Second outgoing: the real answer
      const secondOutgoing = [
        createMockLog({
          ts: '2024-01-15T10:30:05.000Z',
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'outgoing',
            callingId: 'call-1',
            hierarchy: ['ContactManager.ask'],
            hierarchyLabel: 'ContactManager.ask(c001)',
            answer: 'Here are all 4 contacts on file...',
            status: 'ok',
          },
        }),
      ];

      const afterSecond = mergeNewEvents(afterFirst.roots, afterFirst.nodeMap, secondOutgoing);

      // Content should now have the real answer
      expect(afterSecond.roots[0].status).toBe('completed');
      expect(afterSecond.roots[0].content).toBe('Here are all 4 contacts on file...');

      // Third outgoing: completion signal "true" — should NOT overwrite
      const thirdOutgoing = [
        createMockLog({
          ts: '2024-01-15T10:30:06.000Z',
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'outgoing',
            callingId: 'call-1',
            hierarchy: ['ContactManager.ask'],
            hierarchyLabel: 'ContactManager.ask(c001)',
            answer: 'true',
            status: 'ok',
          },
        }),
      ];

      const afterThird = mergeNewEvents(afterSecond.roots, afterSecond.nodeMap, thirdOutgoing);

      // Content should still be the real answer
      expect(afterThird.roots[0].content).toBe('Here are all 4 contacts on file...');
      // endTime should be from the latest outgoing
      expect(afterThird.roots[0].endTime).toBe('2024-01-15T10:30:06.000Z');
    }
  );

  it(
    'does not clear toolLoopSteps on subsequent outgoing events',
    {
      meta: {
        alias: 'MergeEvents-ToolLoopPreserved',
        scenario: 'Node already completed, toolLoopSteps reloaded, then another outgoing arrives',
        behavior: 'toolLoopSteps not cleared again',
      },
    },
    () => {
      const existingNode: ActionNode = {
        id: 'call-1',
        type: 'manager',
        label: 'ContactManager.ask',
        hierarchy: ['ContactManager.ask'],
        hierarchyLabel: 'ContactManager.ask(c001)',
        status: 'completed',
        startTime: '2024-01-15T10:30:00.000Z',
        endTime: '2024-01-15T10:30:05.000Z',
        content: 'Found 3 contacts',
        children: [],
        toolLoopSteps: [{ id: 'step-1', type: 'llm', content: 'Thinking...' }],
        isToolLoopLoaded: true,
      };
      const roots: ActionNode[] = [existingNode];
      const nodeMap = new Map<string, ActionNode>([['call-1', existingNode]]);

      const newLogs = [
        createMockLog({
          ts: '2024-01-15T10:30:06.000Z',
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'outgoing',
            callingId: 'call-1',
            hierarchy: ['ContactManager.ask'],
            hierarchyLabel: 'ContactManager.ask(c001)',
            answer: 'true',
            status: 'ok',
          },
        }),
      ];

      const result = mergeNewEvents(roots, nodeMap, newLogs);

      // toolLoopSteps should be preserved (not cleared on subsequent outgoings)
      expect(result.roots[0].toolLoopSteps).toBeDefined();
      expect(result.roots[0].isToolLoopLoaded).toBe(true);
    }
  );

  it(
    'replaces boundary with real node when parent incoming arrives after child (out-of-order SSE)',
    {
      meta: {
        alias: 'MergeEvents-BoundaryReplacement',
        scenario:
          'Child incoming (ContactManager.ask) arrives via SSE before parent incoming (ContactManager.update). ' +
          'A boundary node is created for the parent. When the real parent incoming arrives, it should adopt the ' +
          "boundary's children and remove the boundary.",
        behavior: 'Child is nested under real parent; boundary is removed',
      },
    },
    () => {
      // Step 1: child incoming arrives first — creates boundary for parent
      const childIncoming = [
        createMockLog({
          ts: '2024-01-15T10:30:31.000Z',
          entries: {
            manager: 'ContactManager',
            method: 'ask',
            phase: 'incoming',
            callingId: 'child-1',
            hierarchy: ['ContactManager.update', 'ContactManager.ask'],
            hierarchyLabel: 'ContactManager.update->ContactManager.ask(aa4e)',
            status: 'ok',
          },
        }),
      ];

      const step1 = mergeNewEvents([], new Map(), childIncoming);

      // Should have one root — the boundary placeholder for ContactManager.update
      expect(step1.roots).toHaveLength(1);
      expect(step1.roots[0].type).toBe('boundary');
      expect(step1.roots[0].hierarchy).toEqual(['ContactManager.update']);
      expect(step1.roots[0].children).toHaveLength(1);
      expect(step1.roots[0].children[0].id).toBe('child-1');

      // Step 2: real parent incoming arrives
      const parentIncoming = [
        createMockLog({
          ts: '2024-01-15T10:30:00.000Z',
          entries: {
            manager: 'ContactManager',
            method: 'update',
            phase: 'incoming',
            callingId: 'parent-1',
            hierarchy: ['ContactManager.update'],
            hierarchyLabel: 'ContactManager.update(bb5f)',
            status: 'ok',
          },
        }),
      ];

      const step2 = mergeNewEvents(step1.roots, step1.nodeMap, parentIncoming);

      // Boundary should be replaced — only the real parent should be at root
      expect(step2.roots).toHaveLength(1);
      expect(step2.roots[0].id).toBe('parent-1');
      expect(step2.roots[0].type).toBe('manager');
      expect(step2.roots[0].label).toBe('Updating Contact Book');

      // Child should be adopted under the real parent
      expect(step2.roots[0].children).toHaveLength(1);
      expect(step2.roots[0].children[0].id).toBe('child-1');
    }
  );
});

// =============================================================================
// findNodeByCallingId Tests
// =============================================================================

describe('findNodeByCallingId', () => {
  it(
    'finds node at root level',
    {
      meta: {
        alias: 'FindNode-RootLevel',
        scenario: 'Node is at root of tree',
        behavior: 'Returns the node',
      },
    },
    () => {
      const roots: ActionNode[] = [
        {
          id: 'root-1',
          type: 'manager',
          label: 'Test',
          hierarchy: ['Test'],
          hierarchyLabel: 'Test(t1)',
          status: 'running',
          startTime: '2024-01-15T10:30:00.000Z',
          children: [],
        },
      ];

      const result = findNodeByCallingId(roots, 'root-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('root-1');
    }
  );

  it(
    'finds node in nested children',
    {
      meta: {
        alias: 'FindNode-Nested',
        scenario: 'Node is nested several levels deep',
        behavior: 'Returns the nested node',
      },
    },
    () => {
      const roots: ActionNode[] = [
        {
          id: 'root-1',
          type: 'manager',
          label: 'Root',
          hierarchy: ['Root'],
          hierarchyLabel: 'Root(r1)',
          status: 'running',
          startTime: '2024-01-15T10:30:00.000Z',
          children: [
            {
              id: 'child-1',
              type: 'boundary',
              label: 'execute_code',
              hierarchy: ['Root', 'execute_code'],
              hierarchyLabel: 'Root->execute_code',
              status: 'running',
              startTime: '2024-01-15T10:30:01.000Z',
              children: [
                {
                  id: 'grandchild-1',
                  type: 'manager',
                  label: 'Nested',
                  hierarchy: ['Root', 'execute_code', 'Nested'],
                  hierarchyLabel: 'Root->execute_code->Nested(n1)',
                  status: 'running',
                  startTime: '2024-01-15T10:30:02.000Z',
                  children: [],
                },
              ],
            },
          ],
        },
      ];

      const result = findNodeByCallingId(roots, 'grandchild-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('grandchild-1');
      expect(result!.label).toBe('Nested');
    }
  );

  it(
    'returns null when node not found',
    {
      meta: {
        alias: 'FindNode-NotFound',
        scenario: 'Searching for non-existent ID',
        behavior: 'Returns null',
      },
    },
    () => {
      const roots: ActionNode[] = [
        {
          id: 'root-1',
          type: 'manager',
          label: 'Test',
          hierarchy: ['Test'],
          hierarchyLabel: 'Test(t1)',
          status: 'running',
          startTime: '2024-01-15T10:30:00.000Z',
          children: [],
        },
      ];

      const result = findNodeByCallingId(roots, 'non-existent');

      expect(result).toBeNull();
    }
  );
});

// =============================================================================
// hasActiveRootAction Tests
// =============================================================================

describe('hasActiveRootAction', () => {
  it(
    'returns true when root node is running',
    {
      meta: {
        alias: 'HasActive-True',
        scenario: 'Root node has running status',
        behavior: 'Returns true',
      },
    },
    () => {
      const roots: ActionNode[] = [
        {
          id: 'root-1',
          type: 'manager',
          label: 'CodeActActor.act',
          hierarchy: ['CodeActActor.act'],
          hierarchyLabel: 'CodeActActor.act(r1)',
          status: 'running',
          startTime: '2024-01-15T10:30:00.000Z',
          children: [],
        },
      ];

      expect(hasActiveRootAction(roots)).toBe(true);
    }
  );

  it(
    'returns false when all root nodes completed',
    {
      meta: {
        alias: 'HasActive-False',
        scenario: 'All root nodes are completed',
        behavior: 'Returns false',
      },
    },
    () => {
      const roots: ActionNode[] = [
        {
          id: 'root-1',
          type: 'manager',
          label: 'CodeActActor.act',
          hierarchy: ['CodeActActor.act'],
          hierarchyLabel: 'CodeActActor.act(r1)',
          status: 'completed',
          startTime: '2024-01-15T10:30:00.000Z',
          endTime: '2024-01-15T10:30:05.000Z',
          children: [],
        },
      ];

      expect(hasActiveRootAction(roots)).toBe(false);
    }
  );

  it(
    'returns false for empty tree',
    {
      meta: {
        alias: 'HasActive-Empty',
        scenario: 'Tree is empty',
        behavior: 'Returns false',
      },
    },
    () => {
      expect(hasActiveRootAction([])).toBe(false);
    }
  );
});
