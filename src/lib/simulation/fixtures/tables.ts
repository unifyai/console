/**
 * Per-surface mock fixtures, keyed by context table path.
 *
 * Each key is the context path *relative* to the assistant/team prefix that the
 * Orchestra client strips off (e.g. `Contacts`, `Tasks/Runs`,
 * `Knowledge/Products`, `Events/ManagerMethod`, `Data/CRM/contacts`). Each value
 * is the list of log `entries` payloads for that table, in camelCase (the UI
 * consumes camelCase and the response pipeline is idempotent for camelCase).
 *
 * Row shapes mirror the real Pydantic-derived types in `types/assistants/*` so
 * every revamped surface renders correctly-shaped, screenshot-faithful data.
 */

import type { MockDataset, MockRow, MockTables } from '../types';

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();
}

function isoInMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

// Contact ids referenced across Contacts + Transcripts so sender/receiver names resolve.
const MARTY = 1;
const HARIS = 2;
const OLIVIA = 3;
const MEI = 4;
const TOMAS = 5;
const AISHA = 6;
const DANIEL = 7;
const PRIYA = 8;

const contacts: MockRow[] = [
  {
    contactId: MARTY,
    firstName: 'Marty',
    surname: null,
    emailAddress: 'marty@droid.ai',
    phoneNumber: null,
    whatsappNumber: null,
    discordId: null,
    jobTitle: 'Coordinator',
    company: 'Droid',
    bio: 'Your coordinator. Routes work to specialist assistants and keeps the brain tidy.',
    rollingSummary: 'Acts as the front door for every request; delegates and follows up.',
    tags: ['assistant', 'system'],
    responsePolicy: 'always',
    shouldRespond: true,
    timezone: 'Europe/London',
    isSystem: true,
  },
  {
    contactId: HARIS,
    firstName: 'Haris',
    surname: 'Mahmood',
    emailAddress: 'haris@droid.ai',
    phoneNumber: '+44 7700 900112',
    whatsappNumber: '+44 7700 900112',
    discordId: 'haris#0001',
    jobTitle: 'Founder',
    company: 'Droid',
    bio: 'Owner of this workspace. Prefers concise updates and morning digests.',
    rollingSummary: 'Drives the Riverside housing pilot and the agentic research cadence.',
    tags: ['owner', 'vip'],
    responsePolicy: 'always',
    shouldRespond: true,
    timezone: 'Europe/London',
    isSystem: true,
  },
  {
    contactId: OLIVIA,
    firstName: 'Olivia',
    surname: 'Watson',
    emailAddress: 'olivia.watson@riverside.gov.uk',
    phoneNumber: '+44 7700 900145',
    whatsappNumber: null,
    discordId: null,
    jobTitle: 'Programme Lead',
    company: 'Riverside Council',
    bio: 'Sponsor for the Q3 housing pilot. Cares about throughput and rework rate.',
    rollingSummary: 'Signed off the dashboard; expects weekly KPI roll-ups.',
    tags: ['internal', 'vip', 'housing'],
    responsePolicy: 'business_hours',
    shouldRespond: true,
    timezone: 'Europe/London',
    isSystem: false,
  },
  {
    contactId: MEI,
    firstName: 'Mei',
    surname: 'Lin',
    emailAddress: 'mei.lin@stripe.com',
    phoneNumber: '+1 415 555 0162',
    whatsappNumber: null,
    discordId: null,
    jobTitle: 'Account Manager',
    company: 'Stripe',
    bio: 'Stripe account manager. Point of contact for payout reconciliation.',
    rollingSummary: 'Escalation path for failed payouts on the Stripe watcher task.',
    tags: ['vendor'],
    responsePolicy: 'manual',
    shouldRespond: false,
    timezone: 'America/Los_Angeles',
    isSystem: false,
  },
  {
    contactId: TOMAS,
    firstName: 'Tomas',
    surname: 'Novak',
    emailAddress: 'tomas@brightfin.io',
    phoneNumber: '+420 777 123 456',
    whatsappNumber: null,
    discordId: null,
    jobTitle: 'CEO',
    company: 'Brightfin',
    bio: 'Founder of Brightfin. Prospect surfaced by the agentic research task.',
    rollingSummary: 'Warm lead in fintech vertical; awaiting a tailored intro.',
    tags: ['founder', 'prospect'],
    responsePolicy: 'manual',
    shouldRespond: false,
    timezone: 'Europe/Prague',
    isSystem: false,
  },
  {
    contactId: AISHA,
    firstName: 'Aisha',
    surname: 'Khan',
    emailAddress: 'a.khan@northwind.org',
    phoneNumber: '+44 7700 900177',
    whatsappNumber: null,
    discordId: null,
    jobTitle: 'Head of Procurement',
    company: 'Northwind',
    bio: 'Procurement lead evaluating the platform for a public-sector rollout.',
    rollingSummary: 'Requested SMS updates; sensitive to data-residency questions.',
    tags: ['procurement', 'prospect'],
    responsePolicy: 'manual',
    shouldRespond: false,
    timezone: 'Europe/London',
    isSystem: false,
  },
  {
    contactId: DANIEL,
    firstName: 'Daniel',
    surname: 'Reyes',
    emailAddress: 'daniel@clientbeta.app',
    phoneNumber: null,
    whatsappNumber: null,
    discordId: null,
    jobTitle: 'CTO',
    company: 'ClientBeta',
    bio: 'Technical partner on the ClientBeta Riverside integration.',
    rollingSummary: 'Owns the data feed powering the operative-supervisor dashboard.',
    tags: ['partner'],
    responsePolicy: 'business_hours',
    shouldRespond: true,
    timezone: 'Europe/London',
    isSystem: false,
  },
  {
    contactId: PRIYA,
    firstName: 'Priya',
    surname: 'Nair',
    emailAddress: 'priya.nair@droid.ai',
    phoneNumber: '+44 7700 900190',
    whatsappNumber: null,
    discordId: null,
    jobTitle: 'Operations',
    company: 'Droid',
    bio: 'Operations teammate; coordinates the Riverside ops WhatsApp group.',
    rollingSummary: 'Keeps field operatives in sync on daily routes.',
    tags: ['internal'],
    responsePolicy: 'always',
    shouldRespond: true,
    timezone: 'Europe/London',
    isSystem: false,
  },
];

