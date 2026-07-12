/**
 * Mock data for Assistant Actions Panel.
 *
 * Contains a pre-built ActionNode tree for quick visual testing of the
 * actions panel without a live backend. Gated behind USE_MOCK_DATA.
 */

import type { ActionNode } from '@/types/assistants/action';

// =============================================================================
// Configuration
// =============================================================================

/** Enable mock mode - set to true to use simulated data instead of real API */
export const USE_MOCK_DATA = false;

// =============================================================================
// Pre-built Mock Action Tree
// =============================================================================

/**
 * Static pre-built ActionNode tree for quick visual testing of the actions panel
 * without going through the event → tree pipeline. Gated behind USE_MOCK_DATA.
 */
export const MOCK_ACTION_ROOTS: ActionNode[] = [
  {
    id: 'mock-1',
    type: 'manager',
    label: 'act',
    displayLabel: 'Taking Action',
    hierarchy: ['CodeActActor', 'act'],
    hierarchyLabel: 'CodeActActor.act',
    status: 'running',
    startTime: new Date(Date.now() - 45_000).toISOString(),
    requestContent:
      'Search the web for the latest global headlines as of today, Sunday March 8, 2026. Return a concise summary of the top headlines across major news categories (politics, world events, business, tech, etc.).',
    childrenLoaded: true,
    children: [
      {
        id: 'mock-1-1',
        type: 'manager',
        label: 'execute_code',
        displayLabel: 'Running Code',
        hierarchy: ['CodeActActor', 'act', 'execute_code'],
        hierarchyLabel: 'CodeActActor.act → execute_code',
        status: 'completed',
        startTime: new Date(Date.now() - 40_000).toISOString(),
        endTime: new Date(Date.now() - 32_000).toISOString(),
        requestContent: 'Set up news scraping environment',
        content:
          'import requests\nfrom bs4 import BeautifulSoup\n\nresult = requests.get("https://news.google.com")\nprint(f"Status: {result.status_code}")',
        childrenLoaded: true,
        children: [],
      },
      {
        id: 'mock-1-2',
        type: 'manager',
        label: 'search_web',
        displayLabel: 'Searching the Web',
        hierarchy: ['CodeActActor', 'act', 'search_web'],
        hierarchyLabel: 'CodeActActor.act → search_web',
        status: 'running',
        startTime: new Date(Date.now() - 10_000).toISOString(),
        requestContent:
          'Search the web for the latest global headlines as of today, Sunday March 8, 2026.',
        childrenLoaded: true,
        children: [
          {
            id: 'mock-1-2-1',
            type: 'manager',
            label: 'fetch_results',
            displayLabel: 'Searching the Web',
            hierarchy: ['CodeActActor', 'act', 'search_web', 'fetch_results'],
            hierarchyLabel: 'CodeActActor.act → search_web → fetch_results',
            status: 'running',
            startTime: new Date(Date.now() - 8_000).toISOString(),
            requestContent: 'Fetching search results for "global headlines March 8 2026"',
            childrenLoaded: true,
            children: [],
          },
        ],
      },
    ],
  },
  {
    id: 'mock-2',
    type: 'manager',
    label: 'store_skills',
    displayLabel: 'Storing Reusable Skills',
    hierarchy: ['SkillManager', 'store'],
    hierarchyLabel: 'SkillManager.store',
    status: 'completed',
    startTime: new Date(Date.now() - 120_000).toISOString(),
    endTime: new Date(Date.now() - 95_000).toISOString(),
    requestContent: 'Store the email summary template as a reusable skill for future use.',
    content: 'Stored email_summary_template as a reusable skill.',
    childrenLoaded: true,
    children: [],
  },
  {
    id: 'mock-3',
    type: 'manager',
    label: 'ask',
    displayLabel: 'Answering Question',
    hierarchy: ['ContactManager', 'ask'],
    hierarchyLabel: 'ContactManager.ask',
    status: 'completed',
    startTime: new Date(Date.now() - 300_000).toISOString(),
    endTime: new Date(Date.now() - 270_000).toISOString(),
    requestContent: 'When is the meeting with the product team scheduled for?',
    content: 'The meeting is scheduled for 3 PM tomorrow.',
    childrenLoaded: true,
    children: [
      {
        id: 'mock-3-1',
        type: 'manager',
        label: 'lookup_contact',
        displayLabel: 'Checking Contact Book',
        hierarchy: ['ContactManager', 'ask', 'lookup_contact'],
        hierarchyLabel: 'ContactManager.ask → lookup_contact',
        status: 'completed',
        startTime: new Date(Date.now() - 295_000).toISOString(),
        endTime: new Date(Date.now() - 285_000).toISOString(),
        requestContent: 'Look up the product team meeting in the calendar.',
        content: 'Found calendar entry: "Product Team Sync" — tomorrow 3:00 PM–3:45 PM.',
        childrenLoaded: true,
        children: [],
      },
    ],
  },
  {
    id: 'mock-4',
    type: 'manager',
    label: 'read_file',
    displayLabel: 'Reading File',
    hierarchy: ['FileManager', 'read'],
    hierarchyLabel: 'FileManager.read',
    status: 'completed',
    startTime: new Date(Date.now() - 400_000).toISOString(),
    endTime: new Date(Date.now() - 395_000).toISOString(),
    requestContent: 'Read the weekly standup notes from last Friday.',
    childrenLoaded: true,
    children: [],
  },
  {
    id: 'mock-5',
    type: 'manager',
    label: 'search',
    displayLabel: 'Searching Knowledge',
    hierarchy: ['KnowledgeManager', 'search'],
    hierarchyLabel: 'KnowledgeManager.search',
    status: 'completed',
    startTime: new Date(Date.now() - 500_000).toISOString(),
    endTime: new Date(Date.now() - 480_000).toISOString(),
    requestContent:
      'Search active knowledge claims related to the client onboarding call transcript.',
    childrenLoaded: true,
    children: [],
  },
  {
    id: 'mock-6',
    type: 'manager',
    label: 'work_on_task',
    displayLabel: 'Working on Task',
    hierarchy: ['TaskScheduler', 'execute'],
    hierarchyLabel: 'TaskScheduler.execute',
    status: 'completed',
    startTime: new Date(Date.now() - 600_000).toISOString(),
    endTime: new Date(Date.now() - 550_000).toISOString(),
    requestContent: 'Draft the weekly report and send it to the team.',
    content: 'Completed: Draft weekly report and send to team.',
    childrenLoaded: true,
    children: [
      {
        id: 'mock-6-1',
        type: 'manager',
        label: 'draft_report',
        displayLabel: 'Working on Task',
        hierarchy: ['TaskScheduler', 'execute', 'draft_report'],
        hierarchyLabel: 'TaskScheduler.execute → draft_report',
        status: 'completed',
        startTime: new Date(Date.now() - 595_000).toISOString(),
        endTime: new Date(Date.now() - 570_000).toISOString(),
        requestContent: 'Draft the weekly summary from standup notes and project updates.',
        content:
          '# Weekly Report — March 7, 2026\n\n## Highlights\n- Shipped v2.3 of the dashboard\n- Client onboarding completed for Acme Corp\n- Infrastructure migration 80% done\n\n## Blockers\n- Waiting on legal review for data processing agreement',
        childrenLoaded: true,
        children: [],
      },
      {
        id: 'mock-6-2',
        type: 'manager',
        label: 'send_email',
        displayLabel: 'Working on Task',
        hierarchy: ['TaskScheduler', 'execute', 'send_email'],
        hierarchyLabel: 'TaskScheduler.execute → send_email',
        status: 'completed',
        startTime: new Date(Date.now() - 565_000).toISOString(),
        endTime: new Date(Date.now() - 555_000).toISOString(),
        requestContent: 'Send the drafted weekly report to team@company.com.',
        content: 'Email sent successfully to team@company.com.',
        childrenLoaded: true,
        children: [],
      },
    ],
  },
];
