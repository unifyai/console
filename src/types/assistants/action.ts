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
export type ActionNodeStatus = 'running' | 'completed' | 'error';

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

  /** Child nodes */
  children: ActionNode[];

  /** Lazy-loaded tool loop steps */
  toolLoopSteps?: ToolLoopStep[];

  /** Whether tool loop steps have been loaded */
  isToolLoopLoaded?: boolean;
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
  phase: 'incoming' | 'outgoing' | null;
  callingId: string;
  hierarchy: string[];
  hierarchyLabel: string;
  status: 'ok' | 'error';
  question?: string;
  instructions?: string;
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
  phase: 'incoming' | 'outgoing';
  callingId: string;
  hierarchy: string[];
  hierarchyLabel: string;
  status: 'ok' | 'error';
  content?: string;
  error?: string;
  /** User-facing alias from Unity (e.g., "Checking Contact Book") */
  displayLabel?: string;
  /** Globally unique event identifier */
  eventId?: string;
  /** Error class name — present when status="error" */
  errorType?: string;
  /** Full traceback — present when status="error" */
  traceback?: string;
}

/**
 * Raw log entry for ToolLoop events.
 * Property names are in camelCase after Orchestra client transformation.
 *
 * Note: content can be a string (assistant messages) or an array of content blocks
 * (tool results like [{type: 'text', text: '...'}]).
 */
export interface ToolLoopLogEntries {
  message: {
    role: 'system' | 'assistant' | 'tool' | 'user';
    content?: string | Array<{ type: string; text: string }>;
    toolCalls?: Array<{
      id: string;
      function: { name: string; arguments: string };
    }>;
  };
  method: string;
  hierarchy: string[];
  hierarchyLabel: string;
}

/**
 * Full ToolLoop log object.
 */
export interface ToolLoopLog {
  id: number;
  ts: string;
  entries: ToolLoopLogEntries;
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
 */
export type GetManagerMethodEventsFn = (
  assistantId: string,
  startTime: string | null,
  limit: number | null
) => Promise<ActionsLogsResponse | ResponseProps>;

/**
 * Function signature for getToolLoopEvents server action.
 */
export type GetToolLoopEventsFn = (
  assistantId: string,
  hierarchyLabelPrefix: string,
  limit: number | null
) => Promise<ActionsLogsResponse | ResponseProps>;

/**
 * Actions interface for the useAssistantActions hook.
 */
export interface AssistantActionActions {
  getManagerMethodEvents: GetManagerMethodEventsFn;
  getToolLoopEvents?: GetToolLoopEventsFn;
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
}