// Transcripts grouped by exchangeId, varied mediums so the channel rail populates.
const transcripts: MockRow[] = [
  // Exchange 1 — email thread (housing pilot kickoff)
  {
    messageId: 1001,
    medium: 'email',
    senderId: OLIVIA,
    receiverIds: [HARIS, MARTY],
    authoringAssistantId: null,
    timestamp: isoDaysAgo(6),
    content:
      'Subject: Q3 housing pilot — kickoff & dashboard sign-off\n\nHi Haris, sharing the kickoff notes. Can we get the operative-supervisor dashboard wired before the pilot start?',
    exchangeId: 1,
  },
  {
    messageId: 1002,
    medium: 'email',
    senderId: MARTY,
    receiverIds: [OLIVIA, HARIS],
    authoringAssistantId: 1001,
    timestamp: isoDaysAgo(6),
    content:
      'Thanks Olivia — dashboard is in progress. Daniel is finalising the ClientBeta feed; I will post the first KPI roll-up by Friday.',
    exchangeId: 1,
  },
  {
    messageId: 1003,
    medium: 'email',
    senderId: HARIS,
    receiverIds: [OLIVIA, DANIEL],
    authoringAssistantId: null,
    timestamp: isoDaysAgo(5),
    content: 'Signed off. Let us track throughput and rework rate as the headline metrics.',
    exchangeId: 1,
  },
  // Exchange 2 — direct chat with Haris
  {
    messageId: 1010,
    medium: 'unify_message',
    senderId: HARIS,
    receiverIds: [MARTY],
    authoringAssistantId: null,
    timestamp: isoMinutesAgo(180),
    content: 'Can you pull the 5 most recent emails from the Brightfin thread?',
    exchangeId: 2,
  },
  {
    messageId: 1011,
    medium: 'unify_message',
    senderId: MARTY,
    receiverIds: [HARIS],
    authoringAssistantId: 1001,
    timestamp: isoMinutesAgo(179),
    content: 'On it — fetching from Gmail now.',
    exchangeId: 2,
  },
  {
    messageId: 1012,
    medium: 'unify_message',
    senderId: HARIS,
    receiverIds: [MARTY],
    authoringAssistantId: null,
    timestamp: isoMinutesAgo(120),
    content: 'Great. Also add Tomas to the warm-leads list.',
    exchangeId: 2,
  },
  {
    messageId: 1013,
    medium: 'unify_message',
    senderId: MARTY,
    receiverIds: [HARIS],
    authoringAssistantId: 1001,
    timestamp: isoMinutesAgo(119),
    content: 'Done. Tomas Novak (Brightfin) tagged as prospect.',
    exchangeId: 2,
  },
  // Exchange 3 — Riverside ops WhatsApp group
  {
    messageId: 1020,
    medium: 'whatsapp',
    senderId: PRIYA,
    receiverIds: [MARTY, HARIS],
    authoringAssistantId: null,
    timestamp: isoMinutesAgo(60),
    content: 'Morning routes are out. Two operatives off sick — can we rebalance?',
    exchangeId: 3,
  },
  {
    messageId: 1021,
    medium: 'whatsapp',
    senderId: MARTY,
    receiverIds: [PRIYA],
    authoringAssistantId: 1001,
    timestamp: isoMinutesAgo(58),
    content: 'Rebalanced — moved 4 jobs to the afternoon crew. Updated the dashboard.',
    exchangeId: 3,
  },
  // Exchange 4 — recurring task review call
  {
    messageId: 1030,
    medium: 'unify_meet',
    senderId: HARIS,
    receiverIds: [MARTY, OLIVIA],
    authoringAssistantId: null,
    timestamp: isoDaysAgo(2),
    content:
      'Call: Recurring task review (3-way) — 14 min. Agreed to keep the 30-min research cadence.',
    exchangeId: 4,
  },
  // Exchange 5 — SMS with Aisha
  {
    messageId: 1040,
    medium: 'sms',
    senderId: AISHA,
    receiverIds: [MARTY],
    authoringAssistantId: null,
    timestamp: isoMinutesAgo(300),
    content: 'Where is data stored for the pilot? Need it for the procurement review.',
    exchangeId: 5,
  },
  {
    messageId: 1041,
    medium: 'sms',
    senderId: MARTY,
    receiverIds: [AISHA],
    authoringAssistantId: 1001,
    timestamp: isoMinutesAgo(298),
    content: 'EU (Frankfurt). I will send the data-residency one-pager by email.',
    exchangeId: 5,
  },
];

