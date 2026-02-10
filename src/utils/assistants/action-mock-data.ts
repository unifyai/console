/**
 * Mock data for Assistant Actions Panel.
 *
 * This file contains realistic mock data for testing the actions panel UI
 * with progressive event reveal (simulating real-time event streaming).
 *
 * Data structure mirrors what comes from Orchestra's ManagerMethod and ToolLoop contexts.
 */

import type { ManagerMethodLog, ToolLoopLog } from '@/types/assistants/action';

// =============================================================================
// Configuration
// =============================================================================

/** Enable mock mode - set to true to use simulated data instead of real API */
export const USE_MOCK_DATA = false;

/** Simulation speed multiplier (1 = real-time, 2 = 2x speed, etc.) */
const SPEED_MULTIPLIER = 1;

/** Session start time - events are revealed relative to this */
let sessionStartTime: Date | null = null;

/**
 * Reset the simulation session.
 * Call this to restart the progressive reveal from the beginning.
 */
export function resetMockSession() {
  sessionStartTime = null;
}

/**
 * Get elapsed seconds since session start (with speed multiplier).
 */
function getElapsedSeconds(): number {
  if (!sessionStartTime) {
    sessionStartTime = new Date();
  }
  const now = new Date();
  return ((now.getTime() - sessionStartTime.getTime()) / 1000) * SPEED_MULTIPLIER;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate an ISO timestamp offset from session start.
 * @param offsetSeconds - Seconds from session start
 */
function ts(offsetSeconds: number): string {
  if (!sessionStartTime) {
    sessionStartTime = new Date();
  }
  const date = new Date(sessionStartTime.getTime() + offsetSeconds * 1000);
  return date.toISOString();
}

/**
 * Generate a unique calling ID.
 */
let callingIdCounter = 0;
function genCallingId(): string {
  return `mock_call_${++callingIdCounter}`;
}

// =============================================================================
// Mock ManagerMethod Events
// =============================================================================

// Calling IDs for cross-referencing
const CODEACT_CALL_ID = 'mock_codeact_001';
const EXECUTE_CODE_CALL_ID = 'mock_exec_001';
const CONTACT_MGR_CALL_ID = 'mock_contact_001';
const TASK_MGR_CALL_ID = 'mock_task_001';
const SEARCH_MGR_CALL_ID = 'mock_search_001';

/**
 * Build mock ManagerMethod events with timing offsets.
 * Events are revealed progressively based on their offset.
 */
function buildManagerMethodEvents(): Array<{
  offsetSeconds: number;
  log: Omit<ManagerMethodLog, 'ts'>;
}> {
  return [
    // ===========================================
    // CodeActActor.act - Root level orchestrator
    // ===========================================
    {
      offsetSeconds: 0,
      log: {
        id: 1001,
        entries: {
          manager: 'CodeActActor',
          method: 'act',
          phase: 'incoming' as const,
          callingId: CODEACT_CALL_ID,
          hierarchy: ['CodeActActor.act'],
          hierarchyLabel: 'CodeActActor.act',
          status: 'ok' as const,
          question: 'What are my tasks for today and who should I contact?',
          instructions: 'Review tasks and contacts, provide summary.',
        },
      },
    },

    // ===========================================
    // execute_code - First level boundary
    // ===========================================
    {
      offsetSeconds: 0.5,
      log: {
        id: 1002,
        entries: {
          manager: 'CodeActActor',
          method: 'execute_code',
          phase: 'incoming' as const,
          callingId: EXECUTE_CODE_CALL_ID,
          hierarchy: ['CodeActActor.act', 'execute_code'],
          hierarchyLabel: 'CodeActActor.act > execute_code',
          status: 'ok' as const,
          instructions: 'Execute the generated code to fulfill the request.',
        },
      },
    },

    // ===========================================
    // TaskManager.get_tasks - Nested manager call
    // ===========================================
    {
      offsetSeconds: 2,
      log: {
        id: 1003,
        entries: {
          manager: 'TaskManager',
          method: 'get_tasks',
          phase: 'incoming' as const,
          callingId: TASK_MGR_CALL_ID,
          hierarchy: ['CodeActActor.act', 'execute_code', 'TaskManager.get_tasks'],
          hierarchyLabel: 'CodeActActor.act > execute_code > TaskManager.get_tasks',
          status: 'ok' as const,
          question: 'Retrieve all tasks for the current user',
        },
      },
    },
    {
      offsetSeconds: 5,
      log: {
        id: 1004,
        entries: {
          manager: 'TaskManager',
          method: 'get_tasks',
          phase: 'outgoing' as const,
          callingId: TASK_MGR_CALL_ID,
          hierarchy: ['CodeActActor.act', 'execute_code', 'TaskManager.get_tasks'],
          hierarchyLabel: 'CodeActActor.act > execute_code > TaskManager.get_tasks',
          status: 'ok' as const,
          answer: JSON.stringify([
            { id: 1, title: 'Review Q4 budget proposal', due: 'Today', priority: 'high' },
            { id: 2, title: 'Send follow-up to client meeting', due: 'Today', priority: 'medium' },
            { id: 3, title: 'Update project timeline', due: 'Tomorrow', priority: 'low' },
          ]),
        },
      },
    },

    // ===========================================
    // ContactManager.search - Another nested call
    // ===========================================
    {
      offsetSeconds: 6,
      log: {
        id: 1005,
        entries: {
          manager: 'ContactManager',
          method: 'search',
          phase: 'incoming' as const,
          callingId: CONTACT_MGR_CALL_ID,
          hierarchy: ['CodeActActor.act', 'execute_code', 'ContactManager.search'],
          hierarchyLabel: 'CodeActActor.act > execute_code > ContactManager.search',
          status: 'ok' as const,
          question: 'Find contacts related to Q4 budget and client meeting',
        },
      },
    },
    {
      offsetSeconds: 10,
      log: {
        id: 1006,
        entries: {
          manager: 'ContactManager',
          method: 'search',
          phase: 'outgoing' as const,
          callingId: CONTACT_MGR_CALL_ID,
          hierarchy: ['CodeActActor.act', 'execute_code', 'ContactManager.search'],
          hierarchyLabel: 'CodeActActor.act > execute_code > ContactManager.search',
          status: 'ok' as const,
          answer: JSON.stringify([
            { name: 'Sarah Chen', email: 'sarah.chen@example.com', role: 'CFO' },
            { name: 'Mike Johnson', email: 'mike.j@clientco.com', role: 'Account Manager' },
          ]),
        },
      },
    },

    // ===========================================
    // SearchManager.web_search - Deep nested call
    // ===========================================
    {
      offsetSeconds: 11,
      log: {
        id: 1007,
        entries: {
          manager: 'SearchManager',
          method: 'web_search',
          phase: 'incoming' as const,
          callingId: SEARCH_MGR_CALL_ID,
          hierarchy: ['CodeActActor.act', 'execute_code', 'SearchManager.web_search'],
          hierarchyLabel: 'CodeActActor.act > execute_code > SearchManager.web_search',
          status: 'ok' as const,
          question: 'Latest news on Q4 market trends',
        },
      },
    },
    {
      offsetSeconds: 15,
      log: {
        id: 1008,
        entries: {
          manager: 'SearchManager',
          method: 'web_search',
          phase: 'outgoing' as const,
          callingId: SEARCH_MGR_CALL_ID,
          hierarchy: ['CodeActActor.act', 'execute_code', 'SearchManager.web_search'],
          hierarchyLabel: 'CodeActActor.act > execute_code > SearchManager.web_search',
          status: 'ok' as const,
          answer: 'Found 5 relevant articles about Q4 market trends...',
        },
      },
    },

    // ===========================================
    // execute_code completes
    // ===========================================
    {
      offsetSeconds: 18,
      log: {
        id: 1009,
        entries: {
          manager: 'CodeActActor',
          method: 'execute_code',
          phase: 'outgoing' as const,
          callingId: EXECUTE_CODE_CALL_ID,
          hierarchy: ['CodeActActor.act', 'execute_code'],
          hierarchyLabel: 'CodeActActor.act > execute_code',
          status: 'ok' as const,
          answer: 'Successfully retrieved tasks and contacts.',
        },
      },
    },

    // ===========================================
    // CodeActActor.act completes
    // ===========================================
    {
      offsetSeconds: 20,
      log: {
        id: 1010,
        entries: {
          manager: 'CodeActActor',
          method: 'act',
          phase: 'outgoing' as const,
          callingId: CODEACT_CALL_ID,
          hierarchy: ['CodeActActor.act'],
          hierarchyLabel: 'CodeActActor.act',
          status: 'ok' as const,
          answer: `Here's your summary for today:\n\n**Tasks:**\n1. Review Q4 budget proposal (High priority - Due today)\n2. Send follow-up to client meeting (Medium priority - Due today)\n3. Update project timeline (Low priority - Due tomorrow)\n\n**Suggested Contacts:**\n- Sarah Chen (CFO) for budget discussions\n- Mike Johnson for client follow-up`,
        },
      },
    },
  ];
}

// =============================================================================
// Mock ToolLoop Events
// =============================================================================

/**
 * Build mock ToolLoop events with timing offsets.
 * These represent the LLM's reasoning and tool calls within each manager.
 */
function buildToolLoopEvents(): Array<{ offsetSeconds: number; log: Omit<ToolLoopLog, 'ts'> }> {
  return [
    // ===========================================
    // CodeActActor.act ToolLoop events
    // ===========================================
    {
      offsetSeconds: 0.2,
      log: {
        id: 2001,
        entries: {
          method: 'act',
          hierarchy: ['CodeActActor.act'],
          hierarchyLabel: 'CodeActActor.act',
          message: {
            role: 'assistant' as const,
            content:
              'I need to help the user with their tasks and contacts. Let me first check what tasks they have for today.',
          },
        },
      },
    },
    {
      offsetSeconds: 0.4,
      log: {
        id: 2002,
        entries: {
          method: 'act',
          hierarchy: ['CodeActActor.act'],
          hierarchyLabel: 'CodeActActor.act',
          message: {
            role: 'assistant' as const,
            toolCalls: [
              {
                id: 'call_001',
                function: {
                  name: 'execute_code',
                  arguments: JSON.stringify({ code: 'task_manager.get_tasks()' }),
                },
              },
            ],
          },
        },
      },
    },

    // ===========================================
    // execute_code ToolLoop events
    // ===========================================
    {
      offsetSeconds: 1,
      log: {
        id: 2003,
        entries: {
          method: 'execute_code',
          hierarchy: ['CodeActActor.act', 'execute_code'],
          hierarchyLabel: 'CodeActActor.act > execute_code',
          message: {
            role: 'assistant' as const,
            content: 'Executing code to retrieve user tasks from TaskManager...',
          },
        },
      },
    },

    // ===========================================
    // TaskManager.get_tasks ToolLoop events
    // ===========================================
    {
      offsetSeconds: 2.5,
      log: {
        id: 2004,
        entries: {
          method: 'get_tasks',
          hierarchy: ['CodeActActor.act', 'execute_code', 'TaskManager.get_tasks'],
          hierarchyLabel: 'CodeActActor.act > execute_code > TaskManager.get_tasks',
          message: {
            role: 'assistant' as const,
            content: 'Querying the task database for current user tasks...',
          },
        },
      },
    },
    {
      offsetSeconds: 3.5,
      log: {
        id: 2005,
        entries: {
          method: 'get_tasks',
          hierarchy: ['CodeActActor.act', 'execute_code', 'TaskManager.get_tasks'],
          hierarchyLabel: 'CodeActActor.act > execute_code > TaskManager.get_tasks',
          message: {
            role: 'assistant' as const,
            toolCalls: [
              {
                id: 'call_002',
                function: {
                  name: 'database_query',
                  arguments: JSON.stringify({
                    query: 'SELECT * FROM tasks WHERE user_id = ? AND due_date <= ?',
                    params: ['current_user', 'tomorrow'],
                  }),
                },
              },
            ],
          },
        },
      },
    },
    {
      offsetSeconds: 4.5,
      log: {
        id: 2006,
        entries: {
          method: 'get_tasks',
          hierarchy: ['CodeActActor.act', 'execute_code', 'TaskManager.get_tasks'],
          hierarchyLabel: 'CodeActActor.act > execute_code > TaskManager.get_tasks',
          message: {
            role: 'tool' as const,
            content: [
              {
                type: 'text',
                text: 'Query returned 3 tasks: Q4 budget review, client follow-up, timeline update.',
              },
            ],
          },
        },
      },
    },

    // ===========================================
    // ContactManager.search ToolLoop events
    // ===========================================
    {
      offsetSeconds: 7,
      log: {
        id: 2007,
        entries: {
          method: 'search',
          hierarchy: ['CodeActActor.act', 'execute_code', 'ContactManager.search'],
          hierarchyLabel: 'CodeActActor.act > execute_code > ContactManager.search',
          message: {
            role: 'assistant' as const,
            content: 'Searching contacts database for relevant people...',
          },
        },
      },
    },
    {
      offsetSeconds: 8,
      log: {
        id: 2008,
        entries: {
          method: 'search',
          hierarchy: ['CodeActActor.act', 'execute_code', 'ContactManager.search'],
          hierarchyLabel: 'CodeActActor.act > execute_code > ContactManager.search',
          message: {
            role: 'assistant' as const,
            toolCalls: [
              {
                id: 'call_003',
                function: {
                  name: 'contacts_search',
                  arguments: JSON.stringify({ keywords: ['budget', 'Q4', 'client', 'meeting'] }),
                },
              },
            ],
          },
        },
      },
    },
    {
      offsetSeconds: 9,
      log: {
        id: 2009,
        entries: {
          method: 'search',
          hierarchy: ['CodeActActor.act', 'execute_code', 'ContactManager.search'],
          hierarchyLabel: 'CodeActActor.act > execute_code > ContactManager.search',
          message: {
            role: 'tool' as const,
            content: 'Found 2 matching contacts: Sarah Chen (CFO), Mike Johnson (Account Manager)',
          },
        },
      },
    },

    // ===========================================
    // SearchManager.web_search ToolLoop events
    // ===========================================
    {
      offsetSeconds: 12,
      log: {
        id: 2010,
        entries: {
          method: 'web_search',
          hierarchy: ['CodeActActor.act', 'execute_code', 'SearchManager.web_search'],
          hierarchyLabel: 'CodeActActor.act > execute_code > SearchManager.web_search',
          message: {
            role: 'assistant' as const,
            content: 'Searching the web for Q4 market trends to provide context...',
          },
        },
      },
    },
    {
      offsetSeconds: 13,
      log: {
        id: 2011,
        entries: {
          method: 'web_search',
          hierarchy: ['CodeActActor.act', 'execute_code', 'SearchManager.web_search'],
          hierarchyLabel: 'CodeActActor.act > execute_code > SearchManager.web_search',
          message: {
            role: 'assistant' as const,
            toolCalls: [
              {
                id: 'call_004',
                function: {
                  name: 'web_search',
                  arguments: JSON.stringify({ query: 'Q4 2024 market trends financial outlook' }),
                },
              },
            ],
          },
        },
      },
    },
    {
      offsetSeconds: 14,
      log: {
        id: 2012,
        entries: {
          method: 'web_search',
          hierarchy: ['CodeActActor.act', 'execute_code', 'SearchManager.web_search'],
          hierarchyLabel: 'CodeActActor.act > execute_code > SearchManager.web_search',
          message: {
            role: 'tool' as const,
            content: [
              {
                type: 'text',
                text: 'Search results: 1. "Q4 Outlook: Tech sector shows resilience" - Reuters\n2. "Market trends to watch in late 2024" - Bloomberg\n3. "Financial sector Q4 predictions" - WSJ',
              },
            ],
          },
        },
      },
    },

    // ===========================================
    // Final synthesis in execute_code
    // ===========================================
    {
      offsetSeconds: 16,
      log: {
        id: 2013,
        entries: {
          method: 'execute_code',
          hierarchy: ['CodeActActor.act', 'execute_code'],
          hierarchyLabel: 'CodeActActor.act > execute_code',
          message: {
            role: 'assistant' as const,
            content:
              'All data gathered. Compiling summary for the user with tasks, contacts, and relevant context...',
          },
        },
      },
    },
    {
      offsetSeconds: 17,
      log: {
        id: 2014,
        entries: {
          method: 'execute_code',
          hierarchy: ['CodeActActor.act', 'execute_code'],
          hierarchyLabel: 'CodeActActor.act > execute_code',
          message: {
            role: 'tool' as const,
            content: 'Code execution completed successfully. Results formatted and ready.',
          },
        },
      },
    },

    // ===========================================
    // Final response from CodeActActor
    // ===========================================
    {
      offsetSeconds: 19,
      log: {
        id: 2015,
        entries: {
          method: 'act',
          hierarchy: ['CodeActActor.act'],
          hierarchyLabel: 'CodeActActor.act',
          message: {
            role: 'assistant' as const,
            content: `Here's your summary for today:\n\n**Tasks:**\n1. Review Q4 budget proposal (High priority)\n2. Send follow-up to client meeting (Medium priority)\n3. Update project timeline (Low priority)\n\n**Suggested Contacts:**\n- Sarah Chen (CFO) for budget discussions\n- Mike Johnson for client follow-up`,
          },
        },
      },
    },
  ];
}

// =============================================================================
// Progressive Event Retrieval
// =============================================================================

/**
 * Get ManagerMethod events that have "occurred" based on elapsed time.
 * Simulates real-time event streaming.
 */
export function getMockManagerMethodEvents(
  assistantId: string,
  startTime: string | null,
  limit: number | null
): { logs: ManagerMethodLog[]; count: number } {
  const elapsed = getElapsedSeconds();
  const allEvents = buildManagerMethodEvents();

  // Filter events that have "occurred" based on elapsed time
  const visibleEvents = allEvents
    .filter((e) => e.offsetSeconds <= elapsed)
    .map((e) => ({
      ...e.log,
      ts: ts(e.offsetSeconds),
    }));

  // Apply limit if specified
  const logs = limit ? visibleEvents.slice(0, limit) : visibleEvents;

  return {
    logs,
    count: logs.length,
  };
}

/**
 * Get ToolLoop events for a specific hierarchy label prefix.
 * Simulates real-time event streaming within a specific node.
 */
export function getMockToolLoopEvents(
  assistantId: string,
  hierarchyLabelPrefix: string,
  limit: number | null
): { logs: ToolLoopLog[]; count: number } {
  const elapsed = getElapsedSeconds();
  const allEvents = buildToolLoopEvents();

  // Filter by hierarchy label prefix and elapsed time
  const visibleEvents = allEvents
    .filter(
      (e) =>
        e.offsetSeconds <= elapsed && e.log.entries.hierarchyLabel.startsWith(hierarchyLabelPrefix)
    )
    .map((e) => ({
      ...e.log,
      ts: ts(e.offsetSeconds),
    }));

  // Sort by timestamp descending (most recent first) for limit=1 case
  visibleEvents.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  // Apply limit if specified
  const logs = limit ? visibleEvents.slice(0, limit) : visibleEvents;

  return {
    logs,
    count: logs.length,
  };
}
