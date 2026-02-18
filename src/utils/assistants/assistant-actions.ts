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
    displayLabel: entries.displayLabel,
    eventId: entries.eventId,
    errorType: entries.errorType,
    traceback: entries.traceback,
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
 * Uses the Unity-provided displayLabel (human-readable) when available,
 * falling back to the raw hierarchy segment (e.g., "ContactManager.ask").
 */
export function createActionNode(event: ParsedManagerMethodEvent): ActionNode {
  const rawLabel = event.hierarchy[event.hierarchy.length - 1];

  return {
    id: event.callingId,
    type: getNodeType(rawLabel),
    label: event.displayLabel || rawLabel,
    displayLabel: event.displayLabel,
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
 * Returns true when content is a real answer — not a boolean loop-control
 * signal ("true"/"false") emitted by Unity at each iteration boundary.
 */
export function isMeaningfulContent(content: string | undefined): boolean {
  if (!content) return false;
  const trimmed = content.trim().toLowerCase();
  return (
    trimmed.length > 0 &&
    trimmed !== 'true' &&
    trimmed !== 'false' &&
    trimmed !== 'null' &&
    trimmed !== 'undefined'
  );
}

/**
 * Applies an outgoing event to a node, updating its status and content.
 *
 * Unity emits many outgoing events per calling_id: trivial loop-control
 * signals (answer="false"/"true") after each tool-loop iteration, plus the
 * real answer once the operation actually finishes. We must NOT mark the
 * node as completed on a trivial signal — otherwise the parent appears done
 * while its children are still running.
 *
 * Status transitions:
 *  - Error → always mark as 'error' (regardless of content)
 *  - Meaningful content → mark as 'completed'
 *  - Trivial content + already completed → keep 'completed', update endTime
 *  - Trivial content + still running → keep 'running', update endTime
 */
export function applyOutgoingEvent(node: ActionNode, event: ParsedManagerMethodEvent): void {
  const wasRunning = node.status === 'running';

  node.endTime = event.timestamp;

  // The outgoing event's hierarchyLabel carries the same suffix as ToolLoop
  // events (the incoming event's suffix diverges). Storing it here lets the
  // UI run a perfectly scoped ToolLoop query without fragile time filters.
  if (event.hierarchyLabel) {
    node.hierarchyLabel = event.hierarchyLabel;
  }

  if (event.status !== 'ok') {
    node.status = 'error';
    if (event.content) node.content = event.content;
  } else if (isMeaningfulContent(event.content)) {
    node.status = 'completed';
    node.content = event.content;
  }
  // Trivial outgoing (answer: "true"/"false"): don't change status.

  // Clear tool loop steps only on the first transition out of 'running'
  if (wasRunning && node.status !== 'running') {
    node.toolLoopSteps = undefined;
    node.isToolLoopLoaded = false;
  }
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
 *
 * When SSE events arrive out of order (child before parent), a boundary node
 * is created as a placeholder parent. When the real parent's incoming event
 * arrives later, we need to replace the boundary: adopt its children and
 * remove it from the tree.
 */
function insertNodeAtHierarchy(
  roots: ActionNode[],
  nodeMap: Map<string, ActionNode>,
  node: ActionNode
): void {
  const { siblings } = findOrCreateParent(roots, node.hierarchy, node.startTime);

  // Check if there's a boundary placeholder with the same hierarchy that
  // this real node should replace (out-of-order SSE delivery).
  const boundaryIdx = siblings.findIndex(
    (n) =>
      n.type === 'boundary' &&
      n.hierarchy.length === node.hierarchy.length &&
      n.hierarchy.every((h, idx) => h === node.hierarchy[idx])
  );

  if (boundaryIdx !== -1) {
    const boundary = siblings[boundaryIdx];
    node.children.push(...boundary.children);
    siblings.splice(boundaryIdx, 1);
    nodeMap.delete(boundary.id);
  }

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
      // outgoing — Unity sends multiple outgoings per calling_id;
      // applyOutgoingEvent is safe to call repeatedly (content is only
      // overwritten when the new value is meaningful).
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
 * Uses Orchestra's system-level `created_at` field (not `ts`, which
 * doesn't support filter expressions).
 */
export function buildTimestampFilter(startTime: string): string {
  return `created_at >= '${startTime}'`;
}

// =============================================================================
// Tree Filtering (for Live Actions Viewer)
// =============================================================================

/**
 * Filters an action tree based on a search term.
 *
 * When a node matches the search:
 * - The node is included
 * - All ancestor nodes are included (for context)
 * - All descendant nodes are included (to show what happened within)
 *
 * Search is case-insensitive and matches partial labels.
 *
 * @param roots - The root nodes of the action tree
 * @param searchTerm - The search term to filter by
 * @returns Filtered tree with matching nodes and their context
 */
export function filterActionTree(roots: ActionNode[], searchTerm: string): ActionNode[] {
  const trimmed = searchTerm.trim().toLowerCase();

  // Empty search returns original tree
  if (!trimmed) {
    return roots;
  }

  // First pass: mark all nodes that match or have matching descendants
  const matchingNodeIds = new Set<string>();
  const hasMatchingDescendant = new Map<string, boolean>();

  function checkMatches(node: ActionNode): boolean {
    // Check if this node matches
    const nodeMatches = node.label.toLowerCase().includes(trimmed);

    // Check if any children match
    let childMatches = false;
    for (const child of node.children) {
      if (checkMatches(child)) {
        childMatches = true;
      }
    }

    // If this node matches, mark it
    if (nodeMatches) {
      matchingNodeIds.add(node.id);
    }

    // Track if this node has matching descendants
    hasMatchingDescendant.set(node.id, childMatches);

    return nodeMatches || childMatches;
  }

  // Run first pass on all roots
  roots.forEach(checkMatches);

  // Second pass: build filtered tree
  function buildFilteredTree(nodes: ActionNode[]): ActionNode[] {
    const result: ActionNode[] = [];

    for (const node of nodes) {
      const nodeMatches = matchingNodeIds.has(node.id);
      const descendantMatches = hasMatchingDescendant.get(node.id) || false;

      if (nodeMatches || descendantMatches) {
        // This node should be included
        // If this node matches, include ALL children (unfiltered)
        // If only descendants match, filter children recursively
        const filteredChildren = nodeMatches
          ? node.children // Include all children when node itself matches
          : buildFilteredTree(node.children);

        result.push({
          ...node,
          children: filteredChildren,
        });
      }
    }

    return result;
  }

  return buildFilteredTree(roots);
}

// =============================================================================
// Node Counting (for Live Actions Viewer)
// =============================================================================

/**
 * Result of counting action nodes by status.
 */
export interface ActionNodeCounts {
  running: number;
  completed: number;
  error: number;
}

/**
 * Counts root-level action nodes by status.
 *
 * Only counts top-level nodes so the footer matches the visible items
 * in the action tree.
 */
export function countActionNodes(roots: ActionNode[]): ActionNodeCounts {
  const counts: ActionNodeCounts = {
    running: 0,
    completed: 0,
    error: 0,
  };

  for (const root of roots) {
    switch (root.status) {
      case 'running':
        counts.running++;
        break;
      case 'completed':
        counts.completed++;
        break;
      case 'error':
        counts.error++;
        break;
    }
  }

  return counts;
}

// =============================================================================
// Relative Time Formatting (for Live Actions Viewer)
// =============================================================================

/**
 * Formats a timestamp as a relative time string.
 *
 * - 0-5 seconds: "just now"
 * - 6-59 seconds: "Xs ago"
 * - 1-59 minutes: "Xm ago"
 * - 1+ hours: "Xh ago"
 *
 * @param timestamp - The timestamp to format (Date object or ISO string)
 * @returns Formatted relative time string
 */
export function formatRelativeTime(timestamp: Date | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  // 0-5 seconds: "just now"
  if (diffSeconds <= 5) {
    return 'just now';
  }

  // 6-59 seconds: "Xs ago"
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }

  // 1-59 minutes: "Xm ago"
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  // 1+ hours: "Xh ago"
  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours}h ago`;
}

// =============================================================================
// Expand/Collapse State Helpers (for Live Actions Viewer)
// =============================================================================

/**
 * Checks if all nodes in the tree are expanded.
 *
 * @param roots - The root nodes of the action tree
 * @param expandedNodeIds - Set of node IDs that are currently expanded
 * @returns True if all nodes are expanded
 */
export function areAllNodesExpanded(roots: ActionNode[], expandedNodeIds: Set<string>): boolean {
  function checkNode(node: ActionNode): boolean {
    // Manager nodes are expandable (ToolLoop content), as are nodes with children
    if ((node.children.length > 0 || node.type === 'manager') && !expandedNodeIds.has(node.id)) {
      return false;
    }

    return node.children.every(checkNode);
  }

  return roots.every(checkNode);
}

/**
 * Gets all node IDs in a tree.
 *
 * @param roots - The root nodes of the action tree
 * @returns Set of all node IDs
 */
export function getAllNodeIds(roots: ActionNode[]): Set<string> {
  const ids = new Set<string>();

  function collectIds(node: ActionNode): void {
    ids.add(node.id);
    node.children.forEach(collectIds);
  }

  roots.forEach(collectIds);
  return ids;
}

/**
 * Gets all nodes with children (expandable nodes).
 *
 * @param roots - The root nodes of the action tree
 * @returns Set of node IDs that have children
 */
export function getExpandableNodeIds(roots: ActionNode[]): Set<string> {
  const ids = new Set<string>();

  function collectExpandable(node: ActionNode): void {
    // Manager nodes are expandable (ToolLoop content), as are nodes with children
    if (node.children.length > 0 || node.type === 'manager') {
      ids.add(node.id);
    }
    node.children.forEach(collectExpandable);
  }

  roots.forEach(collectExpandable);
  return ids;
}