const knowledgeProducts: MockRow[] = [
  {
    title: 'recurring_syncs',
    body: 'Operational policy for durable, recurring CRM sync jobs. Each sync is idempotent and resumable; failures retry with backoff and surface to the Tasks activity feed.',
    tags: ['CRM', 'Tasks', 'Scheduler', 'Durable'],
    scope: 'personal',
    updatedAt: isoDaysAgo(3),
  },
  {
    title: 'source_of_truth',
    body: 'The CRM contacts context is the canonical source of truth for people. Data-layer tables are derived caches and must never be edited directly.',
    tags: ['Data', 'CRM'],
    scope: 'personal',
    updatedAt: isoDaysAgo(8),
  },
];

const knowledgeFaq: MockRow[] = [
  {
    title: 'bronze_cache',
    body: 'Bronze tables hold raw ingested rows before normalisation. Treat as append-only; the silver layer reconciles duplicates nightly.',
    tags: ['Data', 'Pipeline'],
    scope: 'personal',
    updatedAt: isoDaysAgo(5),
  },
  {
    title: 'data_residency',
    body: 'All pilot data is stored in the EU (Frankfurt). Share the data-residency one-pager with procurement contacts on request.',
    tags: ['Compliance', 'Housing'],
    scope: 'personal',
    updatedAt: isoDaysAgo(1),
  },
];

const functionsPrimitives: MockRow[] = [
  {
    functionId: 9001,
    name: 'primitives.tasks.update',
    language: 'python',
    argspec:
      'update(task_id: int, *, status: str | None = None, schedule: dict | None = None) -> Task',
    docstring: 'Update fields on an existing scheduled task. Returns the updated task record.',
    implementation: null,
    isPrimitive: true,
    dependsOn: [],
    guidanceIds: [],
  },
  {
    functionId: 9002,
    name: 'primitives.tasks.execute',
    language: 'python',
    argspec: 'execute(task_id: int, *, reason: str | None = None) -> TaskRun',
    docstring: 'Run a task immediately, outside its schedule. Appends a run to Tasks/Runs.',
    implementation: null,
    isPrimitive: true,
    dependsOn: [],
    guidanceIds: [],
  },
  {
    functionId: 9003,
    name: 'primitives.data.update_rows',
    language: 'python',
    argspec: 'update_rows(context: str, rows: list[dict], *, key: str) -> int',
    docstring: 'Upsert rows into a data-layer context by key. Returns the number of rows written.',
    implementation: null,
    isPrimitive: true,
    dependsOn: [],
    guidanceIds: [],
  },
  {
    functionId: 9004,
    name: 'primitives.data.search',
    language: 'python',
    argspec: 'search(context: str, query: str, *, limit: int = 20) -> list[dict]',
    docstring: 'Semantic + keyword search over a data-layer context.',
    implementation: null,
    isPrimitive: true,
    dependsOn: [],
    guidanceIds: [],
  },
];

