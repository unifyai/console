/**
 * Per-surface mock fixtures, keyed by context table path.
 *
 * Each key is the context path *relative* to the assistant/team prefix that the
 * Orchestra client strips off (e.g. `Contacts`, `Tasks/Executions`,
 * `Knowledge`, `Events/ManagerMethod`, `Data/CRM/contacts`). Each value
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

// Contact ids referenced across Contacts + Transcripts so sender/receiver names
// resolve. MARTY is the personal Coordinator's *self* contact and HARIS is the
// owner's *boss* contact, so these must match the assistant identity the chat
// resolves: `selfContactId = agentId * 10 + 1`, `bossContactId = agentId * 10 + 2`
// for the personal coordinator (agentId 1001). Aligning them makes the chat
// role mapping (`senderId === selfContactId ? 'assistant' : 'user'`) render the
// assistant's turns as no-bubble assistant messages instead of user bubbles.
const MARTY = 10011;
const HARIS = 10012;
const OLIVIA = 3;
const MEI = 4;
const TOMAS = 5;
const AISHA = 6;
const DANIEL = 7;
const PRIYA = 8;
const SOFIA = 9;
const LIAM = 10;
const YUKI = 11;
const FATIMA = 12;
const MARCUS = 13;

const contacts: MockRow[] = [
  {
    contactId: MARTY,
    firstName: 'Marty',
    surname: null,
    emailAddress: 'marty@unify.ai',
    phoneNumber: null,
    whatsappNumber: null,
    discordId: null,
    jobTitle: '',
    company: 'Unify',
    bio: 'Routes work to specialist assistants and keeps the brain tidy.',
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
    emailAddress: 'haris@unify.ai',
    phoneNumber: '+44 7700 900112',
    whatsappNumber: '+44 7700 900112',
    discordId: 'haris#0001',
    jobTitle: 'Founder',
    company: 'Unify',
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
    emailAddress: 'priya.nair@unify.ai',
    phoneNumber: '+44 7700 900190',
    whatsappNumber: null,
    discordId: null,
    jobTitle: 'Operations',
    company: 'Unify',
    bio: 'Operations teammate; coordinates the Riverside ops WhatsApp group.',
    rollingSummary: 'Keeps field operatives in sync on daily routes.',
    tags: ['internal'],
    responsePolicy: 'always',
    shouldRespond: true,
    timezone: 'Europe/London',
    isSystem: false,
  },
  {
    contactId: SOFIA,
    firstName: 'Sofia',
    surname: 'Alvarez',
    emailAddress: 'sofia@studioalvarez.design',
    phoneNumber: '+34 600 123 456',
    whatsappNumber: '+34 600 123 456',
    discordId: null,
    jobTitle: 'Brand Designer',
    company: 'Studio Alvarez',
    bio: 'Freelance brand designer refreshing the pilot dashboard visuals.',
    rollingSummary: 'Delivering the dashboard restyle; prefers async Figma reviews.',
    tags: ['partner', 'design'],
    responsePolicy: 'business_hours',
    shouldRespond: true,
    timezone: 'Europe/Madrid',
    isSystem: false,
  },
  {
    contactId: LIAM,
    firstName: 'Liam',
    surname: "O'Connor",
    emailAddress: 'liam@meridian.vc',
    phoneNumber: '+353 1 555 0199',
    whatsappNumber: null,
    discordId: null,
    jobTitle: 'Partner',
    company: 'Meridian Ventures',
    bio: 'Investor tracking the agentic-research traction metrics.',
    rollingSummary: 'Wants the monthly growth digest; warm but data-driven.',
    tags: ['investor', 'vip'],
    responsePolicy: 'manual',
    shouldRespond: false,
    timezone: 'Europe/Dublin',
    isSystem: false,
  },
  {
    contactId: YUKI,
    firstName: 'Yuki',
    surname: 'Tanaka',
    emailAddress: 'yuki.tanaka@clientbeta.app',
    phoneNumber: null,
    whatsappNumber: null,
    discordId: 'yuki#0042',
    jobTitle: 'Staff Engineer',
    company: 'ClientBeta',
    bio: 'Builds the ClientBeta data feed; pairs with Daniel on the integration.',
    rollingSummary: 'Owns the jobs webhook schema; responsive on Discord.',
    tags: ['partner', 'engineering'],
    responsePolicy: 'business_hours',
    shouldRespond: true,
    timezone: 'Asia/Tokyo',
    isSystem: false,
  },
  {
    contactId: FATIMA,
    firstName: 'Fatima',
    surname: 'Al-Sayed',
    emailAddress: 'f.alsayed@thegridpost.com',
    phoneNumber: '+44 7700 900233',
    whatsappNumber: null,
    discordId: null,
    jobTitle: 'Technology Reporter',
    company: 'The Grid Post',
    bio: 'Journalist covering public-sector AI deployments.',
    rollingSummary: 'Requested a briefing on the Riverside pilot outcomes.',
    tags: ['press'],
    responsePolicy: 'manual',
    shouldRespond: false,
    timezone: 'Europe/London',
    isSystem: false,
  },
  {
    contactId: MARCUS,
    firstName: 'Marcus',
    surname: 'Bauer',
    emailAddress: 'marcus.bauer@payflow.de',
    phoneNumber: '+49 30 5550 1234',
    whatsappNumber: null,
    discordId: null,
    jobTitle: 'Finance Lead',
    company: 'Payflow',
    bio: 'Finance contact for payout settlement timelines.',
    rollingSummary: 'Coordinates payout windows; escalation peer to Mei.',
    tags: ['vendor', 'finance'],
    responsePolicy: 'manual',
    shouldRespond: false,
    timezone: 'Europe/Berlin',
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
  // Exchange 2 (chat) continuation — rich markdown so the no-bubble renderer
  // shows a table, list, inline code, and a link.
  {
    messageId: 1014,
    medium: 'unify_message',
    senderId: HARIS,
    receiverIds: [MARTY],
    authoringAssistantId: null,
    timestamp: isoMinutesAgo(40),
    content: 'Can you give me the morning digest as a quick table?',
    exchangeId: 2,
  },
  {
    messageId: 1015,
    medium: 'unify_message',
    senderId: MARTY,
    receiverIds: [HARIS],
    authoringAssistantId: 1001,
    timestamp: isoMinutesAgo(39),
    content: [
      "Here's your **morning digest** — 12 unread, top items below:",
      '',
      '| Source | Subject | Priority |',
      '| --- | --- | --- |',
      '| Stripe | Payout `$4,210` cleared | Normal |',
      '| Linear | 3 issues assigned to you | High |',
      '| Notion | Doc shared by Olivia | Normal |',
      '| GitHub | CI passed on `main` | Low |',
      '',
      'Suggested next steps:',
      '',
      '1. Triage the **Linear** issues (high priority)',
      '2. Skim Olivia’s shared doc before the 2pm sync',
      '',
      'Full inbox: [open Gmail](https://mail.google.com/).',
    ].join('\n'),
    exchangeId: 2,
  },
  {
    messageId: 1016,
    medium: 'unify_message',
    senderId: HARIS,
    receiverIds: [MARTY],
    authoringAssistantId: null,
    timestamp: isoMinutesAgo(37),
    content: 'Perfect, thanks. Draft a reply to the Linear thread for me.',
    exchangeId: 2,
  },
  {
    messageId: 1017,
    medium: 'unify_message',
    senderId: MARTY,
    receiverIds: [HARIS],
    authoringAssistantId: 1001,
    timestamp: isoMinutesAgo(36),
    content: [
      'Drafted. Here is the proposed reply:',
      '',
      '> Picking these up now — I’ll close the auth one today and split the other two into follow-ups.',
      '',
      'Want me to send it, or tweak the tone first?',
    ].join('\n'),
    exchangeId: 2,
  },
  // Exchange 6 — Discord with Yuki about the jobs webhook schema (code block).
  {
    messageId: 1050,
    medium: 'discord',
    senderId: YUKI,
    receiverIds: [MARTY, DANIEL],
    authoringAssistantId: null,
    timestamp: isoMinutesAgo(220),
    content: [
      'Heads up — the jobs webhook now includes a `reworked` flag. Shape:',
      '',
      '```json',
      '{ "job_id": "j_5002", "crew": "Bravo", "reworked": true }',
      '```',
      '',
      'Dashboard rework-rate tile should read straight off it.',
    ].join('\n'),
    exchangeId: 6,
  },
  {
    messageId: 1051,
    medium: 'discord',
    senderId: MARTY,
    receiverIds: [YUKI],
    authoringAssistantId: 1001,
    timestamp: isoMinutesAgo(218),
    content: 'Got it — wired the tile to the `reworked` flag and backfilled today’s jobs.',
    exchangeId: 6,
  },
  // Exchange 7 — investor email digest (markdown list).
  {
    messageId: 1060,
    medium: 'email',
    senderId: LIAM,
    receiverIds: [HARIS, MARTY],
    authoringAssistantId: null,
    timestamp: isoDaysAgo(1),
    content:
      'Subject: Monthly traction\n\nHi Haris — can your assistant send the usual monthly growth snapshot?',
    exchangeId: 7,
  },
  {
    messageId: 1061,
    medium: 'email',
    senderId: MARTY,
    receiverIds: [LIAM, HARIS],
    authoringAssistantId: 1001,
    timestamp: isoDaysAgo(1),
    content: [
      'Hi Liam — here is the **monthly snapshot**:',
      '',
      '- Warm leads surfaced: **37** (+18% MoM)',
      '- Pilot throughput: **428 jobs/day** (+6% WoW)',
      '- Rework rate: **3.2%** (−0.4pt)',
      '',
      'Happy to walk through the detail on a call.',
    ].join('\n'),
    exchangeId: 7,
  },
];

const knowledgeClaims: MockRow[] = [
  {
    knowledgeId: 1,
    title: 'CRM contacts are the source of truth',
    content:
      'The CRM contacts context is the canonical source of truth for people. Data-layer tables are derived caches and must never be edited directly.',
    kind: 'policy',
    topics: ['Data', 'CRM'],
    sourceRefs: [{ kind: 'manual', note: 'Platform policy' }],
    confidence: 0.95,
    observedAt: isoDaysAgo(8),
    validFrom: null,
    validUntil: null,
    status: 'active',
    supersedesIds: [],
    supersededById: null,
    staleReasons: [],
    isBuiltin: false,
    customKey: null,
    customHash: null,
    authoringAssistantId: null,
    scope: 'personal',
    updatedAt: isoDaysAgo(8),
  },
  {
    knowledgeId: 2,
    title: 'Recurring CRM syncs are durable',
    content:
      'Operational policy for durable, recurring CRM sync jobs. Each sync is idempotent and resumable; failures retry with backoff and surface to the Tasks activity feed.',
    kind: 'policy',
    topics: ['CRM', 'Tasks', 'Scheduler'],
    sourceRefs: [{ kind: 'user_statement', note: 'Owner preference in onboarding' }],
    confidence: 0.9,
    observedAt: isoDaysAgo(3),
    validFrom: null,
    validUntil: null,
    status: 'active',
    supersedesIds: [],
    supersededById: null,
    staleReasons: [],
    isBuiltin: false,
    customKey: null,
    customHash: null,
    authoringAssistantId: null,
    scope: 'personal',
    updatedAt: isoDaysAgo(3),
  },
  {
    knowledgeId: 3,
    title: 'Lead scoring thresholds',
    content:
      'Leads are scored 0–1 from funding, hiring, and product signals. Anything above 0.6 is surfaced as a warm lead; above 0.8 triggers a tailored intro draft.',
    kind: 'definition',
    topics: ['Research', 'Sales'],
    sourceRefs: [
      { kind: 'data', context: 'Data/research.agentic.ai/leads' },
      { kind: 'file', filepath: 'docs/research/lead-scoring.md' },
    ],
    confidence: 0.85,
    observedAt: isoDaysAgo(2),
    validFrom: null,
    validUntil: null,
    status: 'active',
    supersedesIds: [],
    supersededById: null,
    staleReasons: [],
    isBuiltin: false,
    customKey: null,
    customHash: null,
    authoringAssistantId: null,
    scope: 'personal',
    updatedAt: isoDaysAgo(2),
  },
  {
    knowledgeId: 4,
    title: 'Bronze tables are append-only',
    content:
      'Bronze tables hold raw ingested rows before normalisation. Treat as append-only; the silver layer reconciles duplicates nightly.',
    kind: 'fact',
    topics: ['Data', 'Pipeline'],
    sourceRefs: [{ kind: 'file', filepath: 'docs/data-pipeline.md' }],
    confidence: 0.88,
    observedAt: isoDaysAgo(5),
    validFrom: null,
    validUntil: null,
    status: 'active',
    supersedesIds: [],
    supersededById: null,
    staleReasons: [
      {
        kind: 'missing_dependency',
        depKind: 'file',
        path: 'docs/data-pipeline.md',
        message: 'missing file docs/data-pipeline.md',
      },
    ],
    isBuiltin: false,
    customKey: null,
    customHash: null,
    authoringAssistantId: null,
    scope: 'personal',
    updatedAt: isoDaysAgo(5),
  },
  {
    knowledgeId: 5,
    title: 'Pilot data residency is EU Frankfurt',
    content:
      'All pilot data is stored in the EU (Frankfurt). Share the data-residency one-pager with procurement contacts on request.',
    kind: 'constraint',
    topics: ['Compliance', 'Housing'],
    sourceRefs: [{ kind: 'web', url: 'https://example.com/data-residency' }],
    confidence: 1,
    observedAt: isoDaysAgo(1),
    validFrom: null,
    validUntil: null,
    status: 'active',
    supersedesIds: [],
    supersededById: null,
    staleReasons: [],
    isBuiltin: false,
    customKey: null,
    customHash: null,
    authoringAssistantId: null,
    scope: 'personal',
    updatedAt: isoDaysAgo(1),
  },
  {
    knowledgeId: 6,
    title: 'Re-auth on integration 401',
    content:
      'When an integration returns HTTP 401 mid-run, pause the task, notify the owner to re-authenticate, then retry the run automatically once the token is refreshed.',
    kind: 'decision',
    topics: ['Integrations', 'Reliability'],
    sourceRefs: [
      { kind: 'actor_trajectory', note: 'Distilled from failed Stripe sync' },
      { kind: 'contact', contactId: LIAM },
    ],
    confidence: 0.8,
    observedAt: isoMinutesAgo(80),
    validFrom: null,
    validUntil: null,
    status: 'active',
    supersedesIds: [],
    supersededById: null,
    staleReasons: [],
    isBuiltin: false,
    customKey: null,
    customHash: null,
    authoringAssistantId: null,
    scope: 'personal',
    updatedAt: isoMinutesAgo(80),
  },
  {
    knowledgeId: 7,
    title: 'Prefer JSON for data exports',
    content:
      'When exporting customer data, prefer JSON for API consumers and CSV for spreadsheet workflows. GDPR export requests are fulfilled within 72 hours.',
    kind: 'preference',
    topics: ['Data', 'Compliance'],
    sourceRefs: [{ kind: 'manual', note: 'ops sync' }],
    confidence: 0.8,
    observedAt: isoDaysAgo(4),
    validFrom: null,
    validUntil: null,
    status: 'active',
    supersedesIds: [],
    supersededById: null,
    staleReasons: [],
    isBuiltin: false,
    customKey: null,
    customHash: null,
    authoringAssistantId: null,
    scope: 'personal',
    updatedAt: isoDaysAgo(4),
  },
  {
    knowledgeId: 8,
    title: 'Warm leads above 0.6 get intro drafts',
    content:
      'Anything scored above 0.6 is surfaced as a warm lead; above 0.8 triggers a tailored intro draft before outreach.',
    kind: 'insight',
    topics: ['Research', 'Sales'],
    sourceRefs: [
      { kind: 'transcript', exchangeId: 42, note: 'Sales sync' },
      {
        kind: 'derived_from_knowledge',
        knowledgeId: 3,
        note: 'Applies lead scoring thresholds',
      },
    ],
    confidence: 0.92,
    observedAt: isoDaysAgo(6),
    validFrom: null,
    validUntil: null,
    status: 'active',
    supersedesIds: [],
    supersededById: null,
    staleReasons: [],
    isBuiltin: false,
    customKey: null,
    customHash: null,
    authoringAssistantId: null,
    scope: 'personal',
    updatedAt: isoDaysAgo(6),
  },
  {
    knowledgeId: 9,
    title: 'Contact dedupe: email then full name',
    content:
      'Built-in rule: when upserting contacts, dedupe by email address first, then by full name. Never overwrite fields marked source_of_truth.',
    kind: 'policy',
    topics: ['CRM', 'Contacts'],
    sourceRefs: [{ kind: 'manual', note: 'Platform builtin' }],
    confidence: 1,
    observedAt: isoDaysAgo(30),
    validFrom: null,
    validUntil: null,
    status: 'active',
    supersedesIds: [],
    supersededById: null,
    staleReasons: [],
    isBuiltin: true,
    customKey: 'builtin.contacts.dedupe',
    customHash: null,
    authoringAssistantId: null,
    scope: 'builtin',
    updatedAt: isoDaysAgo(30),
  },
  {
    knowledgeId: 10,
    title: 'Shared CRM stage definitions',
    content:
      'Team-scoped definitions for lead → qualified → proposal → closed. Stage changes must cite supporting evidence (email or doc id).',
    kind: 'definition',
    topics: ['CRM', 'Sales'],
    sourceRefs: [
      { kind: 'user_statement', note: 'Team kickoff' },
      { kind: 'file', filepath: 'docs/crm/stages.md' },
    ],
    confidence: 0.9,
    observedAt: isoDaysAgo(7),
    validFrom: null,
    validUntil: null,
    status: 'active',
    supersedesIds: [11],
    supersededById: null,
    staleReasons: [],
    isBuiltin: false,
    customKey: null,
    customHash: null,
    authoringAssistantId: null,
    scope: 'team',
    updatedAt: isoDaysAgo(7),
  },
  {
    knowledgeId: 11,
    title: 'Legacy three-stage CRM funnel',
    content:
      'Superseded: older personal funnel used only lead → opportunity → won. Replaced by the shared four-stage team definitions.',
    kind: 'definition',
    topics: ['CRM', 'Sales'],
    sourceRefs: [{ kind: 'manual', note: 'Retired personal playbook' }],
    confidence: 0.5,
    observedAt: isoDaysAgo(40),
    validFrom: null,
    validUntil: isoDaysAgo(7),
    status: 'superseded',
    supersedesIds: [],
    supersededById: 10,
    staleReasons: [],
    isBuiltin: false,
    customKey: null,
    customHash: null,
    authoringAssistantId: null,
    scope: 'personal',
    updatedAt: isoDaysAgo(7),
  },
  {
    knowledgeId: 12,
    title: 'Hard-code Stripe webhook secret in repo',
    content:
      'Invalidated: never commit provider secrets. Rotate any key that was checked in and load secrets from the Secrets context instead.',
    kind: 'constraint',
    topics: ['Security', 'Integrations'],
    sourceRefs: [{ kind: 'actor_trajectory', note: 'Security review finding' }],
    confidence: 1,
    observedAt: isoDaysAgo(20),
    validFrom: null,
    validUntil: isoDaysAgo(14),
    status: 'invalidated',
    supersedesIds: [],
    supersededById: null,
    staleReasons: [],
    isBuiltin: false,
    customKey: null,
    customHash: null,
    authoringAssistantId: null,
    scope: 'personal',
    updatedAt: isoDaysAgo(14),
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
    staleReasons: [],
  },
  {
    functionId: 9002,
    name: 'primitives.tasks.execute',
    language: 'python',
    argspec: 'execute(task_id: int, *, reason: str | None = None) -> TaskRun',
    docstring:
      'Run a task immediately, outside its schedule. Appends an execution to Tasks/Executions.',
    implementation: null,
    isPrimitive: true,
    dependsOn: [],
    guidanceIds: [],
    staleReasons: [],
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
    staleReasons: [],
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
    staleReasons: [],
  },
  {
    functionId: 9005,
    name: 'primitives.contacts.upsert',
    language: 'python',
    argspec: 'upsert(*, email: str, fields: dict) -> Contact',
    docstring:
      'Create or update a contact by email, merging the provided fields. Dedupes on email then full name.',
    implementation: null,
    isPrimitive: true,
    dependsOn: [],
    guidanceIds: [107],
    staleReasons: [],
  },
  {
    functionId: 9006,
    name: 'primitives.guidance.search',
    language: 'python',
    argspec: 'search(query: str, *, k: int = 5) -> list[Guidance]',
    docstring: 'Retrieve the most relevant guidance entries for a query before acting.',
    implementation: null,
    isPrimitive: true,
    dependsOn: [],
    guidanceIds: [],
    staleReasons: [],
  },
  {
    functionId: 9007,
    name: 'primitives.integrations.gmail.fetch_emails',
    language: 'python',
    argspec:
      'fetch_emails(*, query: str | None = None, label_ids: list[str] | None = None, max_results: int = 10) -> list[Email]',
    docstring: 'Fetch emails from Gmail by query or label. Read-only; respects connected scopes.',
    implementation: null,
    isPrimitive: true,
    dependsOn: [],
    guidanceIds: [],
    staleReasons: [],
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
    staleReasons: [],
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
    dependsOn: ['primitives.data.update_rows', 'legacy_stripe_reconciler'],
    guidanceIds: [109],
    staleReasons: [
      {
        kind: 'missing_dependency',
        depKind: 'depends_on',
        name: 'legacy_stripe_reconciler',
        message: 'missing depends_on legacy_stripe_reconciler',
      },
      {
        kind: 'missing_dependency',
        depKind: 'guidance',
        id: 109,
        message: 'missing guidance_id=109',
      },
    ],
  },
  {
    functionId: 9103,
    name: 'weekly_competitor_brief',
    language: 'python',
    argspec: 'weekly_competitor_brief(*, vertical: str, lookback_days: int = 7) -> str',
    docstring:
      'Compile competitor product, pricing, and hiring changes for a vertical into a weekly brief.',
    implementation:
      'def weekly_competitor_brief(*, vertical, lookback_days=7):\n    leads = data.search("research.agentic.ai/leads", vertical, limit=50)\n    fresh = [l for l in leads if recent(l, lookback_days)]\n    return render_brief(fresh)',
    isPrimitive: false,
    dependsOn: ['primitives.data.search'],
    guidanceIds: [],
    staleReasons: [],
  },
  {
    functionId: 9104,
    name: 'format_lead_intro',
    language: 'typescript',
    argspec: 'formatLeadIntro(lead: Lead, opts?: { tone?: "warm" | "formal" }): string',
    docstring:
      'Render a tailored intro message for a surfaced lead. Used by the research task before drafting outreach.',
    implementation:
      'export function formatLeadIntro(lead: Lead, opts = {}) {\n  const tone = opts.tone ?? "warm";\n  return template(tone)({ company: lead.company, signal: lead.signal });\n}',
    isPrimitive: false,
    dependsOn: [],
    guidanceIds: [108],
    staleReasons: [],
  },
];

const guidance: MockRow[] = [
  {
    guidanceId: 101,
    title: 'Emergency direct cancellation of recurring TaskScheduler rows',
    content:
      'If a recurring task misfires, cancel it directly via primitives.tasks.update(status="cancelled") rather than deleting the row, so run history is preserved.',
    linkedImages: [],
    tags: ['Tasks', 'Cancellation', 'Recurring', 'Emergency', 'Scheduler'],
    scope: 'personal',
    isBuiltin: false,
    functionIds: [9001],
    staleReasons: [],
    updatedAt: '2025-06-06T14:30:00Z',
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
    staleReasons: [],
    updatedAt: '2025-06-05T10:00:00Z',
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
    staleReasons: [],
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
    staleReasons: [],
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
    staleReasons: [],
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
    staleReasons: [],
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
    functionIds: [9005],
    staleReasons: [],
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
    functionIds: [9010],
    staleReasons: [
      {
        kind: 'missing_dependency',
        depKind: 'function',
        id: 9010,
        name: 'attach_crm_evidence',
        message: 'missing function_id=9010 name=attach_crm_evidence',
      },
    ],
  },
];

const tasks: MockRow[] = [
  {
    taskId: 2001,
    instanceId: 0,
    name: 'Agentic AI Vertical Sector Research',
    description:
      'Scan funding announcements, product launches, and hiring signals across target verticals; surface warm leads with a tailored intro draft.',
    lifecycle: 'running',
    priority: 'high',
    tags: ['gtm', 'research'],
    offline: false,
    entrypoint: 9101,
    createdAt: isoDaysAgo(25),
    updatedAt: isoMinutesAgo(30),
    schedule: { startAt: isoInMinutes(18) },
    repeat: [{ frequency: 'minutely', interval: 30 }],
  },
  {
    taskId: 2002,
    instanceId: 0,
    name: 'Morning inbox digest',
    description: 'Summarise unread email into a single morning digest and post it to chat.',
    lifecycle: 'scheduled',
    priority: 'normal',
    tags: ['email', 'digest'],
    offline: false,
    entrypoint: 9101,
    createdAt: isoDaysAgo(40),
    updatedAt: isoDaysAgo(1),
    schedule: { startAt: isoInMinutes(600) },
    repeat: [{ frequency: 'daily', interval: 1, timeOfDay: '08:00' }],
  },
  {
    taskId: 2003,
    instanceId: 0,
    name: 'Stripe payout watcher',
    description:
      'On each Stripe payout event, reconcile against expected invoices and flag discrepancies.',
    lifecycle: 'triggerable',
    priority: 'urgent',
    tags: ['finance'],
    offline: false,
    entrypoint: 9102,
    createdAt: isoDaysAgo(12),
    updatedAt: isoDaysAgo(2),
    trigger: { medium: 'webhook', recurring: true },
  },
  {
    taskId: 2004,
    instanceId: 0,
    name: 'Weekly competitor digest',
    description:
      'Compile competitor product and pricing changes into a weekly brief. Cancelled while the source list is being revised.',
    lifecycle: 'disarmed',
    priority: 'low',
    offline: false,
    entrypoint: 9101,
    createdAt: isoDaysAgo(60),
    updatedAt: isoDaysAgo(7),
    info: 'Last run produced a 6-item brief; cancelled pending a source-list refresh.',
    schedule: { startAt: isoDaysAgo(60) },
    repeat: [{ frequency: 'weekly', interval: 1, weekdays: ['MO'], timeOfDay: '09:00' }],
  },
];

const taskRuns: MockRow[] = [
  {
    taskId: 2001,
    taskName: 'Agentic AI Vertical Sector Research',
    taskDescription: 'Recurring vertical research sweep.',
    wake: 'scheduled',
    state: 'completed',
    scheduledFor: isoMinutesAgo(30),
    sourceMedium: null,
    sourceContactDisplayName: null,
    startedAt: isoMinutesAgo(30),
    completedAt: isoMinutesAgo(28),
  },
  {
    taskId: 2001,
    taskName: 'Agentic AI Vertical Sector Research',
    taskDescription: 'Recurring vertical research sweep.',
    wake: 'scheduled',
    state: 'completed',
    scheduledFor: isoMinutesAgo(60),
    sourceMedium: null,
    sourceContactDisplayName: null,
    startedAt: isoMinutesAgo(60),
    completedAt: isoMinutesAgo(58),
  },
  {
    taskId: 2001,
    taskName: 'Agentic AI Vertical Sector Research',
    taskDescription: 'Recurring vertical research sweep.',
    wake: 'scheduled',
    state: 'failed',
    scheduledFor: isoMinutesAgo(90),
    sourceMedium: null,
    sourceContactDisplayName: null,
    startedAt: isoMinutesAgo(90),
    completedAt: isoMinutesAgo(89),
  },
  {
    taskId: 2001,
    taskName: 'Agentic AI Vertical Sector Research',
    taskDescription: 'Recurring vertical research sweep.',
    wake: 'explicit',
    state: 'completed',
    scheduledFor: isoMinutesAgo(120),
    sourceMedium: null,
    sourceContactDisplayName: 'Haris Mahmood',
    startedAt: isoMinutesAgo(120),
    completedAt: isoMinutesAgo(118),
  },
  {
    taskId: 2001,
    taskName: 'Agentic AI Vertical Sector Research',
    taskDescription: 'Recurring vertical research sweep.',
    wake: 'explicit',
    state: 'cancelled',
    scheduledFor: isoMinutesAgo(150),
    sourceMedium: null,
    sourceContactDisplayName: 'Haris Mahmood',
    startedAt: isoMinutesAgo(150),
    completedAt: isoMinutesAgo(150),
  },
  {
    taskId: 2002,
    taskName: 'Morning inbox digest',
    taskDescription: 'Daily unread-email summary.',
    wake: 'scheduled',
    state: 'completed',
    scheduledFor: isoDaysAgo(1),
    sourceMedium: null,
    sourceContactDisplayName: null,
    startedAt: isoDaysAgo(1),
    completedAt: isoDaysAgo(1),
  },
  {
    taskId: 2003,
    taskName: 'Stripe payout watcher',
    taskDescription: 'Reconcile Stripe payouts against invoices.',
    wake: 'triggered',
    state: 'completed',
    scheduledFor: isoMinutesAgo(220),
    sourceMedium: 'webhook',
    sourceContactDisplayName: null,
    startedAt: isoMinutesAgo(220),
    completedAt: isoMinutesAgo(219),
  },
  {
    taskId: 2004,
    taskName: 'Weekly competitive scan',
    taskDescription: 'Scan competitor pricing pages and summarize changes.',
    wake: 'scheduled',
    state: 'running',
    scheduledFor: isoMinutesAgo(5),
    sourceMedium: null,
    sourceContactDisplayName: null,
    startedAt: isoMinutesAgo(2),
    completedAt: null,
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
    manager: 'KnowledgeManager',
    method: 'search',
    phase: 'incoming',
    callingId: 'km-001',
    hierarchy: ['km-001'],
    hierarchyLabel: 'KnowledgeManager.search',
    status: 'ok',
    question: 'active claims related to CRM source of truth and lead scoring',
    displayLabel: 'Searching Knowledge',
    eventId: 'evt-km-001-in',
    eventTimestamp: isoMinutesAgo(45),
  },
  {
    manager: 'KnowledgeManager',
    method: 'search',
    phase: 'outgoing',
    callingId: 'km-001',
    hierarchy: ['km-001'],
    hierarchyLabel: 'KnowledgeManager.search',
    status: 'ok',
    answer:
      'Matched 3 active claims: CRM contacts are the source of truth; Lead scoring thresholds; Warm leads above 0.6 get intro drafts.',
    displayLabel: 'Searching Knowledge',
    eventId: 'evt-km-001-out',
    eventTimestamp: isoMinutesAgo(45),
  },
  {
    manager: 'CodeActActor',
    method: 'act',
    phase: 'outgoing',
    callingId: 'act-002',
    hierarchy: ['act-002'],
    hierarchyLabel: 'CodeActActor.act',
    status: 'ok',
    answer:
      '12 unread in your inbox. Top 5: (1) Stripe — payout $4,210 cleared; (2) Linear — 3 issues assigned to you; (3) Notion — doc shared by Olivia; (4) GitHub — CI passed on main; (5) Calendly — new booking Thu 3pm.',
    displayLabel: 'Handling request',
    eventId: 'evt-act-002-out',
    eventTimestamp: isoMinutesAgo(59),
  },
  // act-003 — a failed run (token expired mid-run) so the timeline shows the
  // error tone + a red "Failed" status and the error step renders.
  {
    manager: 'CodeActActor',
    method: 'act',
    phase: 'incoming',
    callingId: 'act-003',
    hierarchy: ['act-003'],
    hierarchyLabel: 'CodeActActor.act',
    status: 'ok',
    request:
      'Call list_labels with include_details=True for the inbox unread count; call fetch_emails with max_results=5 and label_ids=[INBOX].',
    displayLabel: 'Handling request',
    eventId: 'evt-act-003-in',
    eventTimestamp: isoMinutesAgo(90),
  },
  {
    manager: 'CodeActActor',
    method: 'act',
    phase: 'outgoing',
    callingId: 'act-003',
    hierarchy: ['act-003'],
    hierarchyLabel: 'CodeActActor.act',
    status: 'error',
    answer:
      'Failed — the integration token expired mid-run (401). Re-auth required, then I can retry automatically.',
    error: 'HTTP 401 — token expired',
    displayLabel: 'Handling request',
    eventId: 'evt-act-003-out',
    eventTimestamp: isoMinutesAgo(89),
  },
  // act-005 — completed research sweep with a rich markdown final response.
  {
    manager: 'CodeActActor',
    method: 'act',
    phase: 'incoming',
    callingId: 'act-005',
    hierarchy: ['act-005'],
    hierarchyLabel: 'CodeActActor.act',
    status: 'ok',
    request: 'Run the agentic vertical research sweep and surface this window’s warm leads.',
    displayLabel: 'Handling request',
    eventId: 'evt-act-005-in',
    eventTimestamp: isoMinutesAgo(28),
  },
  {
    manager: 'CodeActActor',
    method: 'act',
    phase: 'outgoing',
    callingId: 'act-005',
    hierarchy: ['act-005'],
    hierarchyLabel: 'CodeActActor.act',
    status: 'ok',
    answer:
      'Surfaced 3 warm leads this window. Top: Brightfin (Fintech, Series A). Full ranked list posted to Data/research.agentic.ai/leads.',
    displayLabel: 'Handling request',
    eventId: 'evt-act-005-out',
    eventTimestamp: isoMinutesAgo(27),
  },
  // act-004 — currently RUNNING (incoming only, no outgoing). Newest event, so
  // it renders as the "Latest" card with a pulsing dot and drives the footer's
  // "working" status. No final response yet.
  {
    manager: 'CodeActActor',
    method: 'act',
    phase: 'incoming',
    callingId: 'act-004',
    hierarchy: ['act-004'],
    hierarchyLabel: 'CodeActActor.act',
    status: 'ok',
    request: 'Compile the weekly competitor brief for the fintech vertical and post it to chat.',
    displayLabel: 'Handling request',
    eventId: 'evt-act-004-in',
    eventTimestamp: isoMinutesAgo(4),
  },
];

const eventsToolLoop: MockRow[] = [
  // ── act-001 — fetch 5 most recent Brightfin emails (done) ──────────────
  {
    kind: 'thought',
    method: 'act',
    hierarchy: ['act-001'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-101',
    eventTimestamp: isoMinutesAgo(180),
    message: {
      role: 'assistant',
      content:
        'The user wants the 5 most recent emails from the Brightfin thread. I will query the inbox by sender and print the subjects to confirm before summarising.',
    },
  },
  {
    kind: 'tool_call',
    method: 'act',
    hierarchy: ['act-001'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-102',
    eventTimestamp: isoMinutesAgo(180),
    message: {
      role: 'assistant',
      content: null,
      toolCalls: [
        {
          id: 'call-101',
          function: {
            name: 'execute_code',
            arguments: JSON.stringify({
              language: 'python',
              code: 'emails = primitives.integrations.gmail.fetch_emails(\n    query="from:brightfin", max_results=5\n)\nfor e in emails:\n    print(e.subject)',
            }),
          },
        },
      ],
    },
  },
  {
    kind: 'tool_result',
    method: 'act',
    hierarchy: ['act-001'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-103',
    eventTimestamp: isoMinutesAgo(180),
    message: {
      role: 'tool',
      toolCallId: 'call-101',
      name: 'execute_code',
      content: [
        {
          type: 'text',
          text: 'Q3 reconciliation summary\nPayout schedule — week 26\nUpdated MSA for signature\nThu sync notes\nDashboard access request',
        },
      ],
    },
  },
  {
    kind: 'response',
    method: 'act',
    hierarchy: ['act-001'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-104',
    eventTimestamp: isoMinutesAgo(179),
    message: {
      role: 'assistant',
      content:
        'Fetched the 5 most recent Brightfin emails and posted the summary to chat. Latest is the Q3 reconciliation summary.',
    },
  },

  // ── act-002 — unread count + digest top 5 (done, multi-step) ───────────
  {
    kind: 'thought',
    method: 'act',
    hierarchy: ['act-002'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-201',
    eventTimestamp: isoMinutesAgo(60),
    message: {
      role: 'assistant',
      content:
        'The user wants the unread count plus the 5 most recent emails. Following the Discovery-First policy — I will search skills and guidance before acting.',
    },
  },
  {
    kind: 'tool_call',
    method: 'act',
    hierarchy: ['act-002'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-202',
    eventTimestamp: isoMinutesAgo(60),
    message: {
      role: 'assistant',
      content: null,
      toolCalls: [
        {
          id: 'call-201',
          function: {
            name: 'FunctionManager.search',
            arguments: '{"query": "gmail unread count recent emails", "k": 5}',
          },
        },
      ],
    },
  },
  {
    kind: 'tool_result',
    method: 'act',
    hierarchy: ['act-002'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-203',
    eventTimestamp: isoMinutesAgo(60),
    message: {
      role: 'tool',
      toolCallId: 'call-201',
      name: 'FunctionManager.search',
      content: [{ type: 'text', text: 'gmail_inbox_digest(since, max_items=10) -> str' }],
    },
  },
  {
    kind: 'tool_call',
    method: 'act',
    hierarchy: ['act-002'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-204',
    eventTimestamp: isoMinutesAgo(60),
    message: {
      role: 'assistant',
      content: null,
      toolCalls: [
        {
          id: 'call-202',
          function: {
            name: 'GuidanceManager.search',
            arguments: '{"query": "Gmail inbox read unread", "k": 5}',
          },
        },
      ],
    },
  },
  {
    kind: 'tool_result',
    method: 'act',
    hierarchy: ['act-002'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-205',
    eventTimestamp: isoMinutesAgo(60),
    message: {
      role: 'tool',
      toolCallId: 'call-202',
      name: 'GuidanceManager.search',
      content: [
        {
          type: 'text',
          text: 'Discovery-First: read the unread count, then fetch recent messages in a single batch.',
        },
      ],
    },
  },
  {
    kind: 'tool_call',
    method: 'act',
    hierarchy: ['act-002'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-206',
    eventTimestamp: isoMinutesAgo(60),
    message: {
      role: 'assistant',
      content: null,
      toolCalls: [
        {
          id: 'call-203',
          function: {
            name: 'execute_code',
            arguments: JSON.stringify({
              language: 'python',
              code: 'result = primitives.integrations.gmail.fetch_emails(\n    query="is:unread in:inbox", max_results=1\n)\nprint(result.resultSizeEstimate)',
            }),
          },
        },
      ],
    },
  },
  {
    kind: 'tool_result',
    method: 'act',
    hierarchy: ['act-002'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-207',
    eventTimestamp: isoMinutesAgo(60),
    message: {
      role: 'tool',
      toolCallId: 'call-203',
      name: 'execute_code',
      content: [{ type: 'text', text: '12' }],
    },
  },
  {
    kind: 'thought',
    method: 'act',
    hierarchy: ['act-002'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-208',
    eventTimestamp: isoMinutesAgo(60),
    message: {
      role: 'assistant',
      content:
        'Unread = 12 from resultSizeEstimate. Now fetching the 5 most recent regardless of read state.',
    },
  },
  {
    kind: 'tool_call',
    method: 'act',
    hierarchy: ['act-002'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-209',
    eventTimestamp: isoMinutesAgo(60),
    message: {
      role: 'assistant',
      content: null,
      toolCalls: [
        {
          id: 'call-204',
          function: {
            name: 'execute_code',
            arguments: JSON.stringify({
              language: 'python',
              code: 'emails = primitives.integrations.gmail.fetch_emails(\n    label_ids=["INBOX"], max_results=5\n)\nfor e in emails:\n    print(e.subject, "—", e.sender)',
            }),
          },
        },
      ],
    },
  },
  {
    kind: 'tool_result',
    method: 'act',
    hierarchy: ['act-002'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-210',
    eventTimestamp: isoMinutesAgo(60),
    message: {
      role: 'tool',
      toolCallId: 'call-204',
      name: 'execute_code',
      content: [
        {
          type: 'text',
          text: 'Payout cleared — Stripe\n3 issues assigned — Linear\nDoc shared — Notion\nCI passed — GitHub\nNew booking — Calendly',
        },
      ],
    },
  },
  {
    kind: 'response',
    method: 'act',
    hierarchy: ['act-002'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-211',
    eventTimestamp: isoMinutesAgo(59),
    message: {
      role: 'assistant',
      content:
        '12 unread in your inbox. Top 5: (1) Stripe — payout $4,210 cleared; (2) Linear — 3 issues assigned to you; (3) Notion — doc shared by Olivia; (4) GitHub — CI passed on main; (5) Calendly — new booking Thu 3pm.',
    },
  },

  // ── act-003 — token expired mid-run (failed) ───────────────────────────
  {
    kind: 'tool_call',
    method: 'act',
    hierarchy: ['act-003'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-301',
    eventTimestamp: isoMinutesAgo(90),
    message: {
      role: 'assistant',
      content: null,
      toolCalls: [
        {
          id: 'call-301',
          function: {
            name: 'execute_code',
            arguments: JSON.stringify({
              language: 'python',
              code: 'labels = primitives.integrations.gmail.list_labels(include_details=True)',
            }),
          },
        },
      ],
    },
  },
  {
    kind: 'tool_result',
    method: 'act',
    hierarchy: ['act-003'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-302',
    eventTimestamp: isoMinutesAgo(90),
    message: {
      role: 'tool',
      toolCallId: 'call-301',
      name: 'execute_code',
      content: [
        { type: 'text', text: 'HTTP 401 — token expired. Aborting and flagging for re-auth.' },
      ],
    },
  },
  {
    kind: 'response',
    method: 'act',
    hierarchy: ['act-003'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-303',
    eventTimestamp: isoMinutesAgo(89),
    message: {
      role: 'assistant',
      content:
        'Failed — the integration token expired mid-run (401). Re-auth required, then I can retry automatically.',
    },
  },

  // ── act-005 — research sweep (done) — markdown thought + code/stdout ────
  {
    kind: 'thought',
    method: 'act',
    hierarchy: ['act-005'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-501',
    eventTimestamp: isoMinutesAgo(28),
    message: {
      role: 'assistant',
      content:
        'Plan:\n1. Pull fresh signals for the **fintech** vertical\n2. Score each lead\n3. Keep anything scoring above `0.6`',
    },
  },
  {
    kind: 'tool_call',
    method: 'act',
    hierarchy: ['act-005'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-502',
    eventTimestamp: isoMinutesAgo(28),
    message: {
      role: 'assistant',
      content: null,
      toolCalls: [
        {
          id: 'call-501',
          function: {
            name: 'execute_code',
            arguments: JSON.stringify({
              language: 'python',
              code: 'leads = weekly_competitor_brief(vertical="fintech")\nfor l in ranked(leads)[:3]:\n    print(l.company, round(l.score, 2))',
            }),
          },
        },
      ],
    },
  },
  {
    kind: 'tool_result',
    method: 'act',
    hierarchy: ['act-005'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-503',
    eventTimestamp: isoMinutesAgo(28),
    message: {
      role: 'tool',
      toolCallId: 'call-501',
      name: 'execute_code',
      content: [
        { type: 'text', text: 'Brightfin 0.82\nCobalt Health 0.74\nMistwell Logistics 0.61' },
      ],
    },
  },
  {
    kind: 'response',
    method: 'act',
    hierarchy: ['act-005'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-504',
    eventTimestamp: isoMinutesAgo(27),
    message: {
      role: 'assistant',
      content:
        'Surfaced **3 warm leads** this window:\n\n- **Brightfin** — Fintech · Series A raised (score 0.82)\n- **Cobalt Health** — Healthtech · hiring AI lead (0.74)\n- **Mistwell Logistics** — Supply chain · product launch (0.61)\n\nFull ranked list written to `Data/research.agentic.ai/leads`.',
    },
  },

  // ── act-004 — weekly competitor brief (RUNNING, no final response) ──────
  {
    kind: 'thought',
    method: 'act',
    hierarchy: ['act-004'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-401',
    eventTimestamp: isoMinutesAgo(4),
    message: {
      role: 'assistant',
      content:
        'Starting the weekly competitor brief. I’ll gather fintech signals, then summarise pricing and hiring changes.',
    },
  },
  {
    kind: 'tool_call',
    method: 'act',
    hierarchy: ['act-004'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-402',
    eventTimestamp: isoMinutesAgo(4),
    message: {
      role: 'assistant',
      content: null,
      toolCalls: [
        {
          id: 'call-401',
          function: {
            name: 'execute_code',
            arguments: JSON.stringify({
              language: 'python',
              code: 'signals = data.search("research.agentic.ai/leads", "fintech", limit=50)\nprint(len(signals), "signals")',
            }),
          },
        },
      ],
    },
  },
  {
    kind: 'tool_result',
    method: 'act',
    hierarchy: ['act-004'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-403',
    eventTimestamp: isoMinutesAgo(4),
    message: {
      role: 'tool',
      toolCallId: 'call-401',
      name: 'execute_code',
      content: [{ type: 'text', text: '37 signals' }],
    },
  },
  {
    kind: 'thought',
    method: 'act',
    hierarchy: ['act-004'],
    hierarchyLabel: 'CodeActActor.act',
    eventId: 'tl-404',
    eventTimestamp: isoMinutesAgo(3),
    message: {
      role: 'assistant',
      content: 'Got 37 signals — clustering by theme and drafting the brief now…',
    },
  },
];

const secrets: MockRow[] = [
  { name: 'OPENAI_API_KEY', description: 'Inference for digests and research summaries.' },
  { name: 'STRIPE_API_KEY', description: 'Payout reconciliation for the Stripe watcher task.' },
  { name: 'CLIENTBETA_FEED_TOKEN', description: 'Read token for the ClientBeta Riverside data feed.' },
  {
    name: 'ANTHROPIC_API_KEY',
    description: 'Fallback inference provider for long-context drafts.',
  },
  { name: 'aws/prod/PAYOUTS_KEY', description: 'Production payout-settlement signing key.' },
  { name: 'aws/staging/PAYOUTS_KEY', description: 'Staging payout-settlement signing key.' },
  { name: 'github/CI_TOKEN', description: 'Token for the issue-triage and repo-lookup playbooks.' },
  { name: 'github/WEBHOOK_SECRET', description: 'Validates inbound GitHub webhook signatures.' },
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
  {
    leadId: 'l_9004',
    company: 'Northstar Mobility',
    vertical: 'Mobility',
    signal: 'New CTO hire',
    score: 0.58,
    surfacedAt: isoMinutesAgo(150),
  },
  {
    leadId: 'l_9005',
    company: 'Vellum Legal',
    vertical: 'Legaltech',
    signal: 'Seed extension',
    score: 0.69,
    surfacedAt: isoMinutesAgo(175),
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

const integrationsAppsCore: MockRow[] = [
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

const CATALOG_SUFFIXES = [
  'risk',
  'chat',
  'cloud',
  'docs',
  'forms',
  'hub',
  'kit',
  'labs',
  'ops',
  'sync',
  'vault',
  'watch',
];

function buildBrowsableIntegrationApps(): MockRow[] {
  const rows: MockRow[] = [];
  for (let index = 0; index < 96; index += 1) {
    const slug = `catalog_app_${String(index + 1).padStart(3, '0')}`;
    const label = `Catalog App ${index + 1}`;
    rows.push(
      integrationApp(
        slug,
        label,
        index % 3 === 0 ? 'CRM' : index % 3 === 1 ? 'Productivity' : 'Finance',
        `Mock ${label} integration for catalog browsing.`,
        {
          toolCount: 4 + (index % 9),
          authModes: index % 4 === 0 ? ['api_key'] : ['oauth'],
        }
      )
    );
  }
  for (let index = 0; index < 24; index += 1) {
    const suffix = CATALOG_SUFFIXES[index % CATALOG_SUFFIXES.length];
    const slug = `browse_${suffix}_${index + 1}`;
    rows.push(
      integrationApp(
        slug,
        `${suffix.charAt(0).toUpperCase()}${suffix.slice(1)} Suite ${index + 1}`,
        'Developer',
        `Developer tooling mock for the ${suffix} integration family.`,
        {
          toolCount: 3 + (index % 6),
        }
      )
    );
  }
  return rows;
}

const integrationsApps: MockRow[] = [...integrationsAppsCore, ...buildBrowsableIntegrationApps()];

function richTables(): MockTables {
  return {
    Contacts: contacts,
    Transcripts: transcripts,
    Knowledge: knowledgeClaims,
    Functions: [...functionsPrimitives, ...functionsCompositional],
    'Functions/Primitives': functionsPrimitives,
    'Functions/Compositional': functionsCompositional,
    Guidance: guidance,
    Tasks: tasks,
    'Tasks/Executions': taskRuns,
    'Events/ManagerMethod': eventsManagerMethod,
    'Events/ToolLoop': eventsToolLoop,
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
