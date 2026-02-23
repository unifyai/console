/**
 * Unit tests for Live Actions Viewer utility functions.
 *
 * Tests cover:
 * - filterActionTree: Filtering tree nodes by search term
 * - countActionNodes: Counting running/completed/error nodes
 * - formatRelativeTime: Formatting "Updated X ago" timestamps
 *
 * @group unit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ActionNode } from '@/types/assistants/action';
import {
  filterActionTree,
  countActionNodes,
  formatRelativeTime,
} from '@/utils/assistants/assistant-actions';

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Creates a mock ActionNode for testing.
 */
function createNode(
  id: string,
  label: string,
  status: 'running' | 'completed' | 'error' = 'completed',
  children: ActionNode[] = []
): ActionNode {
  return {
    id,
    type: 'manager',
    label,
    hierarchy: [label],
    hierarchyLabel: `${label}(${id})`,
    status,
    startTime: new Date().toISOString(),
    endTime: status !== 'running' ? new Date().toISOString() : undefined,
    children,
  };
}

/**
 * Creates a sample tree structure for testing:
 *
 * CodeActActor.act (running)
 * ├── execute_code (completed)
 * │   ├── ContactManager.ask (completed)
 * │   └── TaskManager.get (completed)
 * └── execute_function (running)
 *     └── SearchManager.search (running)
 */
function createSampleTree(): ActionNode[] {
  return [
    createNode('root-1', 'CodeActActor.act', 'running', [
      createNode('exec-1', 'execute_code', 'completed', [
        createNode('contact-1', 'ContactManager.ask', 'completed'),
        createNode('task-1', 'TaskManager.get', 'completed'),
      ]),
      createNode('func-1', 'execute_function', 'running', [
        createNode('search-1', 'SearchManager.search', 'running'),
      ]),
    ]),
  ];
}

// =============================================================================
// filterActionTree Tests
// =============================================================================