const functionsCompositional: MockRow[] = [
  {
    functionId: 9101,
    name: 'gmail_inbox_digest',
    language: 'python',
    argspec: 'gmail_inbox_digest(*, since: str, max_items: int = 10) -> str',
    docstring: 'Summarise the most recent unread emails into a morning digest.',
    implementation:
      'def gmail_inbox_digest(*, since, max_items=10):\n    msgs = gmail.search(f"is:unread after:{since}")[:max_items]\n    return summarise([m.snippet for m in msgs])',
    isPrimitive: false,
    dependsOn: ['primitives.data.search'],
    guidanceIds: [101],
  },
  {
    functionId: 9102,
    name: 'reconcile_stripe_payout',
    language: 'python',
    argspec: 'reconcile_stripe_payout(payout_id: str) -> dict',
    docstring: 'Match a Stripe payout against expected invoices and flag discrepancies.',
    implementation:
      'def reconcile_stripe_payout(payout_id):\n    payout = stripe.payouts.retrieve(payout_id)\n    expected = data.search("Finance/invoices", payout.arrival_date)\n    return diff(payout, expected)',
    isPrimitive: false,
    dependsOn: ['primitives.data.update_rows'],
    guidanceIds: [],
  },
];

const guidance: MockRow[] = [
  {
    guidanceId: 101,
    title: 'Emergency direct cancellation of recurring TaskScheduler rows',
    content:
      'If a recurring task misfires, cancel it directly via primitives.tasks.update(status="cancelled") rather than deleting the row, so run history is preserved.',
    linkedImages: [],
    tags: ['Tasks'],
    scope: 'personal',
    isBuiltin: false,
    functionIds: [9001],
  },
  {
    guidanceId: 102,
    title: 'Microsoft Graph SharePoint workflow for document ingestion',
    content:
      'Built-in playbook for authenticating to Microsoft Graph and ingesting SharePoint documents.',
    linkedImages: [],
    tags: ['Integrations'],
    scope: 'builtin',
    isBuiltin: true,
    functionIds: [],
  },
  {
    guidanceId: 103,
    title: 'Read-only Microsoft SharePoint / OneDrive access check',
    content: 'Built-in pre-flight that verifies read-only scopes before attempting document reads.',
    linkedImages: [],
    tags: ['Integrations'],
    scope: 'builtin',
    isBuiltin: true,
    functionIds: [],
  },
  {
    guidanceId: 104,
    title: 'Repo lookup',
    content:
      'Built-in GitHub playbook: resolve a repository by name and summarise its README and structure.',
    linkedImages: [],
    tags: ['GitHub'],
    scope: 'builtin',
    isBuiltin: true,
    functionIds: [],
  },
  {
    guidanceId: 105,
    title: 'Issue triage',
    content: 'Built-in GitHub playbook: label, prioritise, and route incoming issues.',
    linkedImages: [],
    tags: ['GitHub'],
    scope: 'builtin',
    isBuiltin: true,
    functionIds: [],
  },
  {
    guidanceId: 106,
    title: 'Web fetching',
    content: 'Built-in playbook for fetching and extracting readable content from a URL.',
    linkedImages: [],
    tags: ['Web'],
    scope: 'builtin',
    isBuiltin: true,
    functionIds: [],
  },
  {
    guidanceId: 107,
    title: 'CRM document ingestion policy',
    content:
      'When ingesting CRM documents, dedupe by email then by full name; never overwrite source_of_truth.',
    linkedImages: [],
    tags: ['CRM'],
    scope: 'personal',
    isBuiltin: false,
    functionIds: [],
  },
  {
    guidanceId: 108,
    title: 'CRM evidence matching policy',
    content:
      'Attach the supporting email or document id to every CRM stage change so the trail is auditable.',
    linkedImages: [],
    tags: ['CRM'],
    scope: 'personal',
    isBuiltin: false,
    functionIds: [],
  },
];

