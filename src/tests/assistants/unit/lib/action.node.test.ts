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
      expect(node.hierarchy).toEqual(['CodeActActor.act', 'ContactManager.ask']);
      expect(node.hierarchyLabel).toBe('CodeActActor.act->ContactManager.ask(abc1)');
      expect(node.status).toBe('running');
      expect(node.startTime).toBe('2024-01-15T10:30:00.000Z');
      expect(node.endTime).toBeUndefined();
      expect(node.content).toBe('Find John');
      expect(node.children).toEqual([]);
    }
  );
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
    'clears toolLoopSteps when node completes',
    {
      meta: {
        alias: 'ApplyOutgoing-ClearsToolLoops',
        scenario: 'Node had loaded toolLoopSteps',
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
            status: 'ok',
          },
        })
      )!;

      applyOutgoingEvent(node, outgoingEvent);

      expect(node.toolLoopSteps).toBeUndefined();
      expect(node.isToolLoopLoaded).toBe(false);
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