describe('filterActionTree', () => {
  describe('Empty Search', () => {
    it(
      'returns all nodes when search is empty string',
      {
        meta: {
          alias: 'Filter-EmptyString',
          scenario: 'Search term is empty string',
          behavior: 'Returns original tree unchanged',
        },
      },
      () => {
        const tree = createSampleTree();
        const result = filterActionTree(tree, '');

        expect(result).toEqual(tree);
      }
    );

    it(
      'returns all nodes when search is whitespace only',
      {
        meta: {
          alias: 'Filter-Whitespace',
          scenario: 'Search term is spaces only',
          behavior: 'Returns original tree unchanged',
        },
      },
      () => {
        const tree = createSampleTree();
        const result = filterActionTree(tree, '   ');

        expect(result).toEqual(tree);
      }
    );
  });

  describe('Basic Matching', () => {
    it(
      'matches nodes with exact label',
      {
        meta: {
          alias: 'Filter-ExactMatch',
          scenario: 'Search matches node label exactly',
          behavior: 'Node is included in results',
        },
      },
      () => {
        const tree = createSampleTree();
        const result = filterActionTree(tree, 'ContactManager.ask');

        // Should include root (ancestor), execute_code (ancestor), and ContactManager.ask (match)
        expect(result.length).toBe(1);
        expect(result[0].label).toBe('CodeActActor.act');
        expect(result[0].children[0].label).toBe('execute_code');
        expect(result[0].children[0].children.length).toBe(1);
        expect(result[0].children[0].children[0].label).toBe('ContactManager.ask');
      }
    );

    it(
      'matches nodes with partial label',
      {
        meta: {
          alias: 'Filter-PartialMatch',
          scenario: 'Search matches part of node label',
          behavior: 'Node is included in results',
        },
      },
      () => {
        const tree = createSampleTree();
        const result = filterActionTree(tree, 'Contact');

        // Should match ContactManager.ask
        expect(result.length).toBe(1);
        const executeCode = result[0].children.find((c) => c.label === 'execute_code');
        expect(executeCode).toBeDefined();
        expect(executeCode!.children.some((c) => c.label === 'ContactManager.ask')).toBe(true);
      }
    );

    it(
      'is case-insensitive',
      {
        meta: {
          alias: 'Filter-CaseInsensitive',
          scenario: 'Search with different case than label',
          behavior: 'Matches regardless of case',
        },
      },
      () => {
        const tree = createSampleTree();
        const resultLower = filterActionTree(tree, 'contact');
        const resultUpper = filterActionTree(tree, 'CONTACT');
        const resultMixed = filterActionTree(tree, 'CoNtAcT');

        // All should match ContactManager.ask
        expect(resultLower.length).toBe(1);
        expect(resultUpper.length).toBe(1);
        expect(resultMixed.length).toBe(1);
      }
    );
  });

  describe('Ancestor Inclusion', () => {
    it(
      'includes ancestor nodes of matches for context',
      {
        meta: {
          alias: 'Filter-IncludesAncestors',
          scenario: 'Search matches deeply nested node',
          behavior: 'All ancestor nodes are included',
        },
      },
      () => {
        const tree = createSampleTree();
        const result = filterActionTree(tree, 'SearchManager');

        // SearchManager.search is nested: root > execute_function > SearchManager.search
        // All ancestors should be included
        expect(result.length).toBe(1);
        expect(result[0].label).toBe('CodeActActor.act');
        expect(result[0].children.length).toBe(1);
        expect(result[0].children[0].label).toBe('execute_function');
        expect(result[0].children[0].children[0].label).toBe('SearchManager.search');
      }
    );
  });

  describe('Children Inclusion', () => {
    it(
      'includes all children of matched nodes',
      {
        meta: {
          alias: 'Filter-IncludesChildren',
          scenario: 'Search matches parent node',
          behavior: 'All descendant nodes are included',
        },
      },
      () => {
        const tree = createSampleTree();
        const result = filterActionTree(tree, 'execute_code');

        // execute_code has 2 children: ContactManager.ask and TaskManager.get
        // Both should be included
        expect(result.length).toBe(1);
        const executeCode = result[0].children.find((c) => c.label === 'execute_code');
        expect(executeCode).toBeDefined();
        expect(executeCode!.children.length).toBe(2);
        expect(executeCode!.children.map((c) => c.label)).toContain('ContactManager.ask');
        expect(executeCode!.children.map((c) => c.label)).toContain('TaskManager.get');
      }
    );
  });

  describe('Multiple Matches', () => {
    it(
      'returns all matching branches',
      {
        meta: {
          alias: 'Filter-MultipleMatches',
          scenario: 'Search matches multiple nodes',
          behavior: 'All matching nodes and their contexts are included',
        },
      },
      () => {
        const tree = createSampleTree();
        const result = filterActionTree(tree, 'Manager');

        // Should match ContactManager, TaskManager, and SearchManager
        expect(result.length).toBe(1);

        // Check that all manager nodes are included
        const flattenLabels = (nodes: ActionNode[]): string[] => {
          return nodes.flatMap((n) => [n.label, ...flattenLabels(n.children)]);
        };
        const labels = flattenLabels(result);

        expect(labels).toContain('ContactManager.ask');
        expect(labels).toContain('TaskManager.get');
        expect(labels).toContain('SearchManager.search');
      }
    );
  });

  describe('No Matches', () => {
    it(
      'returns empty array when no matches found',
      {
        meta: {
          alias: 'Filter-NoMatches',
          scenario: 'Search matches nothing in tree',
          behavior: 'Returns empty array',
        },
      },
      () => {
        const tree = createSampleTree();
        const result = filterActionTree(tree, 'XYZNotFound');

        expect(result).toEqual([]);
      }
    );
  });

  describe('Edge Cases', () => {
    it(
      'handles empty tree',
      {
        meta: {
          alias: 'Filter-EmptyTree',
          scenario: 'Tree is empty array',
          behavior: 'Returns empty array',
        },
      },
      () => {
        const result = filterActionTree([], 'search');
        expect(result).toEqual([]);
      }
    );

    it(
      'handles single node tree',
      {
        meta: {
          alias: 'Filter-SingleNode',
          scenario: 'Tree has only one node',
          behavior: 'Returns node if matches, empty if not',
        },
      },
      () => {
        const tree = [createNode('single', 'SingleManager.action')];

        const matchResult = filterActionTree(tree, 'Single');
        expect(matchResult.length).toBe(1);

        const noMatchResult = filterActionTree(tree, 'Other');
        expect(noMatchResult.length).toBe(0);
      }
    );
  });
});

// =============================================================================
// countActionNodes Tests
// =============================================================================