const tasks: MockRow[] = [
  {
    taskId: 2001,
    name: 'Agentic AI Vertical Sector Research',
    description:
      'Scan funding announcements, product launches, and hiring signals across target verticals; surface warm leads with a tailored intro draft.',
    status: 'active',
    triggerType: 'recurring',
    cadence: 'Every 30 minutes',
    startAt: isoDaysAgo(25),
    nextDueAt: isoInMinutes(18),
    owner: 'Haris Mahmood',
    offline: false,
    entrypoint: 9101,
    createdAt: isoDaysAgo(25),
    updatedAt: isoMinutesAgo(30),
    schedule: { startAt: isoDaysAgo(25) },
    repeat: [{ frequency: 'minutely', interval: 30 }],
  },
  {
    taskId: 2002,
    name: 'Morning inbox digest',
    description: 'Summarise unread email into a single morning digest and post it to chat.',
    status: 'active',
    triggerType: 'scheduled',
    cadence: 'Daily at 08:00',
    startAt: isoDaysAgo(40),
    nextDueAt: isoInMinutes(600),
    owner: 'Haris Mahmood',
    offline: false,
    entrypoint: 9101,
    createdAt: isoDaysAgo(40),
    updatedAt: isoDaysAgo(1),
    schedule: { startAt: isoDaysAgo(40) },
    repeat: [{ frequency: 'daily', interval: 1, timeOfDay: '08:00' }],
  },
  {
    taskId: 2003,
    name: 'Stripe payout watcher',
    description:
      'On each Stripe payout event, reconcile against expected invoices and flag discrepancies.',
    status: 'active',
    triggerType: 'triggered',
    cadence: 'On event',
    startAt: isoDaysAgo(12),
    nextDueAt: null,
    owner: 'Haris Mahmood',
    offline: false,
    entrypoint: 9102,
    createdAt: isoDaysAgo(12),
    updatedAt: isoDaysAgo(2),
    trigger: { medium: 'webhook', recurring: true },
  },
  {
    taskId: 2004,
    name: 'Weekly competitor digest',
    description:
      'Compile competitor product and pricing changes into a weekly brief. Paused while the source list is being revised.',
    status: 'paused',
    triggerType: 'scheduled',
    cadence: 'Every Monday at 09:00',
    startAt: isoDaysAgo(60),
    nextDueAt: null,
    owner: 'Haris Mahmood',
    offline: false,
    entrypoint: 9101,
    createdAt: isoDaysAgo(60),
    updatedAt: isoDaysAgo(7),
    schedule: { startAt: isoDaysAgo(60) },
    repeat: [{ frequency: 'weekly', interval: 1, weekdays: ['MO'], timeOfDay: '09:00' }],
  },
];

const taskRuns: MockRow[] = [
  {
    taskId: 2001,
    taskName: 'Agentic AI Vertical Sector Research',
    taskDescription: 'Recurring vertical research sweep.',
    sourceType: 'schedule',
    state: 'completed',
    scheduledFor: isoMinutesAgo(30),
    sourceMedium: 'On schedule',
    sourceContactDisplayName: null,
    startedAt: isoMinutesAgo(30),
    completedAt: isoMinutesAgo(28),
  },
  {
    taskId: 2001,
    taskName: 'Agentic AI Vertical Sector Research',
    taskDescription: 'Recurring vertical research sweep.',
    sourceType: 'schedule',
    state: 'completed',
    scheduledFor: isoMinutesAgo(60),
    sourceMedium: 'On schedule',
    sourceContactDisplayName: null,
    startedAt: isoMinutesAgo(60),
    completedAt: isoMinutesAgo(58),
  },
  {
    taskId: 2001,
    taskName: 'Agentic AI Vertical Sector Research',
    taskDescription: 'Recurring vertical research sweep.',
    sourceType: 'schedule',
    state: 'failed',
    scheduledFor: isoMinutesAgo(90),
    sourceMedium: 'On schedule',
    sourceContactDisplayName: null,
    startedAt: isoMinutesAgo(90),
    completedAt: isoMinutesAgo(89),
  },
  {
    taskId: 2001,
    taskName: 'Agentic AI Vertical Sector Research',
    taskDescription: 'Recurring vertical research sweep.',
    sourceType: 'manual',
    state: 'completed',
    scheduledFor: isoMinutesAgo(120),
    sourceMedium: 'Manual run',
    sourceContactDisplayName: 'Haris Mahmood',
    startedAt: isoMinutesAgo(120),
    completedAt: isoMinutesAgo(118),
  },
  {
    taskId: 2001,
    taskName: 'Agentic AI Vertical Sector Research',
    taskDescription: 'Recurring vertical research sweep.',
    sourceType: 'schedule',
    state: 'cancelled',
    scheduledFor: isoMinutesAgo(150),
    sourceMedium: 'Manual stop',
    sourceContactDisplayName: 'Haris Mahmood',
    startedAt: isoMinutesAgo(150),
    completedAt: isoMinutesAgo(150),
  },
  {
    taskId: 2002,
    taskName: 'Morning inbox digest',
    taskDescription: 'Daily unread-email summary.',
    sourceType: 'schedule',
    state: 'completed',
    scheduledFor: isoDaysAgo(1),
    sourceMedium: 'On schedule',
    sourceContactDisplayName: null,
    startedAt: isoDaysAgo(1),
    completedAt: isoDaysAgo(1),
  },
  {
    taskId: 2003,
    taskName: 'Stripe payout watcher',
    taskDescription: 'Reconcile Stripe payouts against invoices.',
    sourceType: 'triggered',
    state: 'completed',
    scheduledFor: isoMinutesAgo(220),
    sourceMedium: 'webhook',
    sourceContactDisplayName: null,
    startedAt: isoMinutesAgo(220),
    completedAt: isoMinutesAgo(219),
  },
];

