import { Globe } from 'lucide-react';
import {
  SiGithub,
  SiGmail,
  SiGoogle,
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
import { camelToSnakeObject } from '@/utils/casing';
import type {
  Workflow,
  WorkflowArtifact,
  WorkflowGalleryItem,
  WorkflowInstallation,
  WorkflowManifestItem,
  WorkflowSurfaceKind,
} from '@/types/workflows';

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
    about:
      'Every weekday at 08:30 your assistant assembles one chat message with the three things worth knowing before stand-up: the rest of today\u2019s calendar with context, the unread email that actually needs you, and any commitment starting to slip.\n\n**Needs you** is triaged, not dumped \u2014 an email earns its line only when it asks you a direct question, comes from someone you meet today, blocks someone else\u2019s work, touches your stated focus, or carries a deadline inside two working days.',
    version: '1.2.0',
    iconId: 'briefing',
    requirements: [
      {
        canonicalSlug: 'google_calendar',
        displayName: 'Google Calendar',
        via: 'connection',
        iconComponent: SiGooglecalendar,
        connected: true,
        accountLabel: 'haris@unify.ai',
      },
      {
        canonicalSlug: 'gmail',
        displayName: 'Gmail',
        via: 'connection',
        iconComponent: SiGmail,
        connected: true,
        accountLabel: 'haris@unify.ai',
      },
      {
        canonicalSlug: 'slack',
        displayName: 'Slack',
        via: 'connection',
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
    about:
      'Every Friday afternoon the assistant sweeps the week\u2019s inbox: replies you owe, threads worth filing, and everything safe to archive. It follows your triage rules to the letter \u2014 never-archive senders are never touched, and project threads are filed into Notion where the rest of their history lives.\n\nYou get one summary message when it finishes: what was answered, what was filed, and what it deliberately left for you.',
    version: '1.0.4',
    iconId: 'comet',
    requirements: [
      {
        canonicalSlug: 'google_workspace',
        displayName: 'Google Workspace',
        via: 'workspace',
        iconComponent: SiGoogle,
        connected: false,
      },
      {
        canonicalSlug: 'gmail',
        displayName: 'Gmail',
        via: 'connection',
        iconComponent: SiGmail,
        connected: true,
        accountLabel: 'haris@unify.ai',
      },
      {
        canonicalSlug: 'notion',
        displayName: 'Notion',
        via: 'connection',
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
    // The Workspace route, uninstalled: the one requirement whose fix is the
    // profile's own workspace manager rather than the integrations gallery.
    // Present so that path is walkable in mock mode from install to armed.
    slug: 'meeting-prep',
    name: 'Meeting prep',
    category: 'comms',
    description:
      'Half an hour before each meeting, a short brief on who you are seeing and what you last said to them.',
    about:
      'Walking into a meeting cold is rarely a knowledge problem — the context is in last month\u2019s thread, in the doc someone shared on Tuesday. It is just not in your head at 9:58.\n\nThirty minutes before each meeting, a brief arrives: who is attending, the last substantive exchange with each of them, anything attached to the invite, and any commitment of yours still open with those people. It closes with the one thing most likely to need deciding, phrased as a question.\n\nThis reads your own calendar and mailbox, so it needs your Workspace connected \u2014 the account you connect once in your profile, not a third-party app.',
    version: '0.0.1',
    iconId: 'scope',
    requirements: [
      {
        canonicalSlug: 'google_workspace',
        displayName: 'Google Workspace',
        via: 'workspace',
        iconComponent: SiGoogle,
        connected: false,
      },
    ],
    capabilities: [],
    paramsSchema: [
      {
        name: 'leadMinutes',
        label: 'Send the brief',
        type: 'number',
        required: false,
        suffix: 'minutes before',
        help: 'How long before a meeting the brief arrives. Left empty, 30 minutes.',
      },
      {
        name: 'skipRecurring',
        label: 'Skip recurring meetings',
        type: 'boolean',
        required: false,
        help: 'Leave standing meetings alone \u2014 a daily stand-up rarely needs a brief.',
      },
    ],
    sets: {
      procedures: [
        { name: 'How to write a meeting brief' },
        { name: 'Which meetings get a brief' },
      ],
      functions: [{ name: 'brief_window' }],
      knowledge: [{ name: 'What counts as a substantive exchange' }],
      tasks: [
        { name: 'Brief the next meeting', schedule: 'Every weekday at 7:45am, your timezone' },
      ],
    },
  },
  {
    slug: 'meeting-recaps',
    name: 'Meeting recaps',
    category: 'comms',
    description:
      'Writes the recap, opens action-item tickets, and emails a clean summary to everyone who was there.',
    about:
      'Within half an hour of a meeting ending, a recap lands: decisions, owners and deadlines, in a structure your team already recognises. Action items become tickets on their own, and every recap is copied to whoever you choose.\n\nRecaps lean on your team\u2019s vocabulary and project codenames, so \u2018the Q3 doc\u2019 resolves to the right artifact.',
    version: '1.3.0',
    iconId: 'signal',
    requirements: [
      {
        canonicalSlug: 'google_meet',
        displayName: 'Google Meet',
        via: 'connection',
        iconComponent: SiGooglemeet,
        connected: true,
        accountLabel: 'haris@unify.ai',
      },
      {
        canonicalSlug: 'linear',
        displayName: 'Linear',
        via: 'connection',
        iconComponent: SiLinear,
        connected: true,
        accountLabel: 'unify',
      },
      {
        canonicalSlug: 'gmail',
        displayName: 'Gmail',
        via: 'connection',
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
    about:
      'Every Monday morning a fresh batch of prospects arrives \u2014 scored against your ICP rubric, deduped against every segment you have already worked, and pushed to your CRM. A sourcing-funnel canvas keeps the pipeline picture live between batches.\n\nInstalling also runs a one-off backfill of your existing CRM contacts, so scoring starts from what you already know rather than an empty table.',
    version: '2.0.1',
    iconId: 'radar',
    requirements: [
      {
        canonicalSlug: 'linkedin',
        displayName: 'LinkedIn',
        via: 'connection',
        iconComponent: SiLinkedin,
        connected: false,
      },
      {
        canonicalSlug: 'hubspot',
        displayName: 'HubSpot',
        via: 'connection',
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
        { name: 'Backfill existing CRM contacts', schedule: 'Once, at install', runsOnce: true },
      ],
    },
  },
  {
    slug: 'sales-qualification',
    name: 'Sales qualification',
    category: 'growth',
    description:
      'Handles first-touch replies, scores intent, logs to the CRM, and pings you the moment a lead is warm.',
    about:
      'Every reply to your outbound is scored for intent within fifteen minutes and logged to the CRM. High-intent replies raise an alert immediately; first-touch responses use only the voice and the pricing answers you have approved, never improvisation.',
    version: '1.1.2',
    iconId: 'beam',
    requirements: [
      {
        canonicalSlug: 'gmail',
        displayName: 'Gmail',
        via: 'connection',
        iconComponent: SiGmail,
        connected: true,
        accountLabel: 'haris@unify.ai',
      },
      {
        canonicalSlug: 'hubspot',
        displayName: 'HubSpot',
        via: 'connection',
        iconComponent: SiHubspot,
        connected: false,
      },
      {
        canonicalSlug: 'slack',
        displayName: 'Slack',
        via: 'connection',
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
    about:
      'Twice a week the assistant sweeps your rivals\u2019 pages, diffs each one against its last snapshot, and writes a change note only when something meaningful moved \u2014 pricing, positioning, a new product. Cosmetic churn never reaches you.',
    version: '1.0.0',
    iconId: 'scope',
    requirements: [
      {
        canonicalSlug: 'web',
        displayName: 'Web browsing',
        via: 'undeclared',
        iconUrl: null,
        iconComponent: Globe,
        connected: true,
      },
      {
        canonicalSlug: 'notion',
        displayName: 'Notion',
        via: 'connection',
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
    about:
      'Invoices landing in your folder are parsed and matched line by line against Stripe payouts. Matches inside your tolerance reconcile silently; anything outside it escalates to a human with the discrepancy spelled out, never quietly written off.',
    version: '1.4.0',
    iconId: 'scales',
    requirements: [
      {
        canonicalSlug: 'gmail',
        displayName: 'Gmail',
        via: 'connection',
        iconComponent: SiGmail,
        connected: true,
        accountLabel: 'haris@unify.ai',
      },
      {
        canonicalSlug: 'google_drive',
        displayName: 'Google Drive',
        via: 'connection',
        iconComponent: SiGoogledrive,
        connected: true,
        accountLabel: 'haris@unify.ai',
      },
      {
        canonicalSlug: 'stripe',
        displayName: 'Stripe',
        via: 'connection',
        iconComponent: SiStripe,
        connected: true,
        accountLabel: 'acct_1Qk…',
      },
      {
        canonicalSlug: 'employmenthero',
        displayName: 'Employment Hero',
        via: 'native_package',
        connected: false,
        missingSecrets: ['EMPLOYMENT_HERO_CLIENT_ID', 'EMPLOYMENT_HERO_CLIENT_SECRET'],
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
    about:
      'By the 5th of every month the pack is assembled in your house style: revenue and burn from Stripe, pipeline from HubSpot, and the KPIs you track \u2014 each figure sourced, each chart consistent with last month\u2019s.\n\nYou review and send; the assistant never mails the board directly.',
    version: '1.1.0',
    iconId: 'report',
    requirements: [
      {
        canonicalSlug: 'stripe',
        displayName: 'Stripe',
        via: 'connection',
        iconComponent: SiStripe,
        connected: true,
        accountLabel: 'acct_1Qk…',
      },
      {
        canonicalSlug: 'hubspot',
        displayName: 'HubSpot',
        via: 'connection',
        iconComponent: SiHubspot,
        connected: false,
      },
      {
        canonicalSlug: 'google_drive',
        displayName: 'Google Drive',
        via: 'connection',
        iconComponent: SiGoogledrive,
        connected: false,
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
    about:
      'Receipts are pulled from your inbox as they arrive; vendor, date and total are extracted and logged to your sheet, one line per receipt, duplicates skipped. Month-end stops being an archaeology dig.',
    version: '1.0.2',
    iconId: 'funnel',
    requirements: [
      {
        canonicalSlug: 'gmail',
        displayName: 'Gmail',
        via: 'connection',
        iconComponent: SiGmail,
        connected: true,
        accountLabel: 'haris@unify.ai',
      },
      {
        canonicalSlug: 'google_sheets',
        displayName: 'Google Sheets',
        via: 'connection',
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
        {
          name: 'Backfill receipts from mail history',
          schedule: 'Once, at install',
          runsOnce: true,
        },
      ],
    },
  },
  {
    slug: 'ship-prs',
    name: 'Ship PRs',
    category: 'build',
    description:
      'Picks up a scoped ticket, writes the fix on a branch, runs tests, and opens a PR for review.',
    about:
      'Give it a scoped ticket and it writes the fix on a branch, runs the tests, and opens a PR for review with the reasoning in the description. Nothing merges without a human approval \u2014 the assistant\u2019s job ends at the review line.',
    version: '0.9.3',
    iconId: 'rocket',
    requirements: [
      {
        canonicalSlug: 'github',
        displayName: 'GitHub',
        via: 'connection',
        iconComponent: SiGithub,
        connected: true,
        accountLabel: 'unifyai',
      },
      {
        canonicalSlug: 'linear',
        displayName: 'Linear',
        via: 'connection',
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
    about:
      'When an incident opens, the assistant queries the logs, summarises the likely root cause, names the suspected owners, and keeps following up in the channel until the incident is closed \u2014 not until people stop replying.',
    version: '1.2.1',
    iconId: 'pulsar',
    requirements: [
      {
        canonicalSlug: 'github',
        displayName: 'GitHub',
        via: 'connection',
        iconComponent: SiGithub,
        connected: true,
        accountLabel: 'unifyai',
      },
      {
        canonicalSlug: 'slack',
        displayName: 'Slack',
        via: 'connection',
        iconComponent: SiSlack,
        connected: true,
        accountLabel: 'unify.slack.com',
      },
      {
        canonicalSlug: 'linear',
        displayName: 'Linear',
        via: 'connection',
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
    about:
      'When changes merge to main, the assistant works out what actually shipped \u2014 not the commit messages, the user-visible change \u2014 writes it plainly, and posts it to your Notion changelog the same day.',
    version: '1.0.1',
    iconId: 'notes',
    requirements: [
      {
        canonicalSlug: 'github',
        displayName: 'GitHub',
        via: 'connection',
        iconComponent: SiGithub,
        connected: true,
        accountLabel: 'unifyai',
      },
      {
        canonicalSlug: 'notion',
        displayName: 'Notion',
        via: 'connection',
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
    status: 'partial',
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

/**
 * Hand-authored bodies for the flagship's artifacts, keyed
 * `slug/kind/name`. Everything else gets a readable generated body so
 * every manifest row previews something in mock mode.
 */
const MOCK_ARTIFACT_BODIES: Record<string, string> = {
  'daily-briefing/procedures/Briefing tone and length': [
    'Assemble the briefing in three sections, in this order, and keep the whole thing scannable in under a minute.',
    '1. **Today** — the calendar for the rest of the working day: each meeting with its time, who it is with, and the one thing worth knowing walking in. Flag conflicts and back-to-backs.',
    '2. **Needs you** — unread email that actually matters. Each item is one line: sender, ask, and why now. Never paste whole emails.',
    '3. **Slipping** — commitments drifting past their point of no return.',
    'Deliver as one chat message. Empty sections are stated in one line (“Nothing slipping today”), never padded.',
  ].join('\n\n'),
  'daily-briefing/procedures/What counts as “slipping”': [
    'A commitment is slipping once any of these holds:',
    '- a thread has waited **2+ working days** for your reply;',
    '- a deadline is inside **48 hours** with no visible progress;',
    '- a promise recorded in email or a meeting has had no activity since it was made.',
    'Weekends and out-of-office windows never count as waiting time.',
  ].join('\n\n'),
  'daily-briefing/knowledge/Your working hours': [
    'The briefing treats 09:00–18:00, Monday to Friday, as working time.',
    'It anchors the “working days” arithmetic everywhere: what counts as waiting, when the scan window opens, and which deadlines are inside two working days.',
  ].join('\n\n'),
  'daily-briefing/tasks/Daily briefing': [
    'Compose and deliver the morning briefing: today’s calendar with context, the unread email that matters, and anything slipping.',
    'Reads the installation settings before assembling — a non-empty **focus** names projects, people or deadlines that must always be checked, even on quiet days.',
  ].join('\n\n'),
};

const MOCK_ARTIFACT_DEFAULTS: Record<string, (name: string) => string> = {
  procedures: (name) =>
    `The step-by-step the assistant follows for **${name.toLowerCase()}** — when it applies, the order of operations, and what done looks like.\n\nPlanted into Guidance at install; edit it there and the assistant follows your version.`,
  functions: (name) =>
    `\`${name}\` — a stored function the workflow's jobs call.\n\nPlanted into Functions at install with its full implementation and docstring.`,
  knowledge: (name) =>
    `A claim the assistant treats as true while doing this job: **${name.toLowerCase()}**.\n\nPlanted into Knowledge at install, with its provenance.`,
  tasks: (name) =>
    `The recurring job **${name.toLowerCase()}** — planted disarmed and armed once every required app is connected.`,
  canvases: (name) =>
    `**${name}** — a live view bound to the workflow's stored table, refreshed server-side on every read.`,
  tables: (name) =>
    `\`${name}\` — the stored table this workflow reads and writes. Declared at install; rows arrive from the jobs, never from the bundle.`,
};

/**
 * The per-kind extras unify publishes on a content row, so mock mode exercises
 * the same native views the live shelf feeds — a function's signature block, a
 * task's field grid — rather than only the markdown body.
 */
const MOCK_ARTIFACT_META: Partial<
  Record<WorkflowSurfaceKind, (item: WorkflowManifestItem) => Record<string, unknown>>
> = {
  // Converted rather than hand-written: these mirror the snake_case row
  // fields unify publishes, and writing that casing out by hand is what the
  // naming rule is there to stop.
  functions: (item) =>
    camelToSnakeObject({
      language: 'python',
      argspec: `(now_iso: 'str | None' = None) -> 'dict'`,
      verify: true,
      isPrimitive: false,
      implementation: `def ${item.name}(now_iso=None):\n    return {'calendar_start': now_iso}`,
    }),
  tasks: (item) =>
    camelToSnakeObject({
      repeat: item.runsOnce ? [] : [{ frequency: 'weekly', timeOfDay: '09:00:00' }],
      priority: 'normal',
      tags: ['mock'],
    }),
  knowledge: () =>
    camelToSnakeObject({ kind: 'definition', status: 'active', topics: ['mock', 'briefing'] }),
  procedures: () => camelToSnakeObject({ functionNames: ['build_daily_briefing'] }),
};

/** Published-artifact previews for one mock workflow, derived from its manifest. */
export function mockWorkflowArtifacts(slug: string): WorkflowArtifact[] {
  const workflow = MOCK_WORKFLOWS.find((candidate) => candidate.slug === slug);
  if (!workflow) return [];
  return (Object.entries(workflow.sets) as [WorkflowSurfaceKind, WorkflowManifestItem[]][]).flatMap(
    ([kind, items]) =>
      (items ?? []).map((item) => ({
        contentKey: `${slug}/${kind}/${item.name}`,
        slug,
        kind,
        name: item.name,
        body:
          MOCK_ARTIFACT_BODIES[`${slug}/${kind}/${item.name}`] ??
          MOCK_ARTIFACT_DEFAULTS[kind](item.name),
        schedule: item.schedule,
        meta: MOCK_ARTIFACT_META[kind]?.(item) ?? {},
      }))
  );
}