describe('countActionNodes', () => {
  describe('Empty Tree', () => {
    it(
      'returns zero counts for empty tree',
      {
        meta: {
          alias: 'Count-EmptyTree',
          scenario: 'No nodes in tree',
          behavior: 'Returns { running: 0, completed: 0, error: 0 }',
        },
      },
      () => {
        const result = countActionNodes([]);

        expect(result).toEqual({ running: 0, completed: 0, error: 0 });
      }
    );
  });

  describe('Flat Tree', () => {
    it(
      'counts single running node',
      {
        meta: {
          alias: 'Count-SingleRunning',
          scenario: 'Tree has one running node',
          behavior: 'Returns { running: 1, completed: 0, error: 0 }',
        },
      },
      () => {
        const tree = [createNode('1', 'Test', 'running')];
        const result = countActionNodes(tree);

        expect(result).toEqual({ running: 1, completed: 0, error: 0 });
      }
    );

    it(
      'counts single completed node',
      {
        meta: {
          alias: 'Count-SingleCompleted',
          scenario: 'Tree has one completed node',
          behavior: 'Returns { running: 0, completed: 1, error: 0 }',
        },
      },
      () => {
        const tree = [createNode('1', 'Test', 'completed')];
        const result = countActionNodes(tree);

        expect(result).toEqual({ running: 0, completed: 1, error: 0 });
      }
    );

    it(
      'counts single error node',
      {
        meta: {
          alias: 'Count-SingleError',
          scenario: 'Tree has one error node',
          behavior: 'Returns { running: 0, completed: 0, error: 1 }',
        },
      },
      () => {
        const tree = [createNode('1', 'Test', 'error')];
        const result = countActionNodes(tree);

        expect(result).toEqual({ running: 0, completed: 0, error: 1 });
      }
    );
  });

  describe('Nested Tree', () => {
    it(
      'counts all nodes at all levels',
      {
        meta: {
          alias: 'Count-AllLevels',
          scenario: 'Tree with multiple levels',
          behavior: 'Counts nodes regardless of depth',
        },
      },
      () => {
        const tree = createSampleTree();
        const result = countActionNodes(tree);

        // Sample tree has:
        // - running: CodeActActor.act, execute_function, SearchManager.search (3)
        // - completed: execute_code, ContactManager.ask, TaskManager.get (3)
        expect(result).toEqual({ running: 3, completed: 3, error: 0 });
      }
    );

    it(
      'counts deeply nested nodes',
      {
        meta: {
          alias: 'Count-DeepNesting',
          scenario: 'Tree with 5+ levels of nesting',
          behavior: 'Counts all nodes at any depth',
        },
      },
      () => {
        const tree = [
          createNode('1', 'L1', 'completed', [
            createNode('2', 'L2', 'completed', [
              createNode('3', 'L3', 'completed', [
                createNode('4', 'L4', 'completed', [createNode('5', 'L5', 'running')]),
              ]),
            ]),
          ]),
        ];
        const result = countActionNodes(tree);

        expect(result).toEqual({ running: 1, completed: 4, error: 0 });
      }
    );
  });

  describe('Multiple Root Nodes', () => {
    it(
      'counts across multiple root nodes',
      {
        meta: {
          alias: 'Count-MultipleRoots',
          scenario: 'Tree has multiple top-level nodes',
          behavior: 'Counts nodes from all roots',
        },
      },
      () => {
        const tree = [
          createNode('1', 'Root1', 'running'),
          createNode('2', 'Root2', 'completed'),
          createNode('3', 'Root3', 'error'),
        ];
        const result = countActionNodes(tree);

        expect(result).toEqual({ running: 1, completed: 1, error: 1 });
      }
    );
  });
});