// ManagerMethod root events (incoming + outgoing pairs) so the Actions tree renders.
const eventsManagerMethod: MockRow[] = [
  {
    manager: 'CodeActActor',
    method: 'act',
    phase: 'incoming',
    callingId: 'act-001',
    hierarchy: ['act-001'],
    hierarchyLabel: 'CodeActActor.act',
    status: 'ok',
    request: 'Use Gmail to fetch the 5 most recent emails from the Brightfin thread.',
    displayLabel: 'Handling request',
    eventId: 'evt-act-001-in',
    eventTimestamp: isoMinutesAgo(180),
  },
  {
    manager: 'CodeActActor',
    method: 'act',
    phase: 'outgoing',
    callingId: 'act-001',
    hierarchy: ['act-001'],
    hierarchyLabel: 'CodeActActor.act',
    status: 'ok',
    answer: 'Fetched the 5 most recent Brightfin emails and posted the summary.',
    displayLabel: 'Handling request',
    eventId: 'evt-act-001-out',
    eventTimestamp: isoMinutesAgo(179),
  },
  {
    manager: 'CodeActActor',
    method: 'act',
    phase: 'incoming',
    callingId: 'act-002',
    hierarchy: ['act-002'],
    hierarchyLabel: 'CodeActActor.act',
    status: 'ok',
    request:
      'Using the Gmail integration tools: get the count of unread emails and digest the top 3.',
    displayLabel: 'Handling request',
    eventId: 'evt-act-002-in',
    eventTimestamp: isoMinutesAgo(60),
  },
  {
    manager: 'FunctionManager',
    method: 'search',
    phase: 'incoming',
    callingId: 'fn-001',
    hierarchy: ['act-002', 'fn-001'],
    hierarchyLabel: 'CodeActActor.act → FunctionManager.search',
    status: 'ok',
    question: 'skills for gmail digest',
    displayLabel: 'Searching skills',
    eventId: 'evt-fn-001-in',
    eventTimestamp: isoMinutesAgo(60),
  },
  {
    manager: 'FunctionManager',
    method: 'search',
    phase: 'outgoing',
    callingId: 'fn-001',
    hierarchy: ['act-002', 'fn-001'],
    hierarchyLabel: 'CodeActActor.act → FunctionManager.search',
    status: 'ok',
    answer: 'Found gmail_inbox_digest.',
    displayLabel: 'Searching skills',
    eventId: 'evt-fn-001-out',
    eventTimestamp: isoMinutesAgo(60),
  },
  {
    manager: 'CodeActActor',
    method: 'act',
    phase: 'outgoing',
    callingId: 'act-002',
    hierarchy: ['act-002'],
    hierarchyLabel: 'CodeActActor.act',
    status: 'ok',
    answer: 'You have 12 unread emails. Top 3 digested and posted to chat.',
    displayLabel: 'Handling request',
    eventId: 'evt-act-002-out',
    eventTimestamp: isoMinutesAgo(59),
  },
];

