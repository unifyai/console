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
// Constants
// =============================================================================

/** Default lookback window for the action viewer (3 hours). */
export const ACTION_LOOKBACK_MS = 3 * 60 * 60 * 1000;

// =============================================================================
// Log Sorting
// =============================================================================

/**
 * Sort comparator for log entries (ManagerMethod or ToolLoop).
 * Sorts chronologically by eventTimestamp (falling back to ts), with database
 * id as a tiebreaker for entries that share the same timestamp.
 */
export function compareLogsByTime(
  a: { id: number; ts: string; entries: { eventTimestamp?: string } },
  b: { id: number; ts: string; entries: { eventTimestamp?: string } }
): number {
  const ta = new Date(a.entries.eventTimestamp || a.ts).getTime();
  const tb = new Date(b.entries.eventTimestamp || b.ts).getTime();
  return ta - tb || a.id - b.id;
}

// =============================================================================
// Event Parsing
// =============================================================================

/**
 * Parses a raw ManagerMethod log entry into a structured event.
 * Returns null if the log is missing required fields or has a non-lifecycle phase.
 *
 * Only lifecycle phases are accepted:
 * - phase='incoming'       — operation started (creates a tree node)
 * - phase='outgoing'       — operation returned a value (updates a tree node)
 * - phase='awaiting_input' — persist session yielded, waiting for interjection
 * - phase='resumed'        — persist session resumed after interjection
 */
export function parseManagerMethodLog(log: ManagerMethodLog): ParsedManagerMethodEvent | null {
  const { entries } = log;

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

  if (
    entries.phase !== 'incoming' &&
    entries.phase !== 'outgoing' &&
    entries.phase !== 'awaiting_input' &&
    entries.phase !== 'resumed'
  ) {
    return null;
  }

  let content: string | undefined;
  if (entries.phase === 'outgoing') {
    content = entries.answer;
  } else {
    content = entries.question || entries.instructions || entries.request;
  }

  const rawEntries = entries as unknown as Record<string, unknown>;

  return {
    id: log.id,
    timestamp: entries.eventTimestamp || log.ts,
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
    persist: rawEntries.persist === true ? true : undefined,
    taskName: typeof rawEntries.taskName === 'string' ? rawEntries.taskName : undefined,
  };
}

// =============================================================================
// Node Creation
// =============================================================================

/**
 * Creates an ActionNode from a parsed incoming event.
 * Uses the Unity-provided displayLabel (human-readable) when available,
 * falling back to the raw hierarchy segment (e.g., "ContactManager.ask").
 *
 * Type is always 'manager' — the 'boundary' type is exclusively assigned
 * by createBoundaryNode for SSE placeholder nodes.
 */
export function createActionNode(event: ParsedManagerMethodEvent): ActionNode {
  const rawLabel = event.hierarchy[event.hierarchy.length - 1];

  return {
    id: event.callingId,
    type: 'manager',
    label: event.displayLabel || rawLabel,
    displayLabel: event.displayLabel,
    persist: event.persist,
    hierarchy: event.hierarchy,
    hierarchyLabel: event.hierarchyLabel,
    status: 'running',
    startTime: event.timestamp,
    content: event.content,
    requestContent: event.content,
    children: [],
  };
}

const TASK_RUN_SEGMENT = /^Task\.run\(task_id=(\d+)(?:,[^)]*)?\)$/;

/**
 * Human label for one hierarchy segment. The `Task.run(...)` lineage segment
 * is machine identity — ids only, by design — so the name shown for it comes
 * from the `taskName` the nested events carry, falling back to the task id
 * until an event carrying the name arrives.
 */
