/**
 * Types for the Assistant Live Actions Panel.
 *
 * These types represent the data structures used to display real-time
 * nested action trees in the Assistant Profile panel.
 */

// =============================================================================
// Core Types
// =============================================================================

/**
 * Status of an action node in the tree.
 */
export type ActionNodeStatus = 'running' | 'awaiting' | 'completed' | 'error';

/**
 * Type of node in the action tree.
 * - 'manager': A state manager method invocation (e.g., ContactManager.ask)
 * - 'boundary': An intermediate node like execute_code, execute_function
 * - 'toolloop': A ToolLoop step (LLM message, tool call, tool result)
 */
export type ActionNodeType = 'manager' | 'boundary' | 'toolloop';

/**
 * A step within a tool loop (LLM reasoning, tool calls, results).
 * Lazy loaded when a node is expanded.
 */
export interface ToolLoopStep {
  id: string;
  type: 'llm' | 'tool_call' | 'tool_result';
  content?: string;
  toolName?: string;
  toolArgs?: string;
}

/**
 * A node in the action tree representing a manager invocation or boundary.
 */
export interface ActionNode {
  /** Unique identifier (from calling_id) */
  id: string;

  /** Type of node */
  type: ActionNodeType;

  /** Display label — prefers displayLabel (human-readable), falls back to hierarchy segment */
  label: string;

  /** User-facing alias from Unity (e.g., "Checking Contact Book"). Absent on boundary nodes. */
  displayLabel?: string;

  /** Full hierarchy path as array */
  hierarchy: string[];

  /** Human-readable hierarchy label for ToolLoop queries */
  hierarchyLabel: string;

  /** Current status */
  status: ActionNodeStatus;

  /** ISO timestamp when action started */
  startTime: string;

  /** ISO timestamp when action completed (if completed) */
  endTime?: string;

  /** Content: question, instructions, or answer */
  content?: string;

  /** Original request text from the incoming ManagerMethod event.
   *  Preserved separately because `content` gets overwritten by the outgoing answer. */
  requestContent?: string;

  /** Whether this action uses persist mode (open-ended session with interjections) */
  persist?: boolean;

  /** Child nodes */
  children: ActionNode[];

  /** Lazy-loaded tool loop steps */
  toolLoopSteps?: ToolLoopStep[];

  /** Whether tool loop steps have been loaded */
  isToolLoopLoaded?: boolean;

  /** Live ToolLoop logs accumulated from SSE. Persists after completion to
   *  serve as a bridge until lazy-loaded historical data replaces them. */
  liveToolLoopLogs?: ToolLoopLog[];

