import { Globe } from 'lucide-react';
import {
  SiGithub,
  SiGmail,
  SiGooglecalendar,
  SiGoogledrive,
  SiGooglemeet,
  SiGooglesheets,
  SiHubspot,
  SiLinear,
  SiLinkedin,
  SiNotion,
  SiSlack,
  SiStripe,
} from 'react-icons/si';
import { mockSimulationEnabled } from '@/lib/simulation/config';
import type { Workflow, WorkflowGalleryItem, WorkflowInstallation } from '@/types/workflows';

/**
 * Mock catalog for the Workflows surface — the twelve curated workflows in
 * approved product voice, plus five installations covering every install
 * state. The shapes are the contract with the WorkflowManager catalog feed;
 * `useWorkflowCatalog` serves these instead of the live catalog when mock
 * mode is active.
 *
 * Requirement connection state mirrors a plausible integrations gallery:
 * Notion, HubSpot and LinkedIn are NOT connected, everything else is.
 * Vendor marks are the same tree-shaken react-icons components the static
 * integration config uses — mock data never ships image assets.
 */

export const USE_MOCK_WORKFLOWS = false;

function canUseRuntimeMockFlag(): boolean {
  if (typeof window === 'undefined') return false;
  // Local stack often runs a production Next build on localhost; still allow
  // the explicit mock flag there so Playwright can drive the shelf without a
  // live catalog feed.
  const host = window.location.hostname;
  const isLocalHost = host === 'localhost' || host === '127.0.0.1';
  return process.env.NODE_ENV !== 'production' || isLocalHost;
}

export function shouldUseMockWorkflows(): boolean {
  if (USE_MOCK_WORKFLOWS) return true;
  if (mockSimulationEnabled()) return true;
  if (!canUseRuntimeMockFlag()) return false;
  const params = new URLSearchParams(window.location.search);
  return (
    params.get('mockWorkflows') === '1' ||
    window.localStorage.getItem('console:workflows:mock') === 'true'
  );
}

