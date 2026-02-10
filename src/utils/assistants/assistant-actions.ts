/**
 * Utility Functions for Assistant Actions Panel
 *
 * Pure functions for:
 * - Parsing ManagerMethod logs from the API
 * - Building hierarchical action trees from events
 * - Merging new events into existing trees
 * - Querying and manipulating action nodes
 */

import type {
  ActionNode,
  ActionNodeType,
  ActionTreeResult,
  ManagerMethodLog,
  ParsedManagerMethodEvent,
} from '@/types/assistants/action';

// =============================================================================
// Event Parsing
// =============================================================================

/**
 * Parses a raw ManagerMethod log entry into a structured event.
 * Returns null if the log is missing required fields OR if it's a progress event.
 *
 * Event types:
 * - phase='incoming' - START of a manager method call (creates node)
 * - phase='outgoing' - END of a manager method call (closes node)
 * - phase=null with action - PROGRESS event (ignored for tree building)
 */
export function parseManagerMethodLog(log: ManagerMethodLog): ParsedManagerMethodEvent | null {
  const { entries } = log;

  // Validate required fields (camelCase after Orchestra client transformation)
  if (
    !entries ||
    !entries.callingId ||
    !entries.manager ||
    !entries.method ||
    !entries.hierarchy ||
    !entries.hierarchyLabel
  ) {
    return null;
  }

  // Only process 'incoming' and 'outgoing' events for tree building
  // Skip progress events (phase=null with action like 'done', 'next_clarification', etc.)
  if (entries.phase !== 'incoming' && entries.phase !== 'outgoing') {
    return null;
  }

  // Determine content based on phase
  let content: string | undefined;
  if (entries.phase === 'outgoing') {
    content = entries.answer;
  } else {
    content = entries.question || entries.instructions;
  }

  return {
    id: log.id,
    timestamp: log.ts,
    manager: entries.manager,
    method: entries.method,
    phase: entries.phase,
    callingId: entries.callingId,
    hierarchy: entries.hierarchy,
    hierarchyLabel: entries.hierarchyLabel,
    status: entries.status,
    content,
    error: entries.error,
  };
}

// =============================================================================
// Node Creation
// =============================================================================

/**
 * Determines the node type based on the label.
 */
function getNodeType(label: string): ActionNodeType {
  // Boundary nodes are intermediate segments like execute_code, execute_function
  if (label.startsWith('execute_')) {
    return 'boundary';
  }
  return 'manager';
}

/**
 * Creates an ActionNode from a parsed incoming event.
 */
export function createActionNode(event: ParsedManagerMethodEvent): ActionNode {
  const label = event.hierarchy[event.hierarchy.length - 1];

  return {
    id: event.callingId,
    type: getNodeType(label),
    label,
    hierarchy: event.hierarchy,
    hierarchyLabel: event.hierarchyLabel,
    status: 'running',
    startTime: event.timestamp,
    content: event.content,
    children: [],
  };
}

/**
 * Creates a boundary node for intermediate hierarchy segments.
 */
function createBoundaryNode(label: string, hierarchy: string[], timestamp: string): ActionNode {
  return {
    id: `boundary-${hierarchy.join('->')}`,
    type: 'boundary',
    label,
    hierarchy,
    hierarchyLabel: hierarchy.join('->'),
    status: 'running',
    startTime: timestamp,
    children: [],
  };
}

// =============================================================================
// Tree Manipulation
// =============================================================================

/**
 * Applies an outgoing event to a node, updating its status and content.
 */
export function applyOutgoingEvent(node: ActionNode, event: ParsedManagerMethodEvent): void {
  node.status = event.status === 'ok' ? 'completed' : 'error';
  node.endTime = event.timestamp;

  // Update content with answer if available
  if (event.content) {
    node.content = event.content;
  }

  // Clear tool loop steps when node completes (memory optimization)
  // This always runs since outgoing events always complete the node
  node.toolLoopSteps = undefined;
  node.isToolLoopLoaded = false;
}

/**
 * Finds a node by its calling_id in the tree.
 */
export function findNodeByCallingId(roots: ActionNode[], callingId: string): ActionNode | null {
  for (const root of roots) {
    if (root.id === callingId) {
      return root;
    }
    const found = findNodeByCallingIdRecursive(root.children, callingId);
    if (found) {
      return found;
    }
  }
  return null;
}

function findNodeByCallingIdRecursive(nodes: ActionNode[], callingId: string): ActionNode | null {
  for (const node of nodes) {
    if (node.id === callingId) {
      return node;
    }
    const found = findNodeByCallingIdRecursive(node.children, callingId);
    if (found) {
      return found;
    }
  }
  return null;
}

/**
 * Finds or creates the parent node for a given hierarchy.
 * Creates intermediate boundary nodes as needed.
 */
function findOrCreateParent(
  roots: ActionNode[],
  hierarchy: string[],
  timestamp: string
): { parent: ActionNode | null; siblings: ActionNode[] } {
  if (hierarchy.length <= 1) {
    // This is a root-level node
    return { parent: null, siblings: roots };
  }

  // Build the parent hierarchy path
  const parentHierarchy = hierarchy.slice(0, -1);

  // Find existing parent by matching hierarchy
  let current: ActionNode[] = roots;
  let parent: ActionNode | null = null;

  for (let i = 0; i < parentHierarchy.length; i++) {
    const segment = parentHierarchy[i];
    const targetHierarchy = parentHierarchy.slice(0, i + 1);

    // Look for existing node with matching hierarchy
    let found = current.find(
      (n) =>
        n.hierarchy.length === targetHierarchy.length &&
        n.hierarchy.every((h, idx) => h === targetHierarchy[idx])
    );

    if (!found) {
      // Create boundary node for missing segment
      found = createBoundaryNode(segment, targetHierarchy, timestamp);
      if (parent) {
        parent.children.push(found);
      } else {
        roots.push(found);
      }
    }

    parent = found;
    current = found.children;
  }

  return { parent, siblings: parent ? parent.children : roots };
}