// =============================================================================
// formatRelativeTime Tests
// =============================================================================

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Just Now', () => {
    it(
      'returns "just now" for 0 seconds ago',
      {
        meta: {
          alias: 'RelTime-Zero',
          scenario: 'Timestamp is now',
          behavior: 'Returns "just now"',
        },
      },
      () => {
        const now = new Date();
        vi.setSystemTime(now);

        const result = formatRelativeTime(now);
        expect(result).toBe('just now');
      }
    );

    it(
      'returns "just now" for 4 seconds ago',
      {
        meta: {
          alias: 'RelTime-4Seconds',
          scenario: 'Timestamp is 4 seconds ago',
          behavior: 'Returns "just now"',
        },
      },
      () => {
        const past = new Date('2024-01-15T10:00:00.000Z');
        const now = new Date('2024-01-15T10:00:04.000Z');
        vi.setSystemTime(now);

        const result = formatRelativeTime(past);
        expect(result).toBe('just now');
      }
    );

    it(
      'returns "just now" for 5 seconds ago',
      {
        meta: {
          alias: 'RelTime-5Seconds',
          scenario: 'Timestamp is exactly 5 seconds ago',
          behavior: 'Returns "just now"',
        },
      },
      () => {
        const past = new Date('2024-01-15T10:00:00.000Z');
        const now = new Date('2024-01-15T10:00:05.000Z');
        vi.setSystemTime(now);

        const result = formatRelativeTime(past);
        expect(result).toBe('just now');
      }
    );
  });

  describe('Seconds Ago', () => {
    it(
      'returns "Xs ago" for 6 seconds ago',
      {
        meta: {
          alias: 'RelTime-6Seconds',
          scenario: 'Timestamp is 6 seconds ago',
          behavior: 'Returns "6s ago"',
        },
      },
      () => {
        const past = new Date('2024-01-15T10:00:00.000Z');
        const now = new Date('2024-01-15T10:00:06.000Z');
        vi.setSystemTime(now);

        const result = formatRelativeTime(past);
        expect(result).toBe('6s ago');
      }
    );

    it(
      'returns "Xs ago" for 30 seconds ago',
      {
        meta: {
          alias: 'RelTime-30Seconds',
          scenario: 'Timestamp is 30 seconds ago',
          behavior: 'Returns "30s ago"',
        },
      },
      () => {
        const past = new Date('2024-01-15T10:00:00.000Z');
        const now = new Date('2024-01-15T10:00:30.000Z');
        vi.setSystemTime(now);

        const result = formatRelativeTime(past);
        expect(result).toBe('30s ago');
      }
    );

    it(
      'returns "Xs ago" for 59 seconds ago',
      {
        meta: {
          alias: 'RelTime-59Seconds',
          scenario: 'Timestamp is 59 seconds ago',
          behavior: 'Returns "59s ago"',
        },
      },
      () => {
        const past = new Date('2024-01-15T10:00:00.000Z');
        const now = new Date('2024-01-15T10:00:59.000Z');
        vi.setSystemTime(now);

        const result = formatRelativeTime(past);
        expect(result).toBe('59s ago');
      }
    );
  });

  describe('Minutes Ago', () => {
    it(
      'returns "Xm ago" for 60 seconds ago',
      {
        meta: {
          alias: 'RelTime-60Seconds',
          scenario: 'Timestamp is exactly 1 minute ago',
          behavior: 'Returns "1m ago"',
        },
      },
      () => {
        const past = new Date('2024-01-15T10:00:00.000Z');
        const now = new Date('2024-01-15T10:01:00.000Z');
        vi.setSystemTime(now);

        const result = formatRelativeTime(past);
        expect(result).toBe('1m ago');
      }
    );

    it(
      'returns "Xm ago" for 5 minutes ago',
      {
        meta: {
          alias: 'RelTime-5Minutes',
          scenario: 'Timestamp is 5 minutes ago',
          behavior: 'Returns "5m ago"',
        },
      },
      () => {
        const past = new Date('2024-01-15T10:00:00.000Z');
        const now = new Date('2024-01-15T10:05:00.000Z');
        vi.setSystemTime(now);

        const result = formatRelativeTime(past);
        expect(result).toBe('5m ago');
      }
    );

    it(
      'returns "Xm ago" for 59 minutes ago',
      {
        meta: {
          alias: 'RelTime-59Minutes',
          scenario: 'Timestamp is 59 minutes ago',
          behavior: 'Returns "59m ago"',
        },
      },
      () => {
        const past = new Date('2024-01-15T10:00:00.000Z');
        const now = new Date('2024-01-15T10:59:00.000Z');
        vi.setSystemTime(now);

        const result = formatRelativeTime(past);
        expect(result).toBe('59m ago');
      }
    );
  });

  describe('Hours Ago', () => {
    it(
      'returns "Xh ago" for 1 hour ago',
      {
        meta: {
          alias: 'RelTime-1Hour',
          scenario: 'Timestamp is exactly 1 hour ago',
          behavior: 'Returns "1h ago"',
        },
      },
      () => {
        const past = new Date('2024-01-15T10:00:00.000Z');
        const now = new Date('2024-01-15T11:00:00.000Z');
        vi.setSystemTime(now);

        const result = formatRelativeTime(past);
        expect(result).toBe('1h ago');
      }
    );

    it(
      'returns "Xh ago" for 3 hours ago',
      {
        meta: {
          alias: 'RelTime-3Hours',
          scenario: 'Timestamp is 3 hours ago',
          behavior: 'Returns "3h ago"',
        },
      },
      () => {
        const past = new Date('2024-01-15T10:00:00.000Z');
        const now = new Date('2024-01-15T13:00:00.000Z');
        vi.setSystemTime(now);

        const result = formatRelativeTime(past);
        expect(result).toBe('3h ago');
      }
    );
  });

  describe('Input Formats', () => {
    it(
      'accepts Date object',
      {
        meta: {
          alias: 'RelTime-DateObject',
          scenario: 'Input is Date object',
          behavior: 'Parses correctly',
        },
      },
      () => {
        const past = new Date('2024-01-15T10:00:00.000Z');
        const now = new Date('2024-01-15T10:00:30.000Z');
        vi.setSystemTime(now);

        const result = formatRelativeTime(past);
        expect(result).toBe('30s ago');
      }
    );

    it(
      'accepts ISO string',
      {
        meta: {
          alias: 'RelTime-ISOString',
          scenario: 'Input is ISO string',
          behavior: 'Parses correctly',
        },
      },
      () => {
        const now = new Date('2024-01-15T10:00:30.000Z');
        vi.setSystemTime(now);

        const result = formatRelativeTime('2024-01-15T10:00:00.000Z');
        expect(result).toBe('30s ago');
      }
    );
  });
});