export const MOCK_WORKFLOWS: Workflow[] = [
  {
    slug: 'daily-briefing',
    name: 'Daily briefing',
    category: 'comms',
    description:
      'Your calendar, the unread that actually matters, and anything starting to slip — before stand-up.',
    version: '1.2.0',
    iconId: 'briefing',
    requirements: [
      {
        canonicalSlug: 'gcal',
        displayName: 'Google Calendar',
        iconComponent: SiGooglecalendar,
        connected: true,
        accountLabel: 'haris@unify.ai',
      },
      {
        canonicalSlug: 'gmail',
        displayName: 'Gmail',
        iconComponent: SiGmail,
        connected: true,
        accountLabel: 'haris@unify.ai',
      },
      {
        canonicalSlug: 'slack',
        displayName: 'Slack',
        iconComponent: SiSlack,
        connected: true,
        accountLabel: 'unify.slack.com',
      },
    ],
    capabilities: [],
    paramsSchema: [
      {
        name: 'mailbox',
        label: 'Mailbox',
        type: 'select',
        required: true,
        options: ['haris@unify.ai', 'hello@unify.ai'],
        help: 'Which inbox to read for the unread digest.',
      },
      {
        name: 'calendar',
        label: 'Calendar',
        type: 'select',
        required: true,
        options: ['haris@unify.ai', 'Team — Revenue'],
        help: 'The calendar the day is read from.',
      },
      {
        name: 'deliver',
        label: 'Deliver to',
        type: 'select',
        required: false,
        options: ['Chat', 'Email', 'Slack DM'],
        help: 'Where the briefing lands each morning.',
      },
    ],
    sets: {
      procedures: [{ name: 'Briefing tone and length' }, { name: 'What counts as “slipping”' }],
      functions: [{ name: 'build_daily_briefing' }, { name: 'rank_unread_by_urgency' }],
      knowledge: [{ name: 'Your working hours' }, { name: 'People you always want flagged' }],
      tasks: [{ name: 'Daily briefing', schedule: 'Every weekday at 9:00am, your timezone' }],
    },
  },
  {
    slug: 'friday-inbox-cleanup',
    name: 'Friday inbox cleanup',
    category: 'comms',
    description:
      'Archives the noise, flags what needs a reply, files the rest into Notion. Monday starts clean.',
    version: '1.0.4',
    iconId: 'comet',
    requirements: [
      {
        canonicalSlug: 'gmail',
        displayName: 'Gmail',
        iconComponent: SiGmail,
        connected: true,
        accountLabel: 'haris@unify.ai',
      },
      {
        canonicalSlug: 'notion',
        displayName: 'Notion',
        iconComponent: SiNotion,
        connected: false,
      },
    ],
    capabilities: [],
    paramsSchema: [
      {
        name: 'mailbox',
        label: 'Mailbox',
        type: 'select',
        required: true,
        options: ['haris@unify.ai', 'hello@unify.ai'],
        help: 'The inbox to clean.',
      },
      {
        name: 'database',
        label: 'Notion database',
        type: 'select',
        required: true,
        options: ['Inbox archive', 'Reading list'],
        help: 'Where filed threads are written.',
      },
      {
        name: 'olderThan',
        label: 'Archive mail older than',
        type: 'number',
        required: false,
        suffix: 'days',
        help: 'Anything untouched for this long gets archived.',
      },
    ],
    sets: {
      procedures: [
        { name: 'Triage rules — reply, file, archive' },
        { name: 'Never-archive senders' },
      ],
      functions: [{ name: 'classify_thread' }, { name: 'file_to_notion' }],
      knowledge: [{ name: 'Threads you always answer yourself' }],
      tasks: [{ name: 'Friday inbox cleanup', schedule: 'Every Friday at 4:30pm, your timezone' }],
    },
  },
  {
    slug: 'meeting-recaps',
    name: 'Meeting recaps',
    category: 'comms',
    description:
      'Writes the recap, opens action-item tickets, and emails a clean summary to everyone who was there.',
    version: '1.3.0',
    iconId: 'signal',
    requirements: [
      {
        canonicalSlug: 'meet',
        displayName: 'Google Meet',
        iconComponent: SiGooglemeet,
        connected: true,
        accountLabel: 'haris@unify.ai',
      },
      {
        canonicalSlug: 'linear',
        displayName: 'Linear',
        iconComponent: SiLinear,
        connected: true,
        accountLabel: 'unify',
      },
      {
        canonicalSlug: 'gmail',
        displayName: 'Gmail',
        iconComponent: SiGmail,
        connected: true,
        accountLabel: 'haris@unify.ai',
      },
    ],
    capabilities: [],
    paramsSchema: [
      {
        name: 'calendar',
        label: 'Calendar',
        type: 'select',
        required: true,
        options: ['Team — Revenue', 'haris@unify.ai'],
        help: 'Meetings on this calendar get recapped.',
      },
      {
        name: 'project',
        label: 'Linear project',
        type: 'select',
        required: true,
        options: ['Revenue', 'Platform'],
        help: 'Where action-item tickets are opened.',
      },
      {
        name: 'cc',
        label: 'Always cc',
        type: 'text',
        required: false,
        help: 'Comma-separated addresses added to every recap.',
      },
    ],
    sets: {
      procedures: [{ name: 'Recap structure' }, { name: 'What becomes a ticket' }],
      functions: [{ name: 'summarise_transcript' }, { name: 'open_action_items' }],
      knowledge: [{ name: 'Team vocabulary and project codenames' }],
      tables: [{ name: 'meeting_actions' }],
      tasks: [
        { name: 'Recap finished meetings', schedule: 'Every 30 minutes, when a meeting ends' },
      ],
    },
  },
  {
    slug: 'lead-sourcing',
    name: 'Lead sourcing',
    category: 'growth',
    description:
      'ICP-matched lists, enriched and deduped, pushed into your CRM — a fresh batch every week.',
    version: '2.0.1',
    iconId: 'radar',
    requirements: [
      {
        canonicalSlug: 'linkedin',
        displayName: 'LinkedIn',
        iconComponent: SiLinkedin,
        connected: false,
      },
      {
        canonicalSlug: 'hubspot',
        displayName: 'HubSpot',
        iconComponent: SiHubspot,
        connected: false,
      },
    ],
    capabilities: [],
    paramsSchema: [
      {
        name: 'icp',
        label: 'Who counts as a lead',
        type: 'textarea',
        required: true,
        placeholder: 'Ops leads at 50–500 person B2B SaaS in UK/EU…',
        help: 'Plain description of your ICP. Your teammate turns it into a search each week.',
      },
      {
        name: 'pipeline',
        label: 'CRM pipeline',
        type: 'select',
        required: true,
        options: ['New business', 'Partnerships'],
        help: 'Where sourced leads land.',
      },
      {
        name: 'batch',
        label: 'Leads per batch',
        type: 'number',
        required: false,
        suffix: 'leads',
        help: 'How many to source each week.',
      },
    ],
    sets: {
      procedures: [{ name: 'ICP scoring rubric' }, { name: 'Dedupe and merge rules' }],
      functions: [
        { name: 'search_prospects' },
        { name: 'enrich_contact' },
        { name: 'push_to_crm' },
      ],
      knowledge: [
        { name: 'Segments you have already worked' },
        { name: 'Accounts to never contact' },
      ],
      canvases: [{ name: 'Sourcing funnel' }],
      tables: [{ name: 'sourced_leads' }],
      tasks: [
        { name: 'Weekly lead batch', schedule: 'Every Monday at 7:00am, your timezone' },
        { name: 'Backfill existing CRM contacts', schedule: 'Once, at install' },
      ],
    },
  },
  {
    slug: 'sales-qualification',
    name: 'Sales qualification',
    category: 'growth',
    description:
      'Handles first-touch replies, scores intent, logs to the CRM, and pings you the moment a lead is warm.',
    version: '1.1.2',
    iconId: 'beam',
    requirements: [
      {
        canonicalSlug: 'gmail',
        displayName: 'Gmail',
        iconComponent: SiGmail,
        connected: true,
        accountLabel: 'haris@unify.ai',
      },
      {
        canonicalSlug: 'hubspot',
        displayName: 'HubSpot',
        iconComponent: SiHubspot,
        connected: false,
      },
      {
        canonicalSlug: 'slack',
        displayName: 'Slack',
        iconComponent: SiSlack,
        connected: true,
        accountLabel: 'unify.slack.com',
      },
    ],
    capabilities: [],
    paramsSchema: [
      {
        name: 'mailbox',
        label: 'Mailbox',
        type: 'select',
        required: true,
        options: ['hello@unify.ai', 'haris@unify.ai'],
        help: 'The inbox first-touch replies come from.',
      },
      {
        name: 'alert',
        label: 'Alert channel',
        type: 'select',
        required: true,
        options: ['#revenue', 'DM me'],
        help: 'Where warm leads are announced.',
      },
    ],
    sets: {
      procedures: [{ name: 'First-touch reply voice' }, { name: 'Intent scoring' }],
      functions: [{ name: 'score_intent' }, { name: 'log_to_crm' }],
      knowledge: [{ name: 'Pricing answers you approve' }, { name: 'Objection handling' }],
      canvases: [{ name: 'Pipeline heat' }],
      tasks: [{ name: 'Qualify new replies', schedule: 'Every 15 minutes' }],
    },
  },
  {
    slug: 'competitor-watch',
    name: 'Competitor watch',
    category: 'growth',
    description:
      'Tracks rival pricing and feature changes, then writes up what shifted and what it means for you.',
    version: '1.0.0',
    iconId: 'scope',
    requirements: [
      {
        canonicalSlug: 'web',
        displayName: 'Web browsing',
        iconUrl: null,
        connected: true,
        builtin: true,
      },
      {
        canonicalSlug: 'notion',
        displayName: 'Notion',
        iconComponent: SiNotion,
        connected: false,
      },
    ],
    capabilities: ['computer'],
    paramsSchema: [
      {
        name: 'rivals',
        label: 'Who to watch',
        type: 'textarea',
        required: true,
        placeholder: 'Acme — acme.com/pricing',
        help: 'One competitor per line — name and URL.',
      },
      {
        name: 'page',
        label: 'Notion page',
        type: 'select',
        required: true,
        options: ['Competitive', 'Market notes'],
        help: 'Where the write-up is published.',
      },
    ],
    sets: {
      procedures: [{ name: 'What counts as a meaningful change' }],
      functions: [{ name: 'diff_page_snapshot' }, { name: 'write_change_note' }],
      knowledge: [{ name: 'Our positioning against each rival' }],
      tables: [{ name: 'page_snapshots' }],
      tasks: [{ name: 'Competitor sweep', schedule: 'Every Tuesday and Friday at 6:00am' }],
    },
  },
  {
    slug: 'invoice-reconcile',
    name: 'Invoice reconcile',
    category: 'ops',
    description:
      'Reads invoices as PDFs, matches line items against the contract, and queues only the anomalies.',
    version: '1.4.0',
    iconId: 'scales',
    requirements: [
      {
        canonicalSlug: 'gmail',
        displayName: 'Gmail',
        iconComponent: SiGmail,
        connected: true,
        accountLabel: 'haris@unify.ai',
      },
      {
        canonicalSlug: 'gdrive',
        displayName: 'Google Drive',
        iconComponent: SiGoogledrive,
        connected: true,
        accountLabel: 'haris@unify.ai',
      },
      {
        canonicalSlug: 'stripe',
        displayName: 'Stripe',
        iconComponent: SiStripe,
        connected: true,
        accountLabel: 'acct_1Qk…',
      },
    ],
    capabilities: ['filesystem'],
    paramsSchema: [
      {
        name: 'folder',
        label: 'Contracts folder',
        type: 'select',
        required: true,
        options: ['Finance / Contracts', 'Legal / Signed'],
        help: 'Where signed contracts are read from.',
      },
      {
        name: 'tolerance',
        label: 'Flag differences over',
        type: 'number',
        required: false,
        suffix: '%',
        help: 'Anything under this is treated as rounding.',
      },
    ],
    sets: {
      procedures: [{ name: 'Line-item matching rules' }, { name: 'When to escalate to a human' }],
      functions: [{ name: 'parse_invoice_pdf' }, { name: 'reconcile_stripe_payout' }],
      knowledge: [{ name: 'Approved vendors' }, { name: 'Contract renewal dates' }],
      canvases: [{ name: 'Anomaly queue' }],
      tables: [{ name: 'invoice_lines' }],
      tasks: [{ name: 'Reconcile new invoices', schedule: 'Every day at 6:00am, your timezone' }],
    },
  },
  {
    slug: 'board-pack',
    name: 'Board pack',
    category: 'ops',
    description:
      'Assembles the monthly update — revenue, burn, pipeline, KPIs — in your house style by the 5th.',
    version: '1.1.0',
    iconId: 'report',
    requirements: [
      {
        canonicalSlug: 'stripe',
        displayName: 'Stripe',
        iconComponent: SiStripe,
        connected: true,
        accountLabel: 'acct_1Qk…',
      },
      {
        canonicalSlug: 'hubspot',
        displayName: 'HubSpot',
        iconComponent: SiHubspot,
        connected: false,
      },
      {
        canonicalSlug: 'gdrive',
        displayName: 'Google Drive',
        iconComponent: SiGoogledrive,
        connected: true,
        accountLabel: 'haris@unify.ai',
      },
    ],
    capabilities: [],
    paramsSchema: [
      {
        name: 'template',
        label: 'House template',
        type: 'select',
        required: true,
        options: ['Board pack — 2026', 'Investor update'],
        help: 'The doc the pack is built from.',
      },
      {
        name: 'owner',
        label: 'Send draft to',
        type: 'text',
        required: false,
        help: 'Who reviews before it goes out.',
      },
    ],
    sets: {
      procedures: [{ name: 'Narrative structure' }, { name: 'Which numbers are quoted where' }],
      functions: [{ name: 'pull_revenue_metrics' }, { name: 'render_board_pack' }],
      knowledge: [{ name: 'Metric definitions' }, { name: 'Board tone' }],
      canvases: [{ name: 'Monthly KPIs' }],
      tasks: [{ name: 'Assemble board pack', schedule: 'On the 3rd of each month at 8:00am' }],
    },
  },
  {
    slug: 'receipt-collector',
    name: 'Receipt collector',
    category: 'ops',
    description:
      'Pulls receipts from your inbox, extracts vendor, date and total, and logs every line to your sheet.',
    version: '1.0.2',
    iconId: 'funnel',
    requirements: [
      {
        canonicalSlug: 'gmail',
        displayName: 'Gmail',
        iconComponent: SiGmail,
        connected: true,
        accountLabel: 'haris@unify.ai',
      },
      {
        canonicalSlug: 'sheets',
        displayName: 'Google Sheets',
        iconComponent: SiGooglesheets,
        connected: true,
        accountLabel: 'haris@unify.ai',
      },
    ],
    capabilities: [],
    paramsSchema: [
      {
        name: 'sheet',
        label: 'Destination sheet',
        type: 'select',
        required: true,
        options: ['Expenses 2026', 'Receipts — raw'],
        help: 'Where extracted receipts are written.',
      },
      {
        name: 'backfill',
        label: 'Backfill history',
        type: 'select',
        required: false,
        options: ['Last 18 months', 'Last 3 months', "Don't backfill"],
        help: 'One-off pass over old mail at install.',
      },
    ],
    sets: {
      procedures: [{ name: 'What counts as a receipt' }, { name: 'Currency and VAT handling' }],
      functions: [{ name: 'extract_receipt' }, { name: 'append_expense_row' }],
      knowledge: [{ name: 'Your expense categories' }],
      tables: [{ name: 'expenses_2026' }],
      tasks: [
        { name: 'Collect new receipts', schedule: 'Every day at 7:00pm, your timezone' },
        { name: 'Backfill receipts from mail history', schedule: 'Once, at install' },
      ],
    },
  },
  {
    slug: 'ship-prs',
    name: 'Ship PRs',
    category: 'build',
    description:
      'Picks up a scoped ticket, writes the fix on a branch, runs tests, and opens a PR for review.',
    version: '0.9.3',
    iconId: 'rocket',
    requirements: [
      {
        canonicalSlug: 'github',
        displayName: 'GitHub',
        iconComponent: SiGithub,
        connected: true,
        accountLabel: 'unifyai',
      },
      {
        canonicalSlug: 'linear',
        displayName: 'Linear',
        iconComponent: SiLinear,
        connected: true,
        accountLabel: 'unify',
      },
    ],
    capabilities: ['computer', 'filesystem'],
    paramsSchema: [
      {
        name: 'repo',
        label: 'Repository',
        type: 'select',
        required: true,
        options: ['unifyai/console', 'unifyai/brain'],
        help: 'Where branches and PRs are opened.',
      },
      {
        name: 'label',
        label: 'Only pick up tickets labelled',
        type: 'text',
        required: false,
        help: 'Leave blank to consider every scoped ticket.',
      },
    ],
    sets: {
      procedures: [
        { name: 'Branch and commit conventions' },
        { name: 'When to ask instead of guessing' },
      ],
      functions: [{ name: 'run_test_suite' }, { name: 'open_pull_request' }],
      knowledge: [{ name: 'Repo layout and ownership' }],
      tasks: [{ name: 'Pick up ready tickets', schedule: 'Every hour, weekdays' }],
    },
  },
  {
    slug: 'incident-response',
    name: 'Incident response',
    category: 'build',
    description:
      "Queries logs, summarises the root cause, names suspected owners, and follows up until it's closed.",
    version: '1.2.1',
    iconId: 'pulsar',
    requirements: [
      {
        canonicalSlug: 'github',
        displayName: 'GitHub',
        iconComponent: SiGithub,
        connected: true,
        accountLabel: 'unifyai',
      },
      {
        canonicalSlug: 'slack',
        displayName: 'Slack',
        iconComponent: SiSlack,
        connected: true,
        accountLabel: 'unify.slack.com',
      },
      {
        canonicalSlug: 'linear',
        displayName: 'Linear',
        iconComponent: SiLinear,
        connected: true,
        accountLabel: 'unify',
      },
    ],
    capabilities: ['computer'],
    paramsSchema: [
      {
        name: 'channel',
        label: 'Incident channel',
        type: 'select',
        required: true,
        options: ['#incidents', '#platform'],
        help: 'Where your teammate posts and listens.',
      },
      {
        name: 'sev',
        label: 'Engage from severity',
        type: 'select',
        required: false,
        options: ['Sev 1', 'Sev 2', 'Any'],
        help: 'Below this, it stays quiet.',
      },
    ],
    sets: {
      procedures: [{ name: 'Incident comms template' }, { name: 'Escalation ladder' }],
      functions: [{ name: 'query_logs' }, { name: 'summarise_root_cause' }],
      knowledge: [{ name: 'Service ownership map' }],
      canvases: [{ name: 'Incident timeline' }],
      tables: [{ name: 'incidents' }],
      tasks: [
        { name: 'Chase open incidents', schedule: 'Every 20 minutes, while an incident is open' },
      ],
    },
  },
  {
    slug: 'changelog-updates',
    name: 'Changelog updates',
    category: 'build',
    description:
      'When changes merge to main, it works out what shipped, writes it plainly, and posts to Notion.',
    version: '1.0.1',
    iconId: 'notes',
    requirements: [
      {
        canonicalSlug: 'github',
        displayName: 'GitHub',
        iconComponent: SiGithub,
        connected: true,
        accountLabel: 'unifyai',
      },
      {
        canonicalSlug: 'notion',
        displayName: 'Notion',
        iconComponent: SiNotion,
        connected: false,
      },
    ],
    capabilities: [],
    paramsSchema: [
      {
        name: 'repo',
        label: 'Repository',
        type: 'select',
        required: true,
        options: ['unifyai/console', 'unifyai/brain'],
        help: 'The repo watched for merges.',
      },
      {
        name: 'page',
        label: 'Notion page',
        type: 'select',
        required: true,
        options: ['Changelog', 'Release notes'],
        help: 'Where entries are posted.',
      },
    ],
    sets: {
      procedures: [{ name: 'Changelog voice — plain, no jargon' }],
      functions: [{ name: 'summarise_merged_prs' }],
      tasks: [{ name: 'Publish changelog', schedule: 'Every Thursday at 5:00pm, your timezone' }],
    },
  },
];