function boundarySegmentLabel(segment: string, taskName?: string): string {
  const match = TASK_RUN_SEGMENT.exec(segment);
  if (!match) return segment;
  return taskName ? `Task run · ${taskName}` : `Task run #${match[1]}`;
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
 * Returns true when content is a real answer worth displaying — not a
 * boolean loop-control signal, null, undefined, or empty.
 * Used by the UI to decide whether to render node content.
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
 * Returns true for values that should NOT change a node's status.
 *
 * The _LoggedHandle proxy polls handle.done() repeatedly — each poll
 * publishes an outgoing ManagerMethod event with the coerced return value.
 *
 * - "false": handle.done() returned False — loop still running, ignore.
 * - "null":  _coerce_text_value(None) → json.dumps(None) → "null" string.
 *            Means a polling call returned Python None, not a completion.
 *
 * NOT trivial (these trigger completion):
 * - "true":  handle.done() returned True — the async task finished. This
 *            is a valid completion signal that ensures the node transitions
 *            to 'completed' even if a separate result() event hasn't arrived.
 * - JS null/undefined (field absent from payload): boundary wrapper
 *   (execute_code/execute_function) completed without setting answer.
 */
function isTrivialLoopSignal(content: string | undefined): boolean {
  if (content == null) return false;
  const trimmed = content.trim().toLowerCase();
  // "false" = intermediate loop iteration ("not done yet, more work to do")
  // "true"  = action completed ("done, result is ready") — NOT trivial
  return trimmed === 'false' || trimmed === 'null';
}

export function applyAwaitingInputEvent(node: ActionNode, event: ParsedManagerMethodEvent): void {
  if (node.status === 'completed' || node.status === 'error') return;
  node.status = 'awaiting';
  node.endTime = undefined;
  if (event.hierarchyLabel) {
    node.hierarchyLabel = event.hierarchyLabel;
  }
}

export function applyResumedEvent(node: ActionNode, event: ParsedManagerMethodEvent): void {
  if (node.status === 'completed' || node.status === 'error') return;
  node.status = 'running';
  node.endTime = undefined;
  if (event.hierarchyLabel) {
    node.hierarchyLabel = event.hierarchyLabel;
  }
}

/**
 * Applies an outgoing event to a node, updating its status and content.
 *
 * Unity emits many outgoing events per calling_id via the _LoggedHandle proxy.
 * Most are polling noise: handle.done() returning False → answer="false".
 * Only three patterns signal completion:
 *
 *  1. answer="true"  — handle.done() returned True, async task finished.
 *  2. answer=<string> — handle.result() returned the actual content.
 *  3. answer=null (JS) — boundary wrapper (execute_code) completed without
 *     setting an answer field.
 *
 * The string "null" (from json.dumps(None)) is NOT a completion — it means
 * a polling call returned Python None.
 *
 * Status transitions:
 *  - Error → always mark as 'error'
 *  - "false" / "null" (string) → trivial, don't change status
 *  - Everything else → mark as 'completed'; set content if meaningful
 */
export function applyOutgoingEvent(node: ActionNode, event: ParsedManagerMethodEvent): void {
  const wasActive = node.status === 'running' || node.status === 'awaiting';

  if (event.hierarchyLabel) {
    node.hierarchyLabel = event.hierarchyLabel;
  }

  if (event.status !== 'ok') {
    node.status = 'error';
    node.endTime = event.timestamp;
    if (event.content) node.content = event.content;
  } else if (isTrivialLoopSignal(event.content)) {
    // Boolean loop-control signal: don't change status or endTime.
  } else {
    node.status = 'completed';
    node.endTime = event.timestamp;
    if (isMeaningfulContent(event.content)) {
      node.content = event.content;
    }
  }

  // On the first transition out of 'running', clear lazy-loaded historical
  // data so it can be re-fetched with the complete set.  Preserve
  // liveToolLoopLogs — the UI uses them as a bridge until the lazy-loaded
  // historical data arrives, preventing content from vanishing on completion.
  if (wasActive && node.status !== 'running' && node.status !== 'awaiting') {
    node.toolLoopSteps = undefined;
    node.isToolLoopLoaded = false;
  }
}

function applyNodeUpdateEvent(
  node: ActionNode,
  event: ParsedManagerMethodEvent,
  roots: ActionNode[]
): void {
  if (event.phase === 'awaiting_input') {
    applyAwaitingInputEvent(node, event);
    return;
  }
  if (event.phase === 'resumed') {
    applyResumedEvent(node, event);
    return;
  }
  applyOutgoingEvent(node, event);
  if (node.status === 'completed' || node.status === 'error') {
    closeBoundaryAncestors(roots, node.hierarchy, node.endTime);
  }
}

function applyNodeUpdateOrOrphan(
  event: ParsedManagerMethodEvent,
  roots: ActionNode[],
  nodeMap: Map<string, ActionNode>,
  orphanOutgoing: ParsedManagerMethodEvent[],
  promotedCallingIds: string[]
): void {
  const existingNode = nodeMap.get(event.callingId);
  if (existingNode) {
    applyNodeUpdateEvent(existingNode, event, roots);
    return;
  }

  const boundaryNode = findBoundaryByHierarchy(roots, event.hierarchy);
  if (boundaryNode) {
    promoteBoundaryNode(boundaryNode, event, nodeMap);
    promotedCallingIds.push(event.callingId);
    applyNodeUpdateEvent(boundaryNode, event, roots);
    return;
  }

  orphanOutgoing.push(event);
}

/**
 * Searches the tree for a boundary placeholder whose hierarchy exactly matches
 * the given hierarchy. Used when an outgoing event's calling_id doesn't match
 * any node in the nodeMap — the node might exist as a boundary created by
 * findOrCreateParent when a child arrived before the parent's incoming event.
 */
function findBoundaryByHierarchy(nodes: ActionNode[], hierarchy: string[]): ActionNode | null {
  for (const node of nodes) {
    if (
      node.type === 'boundary' &&
      node.hierarchy.length === hierarchy.length &&
      node.hierarchy.every((h, idx) => h === hierarchy[idx])
    ) {
      return node;
    }
    const found = findBoundaryByHierarchy(node.children, hierarchy);
    if (found) return found;
  }
  return null;
}

function isTerminalNodeStatus(status: ActionNode['status']): boolean {
  return status === 'completed' || status === 'error';
}

/**
 * Closes boundary placeholder ancestors once every child under them has
 * reached a terminal status.
 *
 * The `Task.run(...)` lineage segment (and any other intermediate hierarchy
 * segment) is represented by a synthetic boundary node (createBoundaryNode)
 * that never receives its own incoming/outgoing event pair — Unity emits
 * events for the real manager calls nested under it, not for the boundary
 * itself. Without this, a boundary node stays 'running' forever even after
 * everything beneath it finishes. Walks upward one hierarchy segment at a
 * time so a chain of nested boundaries all close together as the last live
 * child under them finishes.
 */
function closeBoundaryAncestors(roots: ActionNode[], hierarchy: string[], endTime?: string): void {
  let ancestorHierarchy = hierarchy.slice(0, -1);

  while (ancestorHierarchy.length > 0) {
    const boundary = findBoundaryByHierarchy(roots, ancestorHierarchy);
    if (!boundary || isTerminalNodeStatus(boundary.status)) break;
    if (
      boundary.children.length === 0 ||
      !boundary.children.every((child) => isTerminalNodeStatus(child.status))
    ) {
      break;
    }

    boundary.status = 'completed';
    boundary.endTime = endTime;

    ancestorHierarchy = ancestorHierarchy.slice(0, -1);
  }
}

/**
 * Enriches an already-existing node with data from its backfilled incoming
 * event. When a node was promoted from a boundary, it has the calling_id,
 * displayLabel, and status from outgoing events — but it's missing the true
 * startTime and the content (question/instructions) that only the incoming
 * event carries.
 */
function applyBackfilledIncoming(node: ActionNode, event: ParsedManagerMethodEvent): void {
  const incomingTime = new Date(event.timestamp).getTime();
  const existingTime = new Date(node.startTime).getTime();
  if (incomingTime < existingTime) {
    node.startTime = event.timestamp;
  }
  if (!node.content && event.content) {
    node.content = event.content;
  }
  if (!node.requestContent && event.content) {
    node.requestContent = event.content;
  }
  if (event.displayLabel && event.displayLabel.trim()) {
    node.label = event.displayLabel;
    node.displayLabel = event.displayLabel;
  }
}

/**
 * Promotes a boundary placeholder to a real manager node using data from an
 * outgoing event. Updates the nodeMap so subsequent events can find it by
 * calling_id directly.
 *
 * This handles the case where the initial fetch from Orchestra doesn't
 * include the incoming event (it's older than the fetch window), but does
 * include outgoing events and child nodes that caused the boundary to be
 * created.
 */
function promoteBoundaryNode(
  node: ActionNode,
  event: ParsedManagerMethodEvent,
  nodeMap: Map<string, ActionNode>
): void {
  const oldId = node.id;
  node.id = event.callingId;
  node.type = 'manager';

  if (event.displayLabel && event.displayLabel.trim()) {
    node.label = event.displayLabel;
    node.displayLabel = event.displayLabel;
  }

  nodeMap.delete(oldId);
  nodeMap.set(node.id, node);
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
  timestamp: string,
  taskName?: string
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

    // Look for existing node with matching hierarchy.
    // When multiple nodes share the same hierarchy (e.g. two separate act()
    // invocations), prefer the one that's still running — a new child belongs
    // to the active invocation, not a previously-completed one. Fall back to
    // the last match (most recent chronologically).
    let found: ActionNode | undefined;
    for (const n of current) {
      if (
        n.hierarchy.length === targetHierarchy.length &&
        n.hierarchy.every((h, idx) => h === targetHierarchy[idx])
      ) {
        if (n.status === 'running') {
          found = n;
          break;
        }
        found = n;
      }
    }

    if (!found) {
      // Create boundary node for missing segment
      found = createBoundaryNode(
        boundarySegmentLabel(segment, taskName),
        targetHierarchy,
        timestamp
      );
      if (parent) {
        parent.children.push(found);
      } else {
        roots.push(found);
      }
    } else if (found.type === 'boundary' && taskName) {
      // The boundary may predate the first event that carried the task's
      // name; upgrade its id-only label the moment the name is known.
      const label = boundarySegmentLabel(segment, taskName);
      if (label !== segment && found.label !== label) found.label = label;
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
  node: ActionNode,
  taskName?: string
): void {
  const { siblings } = findOrCreateParent(roots, node.hierarchy, node.startTime, taskName);

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

  const promotedCallingIds: string[] = [];

  for (const event of events) {
    if (event.phase === 'incoming') {
      // Skip duplicate incoming events (same calling_id already processed)
      if (nodeMap.has(event.callingId)) continue;

      const node = createActionNode(event);
      insertNodeAtHierarchy(roots, nodeMap, node, event.taskName);

      // Check for stored orphan outgoing that matches
      const orphanIndex = orphanOutgoing.findIndex((o) => o.callingId === event.callingId);
      if (orphanIndex !== -1) {
        const orphan = orphanOutgoing[orphanIndex];
        applyNodeUpdateEvent(node, orphan, roots);
        orphanOutgoing.splice(orphanIndex, 1);
      }
    } else {
      applyNodeUpdateOrOrphan(event, roots, nodeMap, orphanOutgoing, promotedCallingIds);
    }
  }

  return { roots, nodeMap, orphanOutgoing, promotedCallingIds };
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
  const promotedCallingIds: string[] = [];

  // Parse and sort new events
  const events = newLogs
    .map(parseManagerMethodLog)
    .filter((e): e is ParsedManagerMethodEvent => e !== null)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  for (const event of events) {
    if (event.phase === 'incoming') {
      const existing = nodeMap.get(event.callingId);
      if (existing) {
        applyBackfilledIncoming(existing, event);
        continue;
      }

      const node = createActionNode(event);
      insertNodeAtHierarchy(roots, nodeMap, node, event.taskName);
    } else {
      applyNodeUpdateOrOrphan(event, roots, nodeMap, orphanOutgoing, promotedCallingIds);
    }
  }

  return { roots, nodeMap, orphanOutgoing, promotedCallingIds };
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
 * Recursively settle a live action tree so the UI stops streaming/shimmering.
 * Preserves existing error status; everything else becomes completed.
 */
export function markActionTreeStopped(node: ActionNode, endTime?: string): ActionNode {
  const settledAt = endTime ?? new Date().toISOString();
  return {
    ...node,
    status: node.status === 'error' ? 'error' : 'completed',
    endTime: node.endTime ?? settledAt,
    children: (node.children ?? []).map((child) => markActionTreeStopped(child, settledAt)),
  };
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
 * Uses the payload-level `event_timestamp` field — the actual time the
 * event occurred in the backend, not Orchestra's persistence timestamp.
 */
export function buildTimestampFilter(startTime: string): string {
  return `event_timestamp >= '${startTime}'`;
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
export function filterActionTree(
  roots: ActionNode[],
  searchTerm: string
): { filteredRoots: ActionNode[]; matchedIds: Set<string> } {
  const trimmed = searchTerm.trim().toLowerCase();

  if (!trimmed) {
    return { filteredRoots: roots, matchedIds: new Set() };
  }

  const matchingNodeIds = new Set<string>();
  const hasMatchingDescendant = new Map<string, boolean>();

  function checkMatches(node: ActionNode): boolean {
    const searchable = [node.requestContent, node.label, node.content]
      .filter(Boolean)
      .join('\0')
      .toLowerCase();
    const nodeMatches = searchable.includes(trimmed);

    let childMatches = false;
    for (const child of node.children) {
      if (checkMatches(child)) {
        childMatches = true;
      }
    }

    if (nodeMatches) {
      matchingNodeIds.add(node.id);
    }

    hasMatchingDescendant.set(node.id, childMatches);
    return nodeMatches || childMatches;
  }

  roots.forEach(checkMatches);

  function buildFilteredTree(nodes: ActionNode[]): ActionNode[] {
    const result: ActionNode[] = [];

    for (const node of nodes) {
      const nodeMatches = matchingNodeIds.has(node.id);
      const descendantMatches = hasMatchingDescendant.get(node.id) || false;

      if (nodeMatches || descendantMatches) {
        const filteredChildren = nodeMatches ? node.children : buildFilteredTree(node.children);

        result.push({
          ...node,
          children: filteredChildren,
        });
      }
    }

    return result;
  }

  return { filteredRoots: buildFilteredTree(roots), matchedIds: matchingNodeIds };
}

// =============================================================================
// Node Counting (for Live Actions Viewer)
// =============================================================================

/**
 * Result of counting action nodes by status.
 */
export interface ActionNodeCounts {
  running: number;
  awaiting: number;
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
    awaiting: 0,
    completed: 0,
    error: 0,
  };

  for (const root of roots) {
    switch (root.status) {
      case 'running':
        counts.running++;
        break;
      case 'awaiting':
        counts.awaiting++;
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
    const isExpandable = node.children.length > 0 || node.type === 'manager';
    if (isExpandable && !expandedNodeIds.has(node.id)) {
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
    if (node.children.length > 0 || node.type === 'manager') {
      ids.add(node.id);
    }
    node.children.forEach(collectExpandable);
  }

  roots.forEach(collectExpandable);
  return ids;
}