/**
 * Inserts a node at the correct position in the tree based on its hierarchy.
 */
function insertNodeAtHierarchy(
  roots: ActionNode[],
  nodeMap: Map<string, ActionNode>,
  node: ActionNode
): void {
  const { siblings } = findOrCreateParent(roots, node.hierarchy, node.startTime);

  // Add to parent's children or to roots
  siblings.push(node);
  nodeMap.set(node.id, node);
}

// =============================================================================
// Tree Building
// =============================================================================

/**
 * Builds an action tree from a list of ManagerMethod logs.
 *
 * The algorithm:
 * 1. Sort events by timestamp
 * 2. For each incoming event: create node and insert at correct hierarchy position
 * 3. For each outgoing event: find matching node by calling_id and update status
 * 4. Store orphan outgoing events for later matching
 */
export function buildActionTree(logs: ManagerMethodLog[]): ActionTreeResult {
  const roots: ActionNode[] = [];
  const nodeMap = new Map<string, ActionNode>();
  const orphanOutgoing: ParsedManagerMethodEvent[] = [];

  // Parse and sort by timestamp
  const events = logs
    .map(parseManagerMethodLog)
    .filter((e): e is ParsedManagerMethodEvent => e !== null)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  for (const event of events) {
    if (event.phase === 'incoming') {
      const node = createActionNode(event);
      insertNodeAtHierarchy(roots, nodeMap, node);

      // Check for stored orphan outgoing that matches
      const orphanIndex = orphanOutgoing.findIndex((o) => o.callingId === event.callingId);
      if (orphanIndex !== -1) {
        const orphan = orphanOutgoing[orphanIndex];
        applyOutgoingEvent(node, orphan);
        orphanOutgoing.splice(orphanIndex, 1);
      }
    } else {
      // outgoing
      const existingNode = nodeMap.get(event.callingId);
      if (existingNode) {
        applyOutgoingEvent(existingNode, event);
      } else {
        // Store for later matching
        orphanOutgoing.push(event);
      }
    }
  }

  return { roots, nodeMap, orphanOutgoing };
}

/**
 * Merges new events into an existing tree.
 * Preserves existing nodes and their state.
 */
export function mergeNewEvents(
  existingRoots: ActionNode[],
  existingNodeMap: Map<string, ActionNode>,
  newLogs: ManagerMethodLog[]
): ActionTreeResult {
  // Clone the existing structures to avoid mutation issues
  const roots = [...existingRoots];
  const nodeMap = new Map(existingNodeMap);
  const orphanOutgoing: ParsedManagerMethodEvent[] = [];

  // Parse and sort new events
  const events = newLogs
    .map(parseManagerMethodLog)
    .filter((e): e is ParsedManagerMethodEvent => e !== null)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  for (const event of events) {
    if (event.phase === 'incoming') {
      // Skip if we already have this node
      if (nodeMap.has(event.callingId)) {
        continue;
      }

      const node = createActionNode(event);
      insertNodeAtHierarchy(roots, nodeMap, node);
    } else {
      // outgoing
      const existingNode = nodeMap.get(event.callingId);
      if (existingNode) {
        // Only update if still running
        if (existingNode.status === 'running') {
          applyOutgoingEvent(existingNode, event);
        }
      } else {
        // Store for later matching
        orphanOutgoing.push(event);
      }
    }
  }

  return { roots, nodeMap, orphanOutgoing };
}

// =============================================================================
// Tree Queries
// =============================================================================

/**
 * Checks if there's an active (running) root-level action.
 * An action tree is considered active when any root node has status 'running'.
 */
export function hasActiveRootAction(roots: ActionNode[]): boolean {
  return roots.some((root) => root.status === 'running');
}

/**
 * Gets the most recent active root action, if any.
 */
export function getActiveRootAction(roots: ActionNode[]): ActionNode | null {
  // Return the last running root (most recent)
  for (let i = roots.length - 1; i >= 0; i--) {
    if (roots[i].status === 'running') {
      return roots[i];
    }
  }
  return null;
}

/**
 * Parses a timestamp string, ensuring UTC interpretation.
 * Orchestra timestamps are UTC but may lack the 'Z' suffix.
 */
function parseTimestamp(ts: string): number {
  // If the timestamp doesn't have timezone info, append 'Z' to indicate UTC
  const normalized = ts.endsWith('Z') || ts.includes('+') || ts.includes('-', 10) ? ts : ts + 'Z';
  return new Date(normalized).getTime();
}

/**
 * Calculates the duration of a node in milliseconds.
 * For running nodes, calculates time since start.
 * For completed nodes, calculates start to end duration.
 */
export function getNodeDuration(node: ActionNode, now?: Date): number {
  const startTime = parseTimestamp(node.startTime);
  const endTime = node.endTime ? parseTimestamp(node.endTime) : (now || new Date()).getTime();
  return endTime - startTime;
}

/**
 * Formats a duration in milliseconds to a human-readable string.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = seconds / 60;
  return `${minutes.toFixed(1)}m`;
}

/**
 * Builds a timestamp filter for querying events from a specific time.
 */
export function buildTimestampFilter(startTime: string): string {
  return `ts >= '${startTime}'`;
}