export const MOCK_WORKFLOW_INSTALLATIONS: WorkflowInstallation[] = [
  {
    slug: 'daily-briefing',
    status: 'active',
    installedVersion: '1.2.0',
    destination: { kind: 'personal' },
    params: { mailbox: 'haris@unify.ai', calendar: 'haris@unify.ai', deliver: 'Chat' },
    installedAtLabel: '12 Jun 2026',
    tasks: [
      {
        taskId: 'daily-briefing-task-0',
        name: 'Daily briefing',
        enabled: true,
        nextRunLabel: 'Tomorrow, 9:00am',
        lastRunLabel: 'Succeeded · today 9:00am',
        lastRunOutcome: 'success',
        href: '/tasks/daily-briefing-task-0',
      },
    ],
  },
  {
    slug: 'friday-inbox-cleanup',
    status: 'pending_requirements',
    installedVersion: '1.0.4',
    destination: { kind: 'personal' },
    params: { mailbox: 'haris@unify.ai', database: 'Inbox archive', olderThan: 30 },
    installedAtLabel: '2 Aug 2026',
    tasks: [
      {
        taskId: 'friday-inbox-cleanup-task-0',
        name: 'Friday inbox cleanup',
        enabled: false,
        nextRunLabel: 'Held — waiting on Notion',
        lastRunLabel: 'Never run',
        lastRunOutcome: 'never',
        href: '/tasks/friday-inbox-cleanup-task-0',
      },
    ],
  },
  {
    slug: 'receipt-collector',
    status: 'provisioning',
    installedVersion: '1.0.2',
    destination: { kind: 'personal' },
    params: { sheet: 'Expenses 2026', backfill: 'Last 18 months' },
    installedAtLabel: 'Today, 09:41',
    setup: {
      label: 'Backfilling receipts from mail history',
      percent: 62,
      detail: '1,140 of ~1,850 messages scanned · 214 receipts logged',
      etaLabel: 'about 6 minutes left',
      paused: false,
    },
    tasks: [
      {
        taskId: 'receipt-collector-task-0',
        name: 'Collect new receipts',
        enabled: false,
        nextRunLabel: 'Arms when setup finishes',
        lastRunLabel: '—',
        lastRunOutcome: 'never',
        href: '/tasks/receipt-collector-task-0',
      },
    ],
  },
  {
    slug: 'meeting-recaps',
    status: 'active',
    installedVersion: '1.0.1',
    destination: { kind: 'team', teamId: 'team-revenue', teamName: 'Acme Revenue', memberCount: 8 },
    params: { calendar: 'Team — Revenue', project: 'Revenue', cc: 'chiefofstaff@acme.com' },
    installedAtLabel: '4 Apr 2026',
    tasks: [
      {
        taskId: 'meeting-recaps-task-0',
        name: 'Recap finished meetings',
        enabled: true,
        nextRunLabel: 'When the next meeting ends',
        lastRunLabel: 'Succeeded · yesterday 4:12pm',
        lastRunOutcome: 'success',
        href: '/tasks/meeting-recaps-task-0',
      },
    ],
  },
  {
    slug: 'invoice-reconcile',
    status: 'failed',
    installedVersion: '1.4.0',
    destination: { kind: 'personal' },
    params: { folder: 'Finance / Contracts', tolerance: 2 },
    installedAtLabel: '28 Jul 2026',
    failures: [
      {
        kind: 'functions',
        name: 'parse_invoice_pdf',
        reason: "Dependency pdfplumber failed to build on the teammate's computer",
      },
      {
        kind: 'knowledge',
        name: 'Contract renewal dates',
        reason: 'Source folder returned 403 — Drive scope missing',
      },
    ],
    tasks: [
      {
        taskId: 'invoice-reconcile-task-0',
        name: 'Reconcile new invoices',
        enabled: true,
        nextRunLabel: 'Tomorrow, 6:00am',
        lastRunLabel: 'Partial · today 6:00am — 4 invoices skipped',
        lastRunOutcome: 'partial',
        href: '/tasks/invoice-reconcile-task-0',
      },
    ],
  },
];

export const MOCK_WORKFLOW_GALLERY_ITEMS: WorkflowGalleryItem[] = MOCK_WORKFLOWS.map(
  (workflow) => ({
    workflow,
    installation: MOCK_WORKFLOW_INSTALLATIONS.find(
      (installation) => installation.slug === workflow.slug
    ),
  })
);