const eventsToolLoop: MockRow[] = [
  {
    kind: 'toolloop',
    method: 'act',
    hierarchy: ['act-002'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-001',
    eventTimestamp: isoMinutesAgo(60),
    message: {
      role: 'assistant',
      content: 'I will search for a Gmail digest skill, then run it on the latest unread emails.',
    },
  },
  {
    kind: 'toolloop',
    method: 'act',
    hierarchy: ['act-002'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-002',
    eventTimestamp: isoMinutesAgo(60),
    message: {
      role: 'assistant',
      content: null,
      toolCalls: [
        {
          id: 'call-1',
          function: { name: 'FunctionManager.search', arguments: '{"query": "gmail digest"}' },
        },
      ],
    },
  },
  {
    kind: 'toolloop',
    method: 'act',
    hierarchy: ['act-002'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-003',
    eventTimestamp: isoMinutesAgo(60),
    message: {
      role: 'tool',
      toolCallId: 'call-1',
      name: 'FunctionManager.search',
      content: [{ type: 'text', text: 'gmail_inbox_digest(since, max_items=10) -> str' }],
    },
  },
];

const dashboardsLayouts: MockRow[] = [
  {
    dashboardId: 3001,
    token: 'riverside-operative-supervisor',
    title: 'ClientBeta Riverside — Operative Supervisor',
    description: 'Live throughput and rework rate for the Q3 housing pilot.',
    layout: 'grid',
    tileCount: 2,
    createdAt: isoDaysAgo(6),
    updatedAt: isoMinutesAgo(58),
  },
];

const dashboardsTiles: MockRow[] = [
  {
    tileId: 4001,
    token: 'throughput',
    title: 'Daily throughput',
    description: 'Jobs completed per day across all crews.',
    htmlContent:
      '<div style="font:600 28px system-ui">428 jobs</div><div style="opacity:.7">+6% vs last week</div>',
    hasDataBindings: true,
    dataBindingContexts: 'Data/Housing — Riverside/jobs',
    createdAt: isoDaysAgo(6),
    updatedAt: isoMinutesAgo(58),
  },
  {
    tileId: 4002,
    token: 'rework-rate',
    title: 'Rework rate',
    description: 'Share of jobs requiring a return visit.',
    htmlContent:
      '<div style="font:600 28px system-ui">3.2%</div><div style="opacity:.7">-0.4pt vs last week</div>',
    hasDataBindings: true,
    dataBindingContexts: 'Data/Housing — Riverside/jobs',
    createdAt: isoDaysAgo(6),
    updatedAt: isoMinutesAgo(58),
  },
];

const secrets: MockRow[] = [
  { name: 'OPENAI_API_KEY', description: 'Inference for digests and research summaries.' },
  { name: 'STRIPE_API_KEY', description: 'Payout reconciliation for the Stripe watcher task.' },
  { name: 'CLIENTBETA_FEED_TOKEN', description: 'Read token for the ClientBeta Riverside data feed.' },
];

// Data-layer browser contexts (nested folders in the Data view).
const dataCrmContacts: MockRow[] = [
  {
    contactId: 'c_001',
    firstName: 'Tomas',
    surname: 'Novak',
    email: 'tomas@brightfin.io',
    company: 'Brightfin',
    stage: 'Prospect',
  },
  {
    contactId: 'c_002',
    firstName: 'Aisha',
    surname: 'Khan',
    email: 'a.khan@northwind.org',
    company: 'Northwind',
    stage: 'Evaluation',
  },
  {
    contactId: 'c_003',
    firstName: 'Olivia',
    surname: 'Watson',
    email: 'olivia.watson@riverside.gov.uk',
    company: 'Riverside Council',
    stage: 'Customer',
  },
  {
    contactId: 'c_004',
    firstName: 'Daniel',
    surname: 'Reyes',
    email: 'daniel@clientbeta.app',
    company: 'ClientBeta',
    stage: 'Partner',
  },
  {
    contactId: 'c_005',
    firstName: 'Mei',
    surname: 'Lin',
    email: 'mei.lin@stripe.com',
    company: 'Stripe',
    stage: 'Vendor',
  },
];

const dataCrmDeals: MockRow[] = [
  {
    dealId: 'd_001',
    name: 'Riverside housing pilot',
    stage: 'Closed won',
    amount: 84000,
    currency: 'GBP',
    owner: 'Haris Mahmood',
  },
  {
    dealId: 'd_002',
    name: 'Northwind public-sector rollout',
    stage: 'Evaluation',
    amount: 120000,
    currency: 'GBP',
    owner: 'Haris Mahmood',
  },
  {
    dealId: 'd_003',
    name: 'Brightfin fintech intro',
    stage: 'Lead',
    amount: 0,
    currency: 'GBP',
    owner: 'Marty',
  },
];

const dataFinanceInvoices: MockRow[] = [
  {
    invoiceId: 'inv_1001',
    customer: 'Riverside Council',
    amount: 21000,
    currency: 'GBP',
    status: 'Paid',
    issuedAt: isoDaysAgo(20),
  },
  {
    invoiceId: 'inv_1002',
    customer: 'Riverside Council',
    amount: 21000,
    currency: 'GBP',
    status: 'Paid',
    issuedAt: isoDaysAgo(50),
  },
  {
    invoiceId: 'inv_1003',
    customer: 'Northwind',
    amount: 12000,
    currency: 'GBP',
    status: 'Sent',
    issuedAt: isoDaysAgo(4),
  },
];

const dataHousingJobs: MockRow[] = [
  {
    jobId: 'j_5001',
    address: '14 Birkenhead Rd',
    crew: 'Alpha',
    status: 'Completed',
    durationMins: 42,
    reworked: false,
  },
  {
    jobId: 'j_5002',
    address: '9 Wallasey Ave',
    crew: 'Bravo',
    status: 'Completed',
    durationMins: 65,
    reworked: true,
  },
  {
    jobId: 'j_5003',
    address: '22 Hoylake Cl',
    crew: 'Alpha',
    status: 'In progress',
    durationMins: null,
    reworked: false,
  },
  {
    jobId: 'j_5004',
    address: '3 Bromborough Way',
    crew: 'Charlie',
    status: 'Completed',
    durationMins: 38,
    reworked: false,
  },
];

const dataResearchLeads: MockRow[] = [
  {
    leadId: 'l_9001',
    company: 'Brightfin',
    vertical: 'Fintech',
    signal: 'Series A raised',
    score: 0.82,
    surfacedAt: isoMinutesAgo(28),
  },
  {
    leadId: 'l_9002',
    company: 'Cobalt Health',
    vertical: 'Healthtech',
    signal: 'Hiring AI lead',
    score: 0.74,
    surfacedAt: isoMinutesAgo(58),
  },
  {
    leadId: 'l_9003',
    company: 'Mistwell Logistics',
    vertical: 'Supply chain',
    signal: 'Product launch',
    score: 0.61,
    surfacedAt: isoMinutesAgo(118),
  },
];

// Builtins integrations catalog (Builtins project, un-prefixed contexts).
function integrationApp(
  slug: string,
  displayName: string,
  category: string,
  description: string,
  opts: {
    sourceType?: 'native' | 'third_party';
    authModes?: string[];
    toolCount?: number;
    connectionStatus?: string | null;
  } = {}
): MockRow {
  return {
    canonicalAppSlug: slug,
    backendId: 'composio-dev',
    providerAppId: `mock-${slug}`,
    displayName,
    description,
    category,
    iconUrl: null,
    sourceType: opts.sourceType ?? 'third_party',
    sourceLabel: opts.sourceType === 'native' ? 'Native' : 'Managed app',
    authModes: opts.authModes ?? ['oauth'],
    toolCount: opts.toolCount ?? 6,
    availableScopes: [],
    availableActions: [],
    connectionStatus: opts.connectionStatus ?? 'not_connected',
  };
}

const integrationsApps: MockRow[] = [
  integrationApp(
    'gmail',
    'Gmail',
    'Email',
    'Read, search, and send email; power the morning inbox digest.',
    {
      toolCount: 9,
      connectionStatus: 'connected',
    }
  ),
  integrationApp(
    'google_calendar',
    'Google Calendar',
    'Productivity',
    'Schedule and read events to coordinate tasks.',
    {
      toolCount: 7,
      connectionStatus: 'connected',
    }
  ),
  integrationApp(
    'slack',
    'Slack',
    'Communication',
    'Post updates and read channels for team coordination.',
    {
      toolCount: 8,
    }
  ),
  integrationApp(
    'github',
    'GitHub',
    'Developer',
    'Repo lookup, issue triage, and pull-request workflows.',
    {
      toolCount: 12,
      connectionStatus: 'needs_reconnect',
    }
  ),
  integrationApp(
    'stripe',
    'Stripe',
    'Finance',
    'Reconcile payouts and read invoices for the payout watcher.',
    {
      toolCount: 5,
      connectionStatus: 'connected',
    }
  ),
  integrationApp('notion', 'Notion', 'Productivity', 'Read and write knowledge-base pages.', {
    toolCount: 6,
  }),
  integrationApp(
    'hubspot',
    'HubSpot',
    'CRM',
    'Sync contacts, companies, and deals into the CRM data layer.',
    {
      toolCount: 10,
    }
  ),
  integrationApp(
    'microsoft_sharepoint',
    'Microsoft SharePoint',
    'Documents',
    'Read-only document ingestion via Microsoft Graph.',
    { toolCount: 4, authModes: ['oauth'] }
  ),
];

function richTables(): MockTables {
  return {
    Contacts: contacts,
    Transcripts: transcripts,
    Knowledge: [...knowledgeProducts, ...knowledgeFaq],
    'Knowledge/Products': knowledgeProducts,
    'Knowledge/FAQ': knowledgeFaq,
    Functions: [...functionsPrimitives, ...functionsCompositional],
    'Functions/Primitives': functionsPrimitives,
    'Functions/Compositional': functionsCompositional,
    Guidance: guidance,
    Tasks: tasks,
    'Tasks/Runs': taskRuns,
    'Events/ManagerMethod': eventsManagerMethod,
    'Events/ToolLoop': eventsToolLoop,
    'Dashboards/Layouts': dashboardsLayouts,
    'Dashboards/Tiles': dashboardsTiles,
    Secrets: secrets,
    'Data/CRM/contacts': dataCrmContacts,
    'Data/CRM/deals': dataCrmDeals,
    'Data/Finance/invoices': dataFinanceInvoices,
    'Data/Housing — Riverside/jobs': dataHousingJobs,
    'Data/research.agentic.ai/leads': dataResearchLeads,
    'Integrations/Apps': integrationsApps,
    'Integrations/Tools': [],
  };
}

/**
 * Assistant-scoped table paths, used by the contexts endpoint. Excludes the
 * Builtins integrations catalog (which lives under the Builtins project with
 * un-prefixed contexts, not under any assistant).
 */
export function richTablePaths(): string[] {
  return Object.keys(richTables()).filter((path) => !path.startsWith('Integrations/'));
}

export function buildTables(dataset: MockDataset): MockTables {
  if (dataset === 'empty') return {};
  return richTables();
}