  /** Whether child manager events have been lazy-loaded for this node */
  childrenLoaded?: boolean;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Raw log entry as returned from the /api/logs endpoint for ManagerMethod events.
 * Property names are in camelCase after Orchestra client transformation.
 *
 * Note: Some events have phase=null (e.g., action events with action: "done").
 * The action field provides progress information for in-flight operations.
 */
export interface ManagerMethodLogEntries {
  manager: string;
  method: string;
  phase: 'incoming' | 'outgoing' | 'awaiting_input' | 'resumed' | null;
  callingId: string;
  hierarchy: string[];
  hierarchyLabel: string;
  status: 'ok' | 'error';
  question?: string;
  instructions?: string;
  /** The user's original input — used by CodeActActor.act incoming events where question/instructions are null */
  request?: string;
  answer?: string;
  error?: string;
  /** Action/progress indicator (e.g., "done", "next_clarification") */
  action?: string;
  /** User-facing alias defined in Unity (e.g., "Checking Contact Book") */
  displayLabel?: string;
  /** Globally unique event identifier, used for SSE/poll deduplication */
  eventId?: string;
  /** Error class name (e.g., "TimeoutError") — present when status="error" */
  errorType?: string;
  /** Full traceback string — present when status="error" */
  traceback?: string;
  /** Actual event occurrence time (ISO-8601 with timezone) from the backend */
  eventTimestamp?: string;
}

/**
 * Full log object as returned from the API.
 */
export interface ManagerMethodLog {
  id: number;
  ts: string;
  entries: ManagerMethodLogEntries;
}

/**
 * Parsed event from a ManagerMethod log.
 */
export interface ParsedManagerMethodEvent {
  id: number;
  timestamp: string;
  manager: string;
  method: string;
  phase: 'incoming' | 'outgoing' | 'awaiting_input' | 'resumed';
  callingId: string;
  hierarchy: string[];
  hierarchyLabel: string;
  status: 'ok' | 'error';
  content?: string;
  error?: string;
  /** User-facing alias from Unity (e.g., "Checking Contact Book") */
  displayLabel?: string;
  /** Definition name of the durable task this event ran under, when any. */
  taskName?: string;
  /** Globally unique event identifier */
  eventId?: string;
  /** Error class name — present when status="error" */
  errorType?: string;
  /** Full traceback — present when status="error" */
  traceback?: string;
  /** Whether this action uses persist mode */
  persist?: boolean;
}

/**
 * Raw log entry for ToolLoop events.
 * Property names are in camelCase after Orchestra client transformation.
 *
 * Note: content can be a string (assistant messages) or an array of content blocks
 * (tool results like [{type: 'text', text: '...'}]).
 */
export interface ToolLoopLogEntries {
  kind?: string;
  message: {
    role: 'system' | 'assistant' | 'tool' | 'user';
    content?: string | Array<{ type: string; text?: string; imageUrl?: { url: string } }>;
    toolCalls?: Array<{
      id: string;
      function: { name: string; arguments: string };
    }>;
    toolCallId?: string;
    name?: string;
  };
  method: string;
  hierarchy: string[];
  hierarchyLabel: string;
  eventTimestamp?: string;
  eventId?: string;
  toolAliases?: Record<string, string> | null;
}

/**
 * Full ToolLoop log object.
 */
export interface ToolLoopLog {
  id: number;
  ts: string;
  entries: ToolLoopLogEntries;
  /** Synthetic child ActionNode injected into the log list for inline rendering */
  syntheticChildNode?: ActionNode;
  /** The tool_call_id that spawned this child node (for bracket connectors) */
  syntheticToolCallId?: string | null;
}

// =============================================================================
// Action Types (for server actions)
// =============================================================================

import type { ResponseProps } from '@/types/common';

/**
 * Response from getManagerMethodEvents or getToolLoopEvents.
 */
export interface ActionsLogsResponse {
  logs: Array<{
    id: number;
    ts: string;
    entries: Record<string, unknown>;
  }>;
  count: number;
}

/**
 * Function signature for getManagerMethodEvents server action.
 * Optional offset enables client-driven pagination for progressive loading.
 * Optional extraFilters adds arbitrary filter expressions (e.g. phase, hierarchy length).
 */
export type GetManagerMethodEventsFn = (
  ownerId: string,
  assistantId: string,
  startTime: string | null,
  limit: number | null,
  offset?: number,
  extraFilters?: string[]
) => Promise<ActionsLogsResponse | ResponseProps>;

/**
 * Function signature for getToolLoopEvents server action.
 * Optional startTime/endTime scope the query to a specific invocation window
 * so events from other invocations with the same hierarchy don't bleed in.
 */
export type GetToolLoopEventsFn = (
  ownerId: string,
  assistantId: string,
  hierarchy: string[],
  limit: number | null,
  startTime?: string,
  endTime?: string
) => Promise<ActionsLogsResponse | ResponseProps>;

/**
 * Function to lazy-load child manager events for a specific node on expand.
 * Fetches all descendant ManagerMethod events and merges them into the tree.
 */
export type LoadChildrenFn = (nodeId: string, hierarchy: string[]) => Promise<void>;

/**
 * Function signature for targeted backfill of missing incoming events.
 * Fetches events by specific calling_ids (no time constraint) so we can
 * retrieve root incoming events that fell outside the initial time window.
 */
export type BackfillByCallingIdsFn = (
  ownerId: string,
  assistantId: string,
  callingIds: string[]
) => Promise<ActionsLogsResponse | ResponseProps>;

/**
 * Actions interface for the useAssistantActions hook.
 */
export interface AssistantActionActions {
  getManagerMethodEvents: GetManagerMethodEventsFn;
  getToolLoopEvents?: GetToolLoopEventsFn;
  backfillByCallingIds?: BackfillByCallingIdsFn;
}

// =============================================================================
// Tree Building Types
// =============================================================================

/**
 * Result of building an action tree from logs.
 */
export interface ActionTreeResult {
  /** Root-level nodes */
  roots: ActionNode[];

  /** Map of calling_id to node for quick lookup */
  nodeMap: Map<string, ActionNode>;

  /** Orphan outgoing events that haven't been matched yet */
  orphanOutgoing: ParsedManagerMethodEvent[];

  /**
   * calling_ids of nodes that were promoted from boundary placeholders.
   * These nodes exist because outgoing events matched a boundary by hierarchy,
   * but the original incoming event was not in the fetch window.
   * Used to trigger a targeted backfill fetch.
   */
  promotedCallingIds: string[];
}
