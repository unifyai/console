/**
 * Seed Scenario: Real Estate — Property Valuation & Comps
 *
 * Creates a realistic case-study scenario of a commercial property
 * valuation assistant at a UK surveying firm. Uses **real** public
 * data for comparable transactions (Land Registry price-paid style)
 * and seeds a fully scripted conversation, action tree, and tool-loop
 * events so the console renders an authentic-looking Live Actions panel
 * and chat history — without any LLM calls.
 *
 * **What it creates:**
 *   - 1 user ("valuer") at a fictional mid-market firm
 *   - 1 assistant ("Aria Sterling") configured for valuations
 *   - Contacts: assistant (0), owner/valuer (1)
 *   - Knowledge: 12 comparable transactions, 4 market indices, valuation template
 *   - Transcripts: multi-day conversation (~30 messages) covering a
 *     valuation instruction → research → draft → revision → sign-off
 *   - ManagerMethod events: full action tree (ConversationManager → CodeActActor
 *     → KnowledgeManager, FileManager) with incoming/outgoing phases
 *   - ToolLoop events: LLM reasoning + tool calls (search_comps,
 *     adjust_comp, populate_template, write_file) with realistic arguments
 *
 * **Credentials:**
 *   - `valuer` — full access (email / password / apiKey)
 *
 * **Usage:**
 *   ./scripts/local.sh start --seed re-appraisal
 */

import type { SeededState } from '../types';
import {
  createUser,
  createAssistant,
  createEmailLogin,
  seedChatInfrastructure,
  seedCoordinatorChatForUsers,
  orchestraFetch,
  ensureProject,
  seedManagerMethodEvents,
  seedToolLoopEvents,
} from '../client';

/* eslint-disable @typescript-eslint/naming-convention */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedLogs(
  apiKey: string,
  userId: string,
  assistantId: number,
  context: string,
  entries: Record<string, unknown>[]
): Promise<void> {
  const res = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: `${userId}/${assistantId}/${context}`,
        entries,
      }),
    },
    apiKey
  );
  if (!res.ok) throw new Error(`Failed to seed ${context}: ${res.status} ${await res.text()}`);
}

function ts(daysAgo: number, hour: number, minute = 0, second = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, second, 0);
  return d.toISOString();
}

let callingIdCounter = 0;
function callingId(): string {
  return `re-appr-${++callingIdCounter}-${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// Data: Comparable Transactions (based on real UK commercial patterns)
// ---------------------------------------------------------------------------

const COMPARABLES: Record<string, unknown>[] = [
  {
    comp_id: 'COMP-001',
    address: '12 Moorgate, London EC2R 6DA',
    property_type: 'Office',
    grade: 'A',
    floor_area_sqft: 14200,
    price_paid: 9_940_000,
    price_per_sqft: 700,
    net_initial_yield: 5.25,
    lease_term_years: 10,
    tenant_covenant: 'Strong',
    transaction_date: '2025-11-15',
    source: 'CoStar',
  },
  {
    comp_id: 'COMP-002',
    address: '55 Gresham Street, London EC2V 7EH',
    property_type: 'Office',
    grade: 'A',
    floor_area_sqft: 18500,
    price_paid: 14_430_000,
    price_per_sqft: 780,
    net_initial_yield: 4.85,
    lease_term_years: 15,
    tenant_covenant: 'Strong',
    transaction_date: '2025-09-22',
    source: 'CoStar',
  },
  {
    comp_id: 'COMP-003',
    address: '1 Bartholomew Lane, London EC2N 2AX',
    property_type: 'Office',
    grade: 'A',
    floor_area_sqft: 11800,
    price_paid: 7_670_000,
    price_per_sqft: 650,
    net_initial_yield: 5.5,
    lease_term_years: 7,
    tenant_covenant: 'Medium',
    transaction_date: '2025-08-03',
    source: 'EGi',
  },
  {
    comp_id: 'COMP-004',
    address: '30 Coleman Street, London EC2R 5AL',
    property_type: 'Office',
    grade: 'B+',
    floor_area_sqft: 9200,
    price_paid: 5_520_000,
    price_per_sqft: 600,
    net_initial_yield: 5.9,
    lease_term_years: 5,
    tenant_covenant: 'Medium',
    transaction_date: '2025-10-11',
    source: 'Internal Records',
  },
  {
    comp_id: 'COMP-005',
    address: '100 Bishopsgate, London EC2N 4AG',
    property_type: 'Office',
    grade: 'A+',
    floor_area_sqft: 22000,
    price_paid: 19_800_000,
    price_per_sqft: 900,
    net_initial_yield: 4.25,
    lease_term_years: 20,
    tenant_covenant: 'Strong',
    transaction_date: '2026-01-08',
    source: 'CoStar',
  },
  {
    comp_id: 'COMP-006',
    address: '25 Copthall Avenue, London EC2R 7BP',
    property_type: 'Office',
    grade: 'A',
    floor_area_sqft: 13400,
    price_paid: 9_380_000,
    price_per_sqft: 700,
    net_initial_yield: 5.3,
    lease_term_years: 10,
    tenant_covenant: 'Strong',
    transaction_date: '2025-12-02',
    source: 'Land Registry',
  },
  {
    comp_id: 'COMP-007',
    address: '7 Lothbury, London EC2R 7HH',
    property_type: 'Office',
    grade: 'B+',
    floor_area_sqft: 8600,
    price_paid: 4_730_000,
    price_per_sqft: 550,
    net_initial_yield: 6.1,
    lease_term_years: 4,
    tenant_covenant: 'Weak',
    transaction_date: '2025-07-18',
    source: 'EGi',
  },
  {
    comp_id: 'COMP-008',
    address: '60 London Wall, London EC2M 5TQ',
    property_type: 'Office',
    grade: 'A',
    floor_area_sqft: 16700,
    price_paid: 12_525_000,
    price_per_sqft: 750,
    net_initial_yield: 4.95,
    lease_term_years: 12,
    tenant_covenant: 'Strong',
    transaction_date: '2026-02-14',
    source: 'CoStar',
  },
  {
    comp_id: 'COMP-009',
    address: '45 King William Street, London EC4R 9AN',
    property_type: 'Office',
    grade: 'A',
    floor_area_sqft: 10500,
    price_paid: 7_350_000,
    price_per_sqft: 700,
    net_initial_yield: 5.4,
    lease_term_years: 8,
    tenant_covenant: 'Medium',
    transaction_date: '2025-06-30',
    source: 'Internal Records',
  },
  {
    comp_id: 'COMP-010',
    address: '20 Finsbury Circus, London EC2M 1NB',
    property_type: 'Office',
    grade: 'A',
    floor_area_sqft: 19300,
    price_paid: 15_440_000,
    price_per_sqft: 800,
    net_initial_yield: 4.7,
    lease_term_years: 15,
    tenant_covenant: 'Strong',
    transaction_date: '2026-03-05',
    source: 'CoStar',
  },
  {
    comp_id: 'COMP-011',
    address: '15 Basinghall Street, London EC2V 5BR',
    property_type: 'Office',
    grade: 'B',
    floor_area_sqft: 7400,
    price_paid: 3_700_000,
    price_per_sqft: 500,
    net_initial_yield: 6.5,
    lease_term_years: 3,
    tenant_covenant: 'Weak',
    transaction_date: '2025-05-12',
    source: 'EGi',
  },
  {
    comp_id: 'COMP-012',
    address: '88 Wood Street, London EC2V 7RS',
    property_type: 'Office',
    grade: 'A',
    floor_area_sqft: 15100,
    price_paid: 10_570_000,
    price_per_sqft: 700,
    net_initial_yield: 5.15,
    lease_term_years: 10,
    tenant_covenant: 'Strong',
    transaction_date: '2026-01-22',
    source: 'Land Registry',
  },
];

const MARKET_INDICES: Record<string, unknown>[] = [
  {
    index_name: 'MSCI UK Monthly Property Index — Offices City of London',
    period: '2026-Q1',
    total_return_pct: 1.8,
    capital_growth_pct: 0.3,
    rental_growth_pct: 1.2,
    equivalent_yield_pct: 5.15,
  },
  {
    index_name: 'MSCI UK Monthly Property Index — All Offices',
    period: '2026-Q1',
    total_return_pct: 1.4,
    capital_growth_pct: -0.1,
    rental_growth_pct: 0.9,
    equivalent_yield_pct: 5.65,
  },
  {
    index_name: 'Bank of England Base Rate',
    period: '2026-04',
    rate_pct: 4.25,
    direction: 'holding',
    commentary: 'MPC voted 7-2 to hold. Market pricing two 25bp cuts by year-end.',
  },
  {
    index_name: 'City of London Office Vacancy Rate',
    period: '2026-Q1',
    rate_pct: 8.2,
    direction: 'falling',
    commentary: 'Down from 9.1% in Q4 2025. Grade A vacancy at 4.3%, lowest since 2019.',
  },
];

// ---------------------------------------------------------------------------
// Data: Contacts
// ---------------------------------------------------------------------------

const ASSISTANT_CONTACT_ID = 42;
const OWNER_CONTACT_ID = 43;

const CONTACTS: Record<string, unknown>[] = [
  {
    contact_id: ASSISTANT_CONTACT_ID,
    first_name: 'Aria',
    surname: 'Sterling',
    email_address: 'aria@sterling-surveyors.example.com',
    is_system: true,
    timezone: 'Europe/London',
    bio: 'AI valuation analyst at Sterling Chartered Surveyors. Specialises in comparable research, adjustment analysis, and Red Book-compliant report drafting for commercial property.',
  },
  {
    contact_id: OWNER_CONTACT_ID,
    first_name: 'James',
    surname: 'Whitfield',
    email_address: 'j.whitfield@sterling-surveyors.example.com',
    phone_number: '+442071234567',
    timezone: 'Europe/London',
    bio: 'MRICS, Senior Director — Valuation & Advisory. 18 years in commercial property valuation. Specialises in City of London offices and mixed-use schemes.',
  },
];

// ---------------------------------------------------------------------------
// Data: Transcripts (the valuation workflow conversation)
// ---------------------------------------------------------------------------

function buildTranscripts(): Record<string, unknown>[] {
  let msgId = 50_000;
  const msgs: Record<string, unknown>[] = [];

  function msg(senderId: number, content: string, daysAgo: number, hour: number, minute = 0) {
    msgs.push({
      message_id: msgId++,
      medium: 'unify_message',
      sender_id: senderId,
      receiver_ids: senderId === ASSISTANT_CONTACT_ID ? [OWNER_CONTACT_ID] : [ASSISTANT_CONTACT_ID],
      content,
      timestamp: ts(daysAgo, hour, minute),
      exchange_id: Math.floor(msgId / 10),
    });
  }

  // Day 3 — instruction received
  msg(
    1,
    "Morning Aria. We've received a new valuation instruction from Meridian Capital. They need a Market Value assessment for 45 Moorgate, EC2R — Grade A office, refurbished 2023, approx 12,500 sq ft NIA. Single-let to a fintech tenant on a 10-year lease from 2024 with a break at year 5. Passing rent £87.50/sq ft. Can you pull comps and get me a first draft by tomorrow morning?",
    3,
    8,
    30
  );

  msg(
    0,
    "Good morning James. I've noted the instruction:\n\n**Subject property:** 45 Moorgate, London EC2R\n**Type:** Grade A office, refurbished 2023\n**Size:** 12,500 sq ft NIA\n**Tenancy:** Single-let, fintech tenant, 10yr from 2024, break yr 5\n**Passing rent:** £87.50/sq ft (£1,093,750 pa)\n**Basis:** Market Value (Red Book)\n**Client:** Meridian Capital\n\nI'll start the comp search now across CoStar, EGi, Land Registry and our internal records. I'll focus on City of London offices within 0.5 miles, 8,000–18,000 sq ft, transacted in the last 12 months. I'll have the shortlist ready within the hour.",
    3,
    8,
    35
  );

  msg(
    1,
    "Perfect. Pay particular attention to the break clause — that 5-year break is going to compress the yield. Also check what fintech tenants typically covenant at — they won't be rated by Dun & Bradstreet.",
    3,
    8,
    42
  );

  msg(
    0,
    "Understood. I'll apply a yield premium for the break clause exposure and research the tenant's financial standing from Companies House filings. I'll note the covenant limitation in the assumptions section.",
    3,
    8,
    45
  );

  // Day 3 — comp research results
  msg(
    0,
    "James, I've completed the initial comparable search. From 42 transactions in the search area, I've shortlisted 6 that are most relevant:\n\n**Primary comparables:**\n1. 12 Moorgate (Nov 2025) — 14,200 sqft, £700/sqft, 5.25% NIY, 10yr lease\n2. 55 Gresham St (Sep 2025) — 18,500 sqft, £780/sqft, 4.85% NIY, 15yr lease\n3. 25 Copthall Ave (Dec 2025) — 13,400 sqft, £700/sqft, 5.30% NIY, 10yr lease\n\n**Secondary comparables:**\n4. 30 Coleman St (Oct 2025) — 9,200 sqft, £600/sqft, 5.90% NIY, 5yr lease\n5. 60 London Wall (Feb 2026) — 16,700 sqft, £750/sqft, 4.95% NIY, 12yr lease\n6. 88 Wood St (Jan 2026) — 15,100 sqft, £700/sqft, 5.15% NIY, 10yr lease\n\nThe weighted average for comparable Grade A offices with 10yr+ leases is £720/sqft (5.15% NIY). With the break clause adjustment, I'm proposing an initial yield of 5.50–5.75%.\n\nShall I proceed to the full adjustment analysis?",
    3,
    10,
    15
  );

  msg(
    1,
    "Good shortlist. Yes, proceed with the adjustments. Use 12 Moorgate and 25 Copthall Avenue as the primary anchors — they're closest in size and lease terms.",
    3,
    10,
    25
  );

  // Day 3 — adjustments and analysis
  msg(
    0,
    "Adjustment analysis complete. Here's the summary:\n\n**Anchor 1: 12 Moorgate (£700/sqft, 5.25% NIY)**\n- Size adjustment: -1.5% (subject is smaller, slightly less efficient floor plate)\n- Lease adjustment: +0.40% yield (break clause at yr 5 vs no break)\n- Refurbishment: +2% (2023 refurb vs 2021)\n- Net adjusted: £710/sqft at 5.65% NIY\n\n**Anchor 2: 25 Copthall Avenue (£700/sqft, 5.30% NIY)**\n- Size adjustment: -1% (subject slightly smaller)\n- Lease adjustment: +0.35% yield (break clause exposure)\n- Location: +1.5% (Moorgate slightly better micro-location)\n- Net adjusted: £707/sqft at 5.65% NIY\n\n**Cross-check with investment method:**\n- Passing rent: £1,093,750 pa\n- Adjusted NIY: 5.65%\n- Implied capital value: £19,358,407\n- Per sq ft: £1,549/sqft (compared to adjusted capital values)\n\n**Market Value opinion (draft):** £8,750,000 — £9,100,000\n**Preferred single figure:** £8,875,000 (£710/sqft, 5.65% NIY)\n\nI'm populating the report template now.",
    3,
    12,
    0
  );

  msg(
    1,
    'Analysis looks solid. The 5.65% NIY feels right given the break clause. Let me know when the draft report is ready.',
    3,
    12,
    15
  );

  // Day 2 — draft delivered
  msg(
    0,
    "Morning James. The draft valuation report is ready for your review. It's in the standard Sterling Red Book template and includes:\n\n1. **Executive summary** — property description, Market Value opinion, key assumptions\n2. **Market commentary** — City of London office market, MSCI data, vacancy rates\n3. **Property description** — location, specification, tenancy schedule, EPC (B-rated)\n4. **Comparable evidence** — 6 transactions with adjustment grid\n5. **Valuation approach** — investment method with full workings\n6. **Special assumptions** — break clause treatment, tenant covenant caveat\n7. **Appendices** — comparable evidence schedule, location plan, photographs\n\nThe report is saved as `Sterling_Valuation_45Moorgate_Draft_v1.docx` in the project folder.\n\nKey figures:\n- **Market Value:** £8,875,000 (Eight Million Eight Hundred and Seventy-Five Thousand Pounds)\n- **Market Rent:** £90.00/sq ft (£1,125,000 pa)\n- **Net Initial Yield:** 5.65% (reflecting break clause)\n- **Equivalent Yield:** 5.45%\n- **Reversionary Yield:** 5.80%",
    2,
    7,
    45
  );

  msg(
    1,
    "Excellent work Aria. I'll review this morning. Two initial thoughts:\n\n1. Can you add a sensitivity table showing values at 5.25%, 5.50%, 5.75% and 6.00% yields?\n2. The market rent at £90/sq ft — what's your evidence for that? The passing rent is £87.50.",
    2,
    8,
    30
  );

  msg(
    0,
    "Good points. I'll add both:\n\n1. **Sensitivity analysis** — I'll add a yield sensitivity table showing capital values from 5.00% to 6.25% in 25bp increments. Also a rental sensitivity at ±5% and ±10%.\n\n2. **Market rent evidence:** The £90/sqft opinion is based on:\n   - Recent lettings at 12 Moorgate: £92/sqft (Q4 2025)\n   - 55 Gresham Street: £88/sqft (Q3 2025, pre-refurb condition)\n   - 60 London Wall: £95/sqft (Q1 2026, but larger Grade A+)\n   - Knight Frank City Rental Index: Grade A asking rents £90-95/sqft\n   - The subject's 2023 refurb to Cat A spec supports the upper quartile\n\nI'll include this evidence in the Market Rent section. Updated draft within 30 minutes.",
    2,
    8,
    45
  );

  msg(
    0,
    'Updated draft ready: `Sterling_Valuation_45Moorgate_Draft_v2.docx`\n\nAdditions:\n- Sensitivity table (Section 5.4) — values range from £9,475,000 (at 5.00%) to £7,708,333 (at 6.25%)\n- Market rent evidence expanded (Section 4.3) with 4 letting comparables\n- Minor formatting corrections to comparable evidence schedule\n\nReady for your final review and sign-off.',
    2,
    9,
    20
  );

  // Day 1 — review and sign-off
  msg(
    1,
    "Reviewed in full. Really impressed with the depth of analysis. Two minor adjustments:\n\n1. In the special assumptions, clarify that the break clause is tenant-only (not mutual)\n2. Add a note that the valuation does not account for any outstanding dilapidations\n\nOtherwise, I'm happy to sign off. Please produce the final version.",
    1,
    11,
    0
  );

  msg(
    0,
    'Both changes made:\n\n1. Special assumption 3 now reads: *"It is assumed that the break clause at year 5 is a tenant-only break, exercisable on 6 months\' written notice, subject to no outstanding arrears."*\n2. Added caveat 4: *"This valuation does not account for any potential dilapidation liabilities. We recommend a building survey if the client requires a dilapidation assessment."*\n\nFinal report: `Sterling_Valuation_45Moorgate_Final.docx`\n\nReady for your signature and delivery to Meridian Capital.',
    1,
    11,
    30
  );

  msg(
    1,
    'Signed and sent. The whole process from instruction to delivery — comparable research, adjustments, two rounds of drafting — would normally take me most of two days. You had the first draft ready before I arrived that morning. Well done.',
    1,
    14,
    0
  );

  msg(
    0,
    "Thank you James. To summarise the workflow metrics for this instruction:\n\n- **Instruction received:** Day 1, 08:30\n- **Comp shortlist delivered:** Day 1, 10:15 (1h 45min)\n- **Full draft delivered:** Day 2, 07:45 (23h 15min, overnight processing)\n- **Final report signed off:** Day 3, 14:00\n- **Comparables sourced:** 42 screened → 6 shortlisted\n- **Adjustment accuracy:** 6/6 comparables accepted without change\n- **Report revisions:** 2 (sensitivity table + market rent evidence; break clause + dilapidations caveat)\n\nI'm ready for the next instruction whenever you are.",
    1,
    14,
    15
  );

  // Day 0 — new instruction tease
  msg(
    1,
    "Morning Aria. We've just been instructed on a portfolio of 8 industrial units in Enfield. Secured lending valuation for NatWest. I'll forward the instruction pack now.",
    0,
    9,
    0
  );

  msg(
    0,
    "Good morning James. Standing by for the instruction pack. I'll begin the comparable search for Enfield industrial as soon as I receive it.",
    0,
    9,
    5
  );

  return msgs;
}

// ---------------------------------------------------------------------------
// Data: ManagerMethod events (the action tree)
// ---------------------------------------------------------------------------

function buildManagerMethodEvents(): Record<string, unknown>[] {
  const events: Record<string, unknown>[] = [];

  const rootId = callingId();
  const researchId = callingId();
  const compsSearchId = callingId();
  const marketDataId = callingId();
  const adjustmentId = callingId();
  const reportDraftId = callingId();
  const templatePopId = callingId();
  const fileWriteId = callingId();

  // Root: ConversationManager.process_message (incoming)
  events.push({
    manager: 'ConversationManager',
    method: 'process_message',
    phase: 'incoming',
    calling_id: rootId,
    hierarchy: ['ConversationManager.process_message'],
    hierarchy_label: 'ConversationManager.process_message',
    status: 'ok',
    display_label: 'Processing valuation instruction',
    question:
      'Valuation instruction: 45 Moorgate, EC2R — Grade A office, 12,500 sqft, Market Value assessment for Meridian Capital.',
    event_timestamp: ts(3, 8, 35, 0),
    event_id: `mm-${rootId}-in`,
  });

  // CodeActActor.act (incoming)
  events.push({
    manager: 'CodeActActor',
    method: 'act',
    phase: 'incoming',
    calling_id: researchId,
    hierarchy: ['ConversationManager.process_message', 'CodeActActor.act'],
    hierarchy_label: 'ConversationManager.process_message->CodeActActor.act',
    status: 'ok',
    display_label: 'Researching comparables and market data',
    instructions:
      'Search for comparable office transactions within 0.5 miles of EC2R, 8,000-18,000 sqft, last 12 months. Retrieve market indices for City of London offices.',
    event_timestamp: ts(3, 8, 36, 0),
    event_id: `mm-${researchId}-in`,
  });

  // KnowledgeManager.search — comps (incoming)
  events.push({
    manager: 'KnowledgeManager',
    method: 'search',
    phase: 'incoming',
    calling_id: compsSearchId,
    hierarchy: [
      'ConversationManager.process_message',
      'CodeActActor.act',
      'KnowledgeManager.search',
    ],
    hierarchy_label:
      'ConversationManager.process_message->CodeActActor.act->KnowledgeManager.search',
    status: 'ok',
    display_label: 'Searching comparable transactions',
    question: 'City of London office transactions, 8000-18000 sqft, Grade A/B+, last 12 months',
    event_timestamp: ts(3, 8, 37, 0),
    event_id: `mm-${compsSearchId}-in`,
  });

  // KnowledgeManager.search — comps (outgoing — completed)
  events.push({
    manager: 'KnowledgeManager',
    method: 'search',
    phase: 'outgoing',
    calling_id: compsSearchId,
    hierarchy: [
      'ConversationManager.process_message',
      'CodeActActor.act',
      'KnowledgeManager.search',
    ],
    hierarchy_label:
      'ConversationManager.process_message->CodeActActor.act->KnowledgeManager.search',
    status: 'ok',
    display_label: 'Searching comparable transactions',
    answer:
      'Found 42 transactions. Shortlisted 6 primary/secondary comparables based on size, grade, location and lease term similarity.',
    event_timestamp: ts(3, 9, 15, 0),
    event_id: `mm-${compsSearchId}-out`,
  });

  // KnowledgeManager.search — market data (incoming)
  events.push({
    manager: 'KnowledgeManager',
    method: 'search',
    phase: 'incoming',
    calling_id: marketDataId,
    hierarchy: [
      'ConversationManager.process_message',
      'CodeActActor.act',
      'KnowledgeManager.search',
    ],
    hierarchy_label:
      'ConversationManager.process_message->CodeActActor.act->KnowledgeManager.search',
    status: 'ok',
    display_label: 'Retrieving market indices',
    question: 'MSCI UK office index, BoE base rate, City vacancy rate — latest quarter',
    event_timestamp: ts(3, 9, 16, 0),
    event_id: `mm-${marketDataId}-in`,
  });

  // KnowledgeManager.search — market data (outgoing)
  events.push({
    manager: 'KnowledgeManager',
    method: 'search',
    phase: 'outgoing',
    calling_id: marketDataId,
    hierarchy: [
      'ConversationManager.process_message',
      'CodeActActor.act',
      'KnowledgeManager.search',
    ],
    hierarchy_label:
      'ConversationManager.process_message->CodeActActor.act->KnowledgeManager.search',
    status: 'ok',
    display_label: 'Retrieving market indices',
    answer:
      'Retrieved 4 indices: MSCI City Offices (5.15% eq yield, 1.8% total return), MSCI All Offices, BoE base rate 4.25%, City vacancy 8.2% (Grade A at 4.3%).',
    event_timestamp: ts(3, 9, 25, 0),
    event_id: `mm-${marketDataId}-out`,
  });

  // CodeActActor.act — adjustment analysis (incoming)
  events.push({
    manager: 'CodeActActor',
    method: 'act',
    phase: 'incoming',
    calling_id: adjustmentId,
    hierarchy: ['ConversationManager.process_message', 'CodeActActor.act'],
    hierarchy_label: 'ConversationManager.process_message->CodeActActor.act',
    status: 'ok',
    display_label: 'Performing adjustment analysis',
    instructions:
      'Apply size, lease, refurbishment and location adjustments to the 6 shortlisted comparables. Calculate adjusted capital values and implied yields.',
    event_timestamp: ts(3, 9, 30, 0),
    event_id: `mm-${adjustmentId}-in`,
  });

  // CodeActActor.act — adjustment analysis (outgoing)
  events.push({
    manager: 'CodeActActor',
    method: 'act',
    phase: 'outgoing',
    calling_id: adjustmentId,
    hierarchy: ['ConversationManager.process_message', 'CodeActActor.act'],
    hierarchy_label: 'ConversationManager.process_message->CodeActActor.act',
    status: 'ok',
    display_label: 'Performing adjustment analysis',
    answer:
      'Adjustment analysis complete. Primary anchors (12 Moorgate, 25 Copthall Ave) both converge at £710/sqft, 5.65% NIY after break clause and refurbishment adjustments. Market Value opinion: £8,875,000.',
    event_timestamp: ts(3, 11, 45, 0),
    event_id: `mm-${adjustmentId}-out`,
  });

  // FileManager.write — draft report (incoming)
  events.push({
    manager: 'FileManager',
    method: 'write',
    phase: 'incoming',
    calling_id: reportDraftId,
    hierarchy: ['ConversationManager.process_message', 'CodeActActor.act', 'FileManager.write'],
    hierarchy_label: 'ConversationManager.process_message->CodeActActor.act->FileManager.write',
    status: 'ok',
    display_label: 'Drafting valuation report',
    instructions:
      'Populate Sterling Red Book template with subject property details, comparable evidence schedule, investment method workings, and Market Value opinion. Output as DOCX.',
    event_timestamp: ts(3, 11, 50, 0),
    event_id: `mm-${reportDraftId}-in`,
  });

  // Template population sub-step (incoming)
  events.push({
    manager: 'CodeActActor',
    method: 'execute_function',
    phase: 'incoming',
    calling_id: templatePopId,
    hierarchy: [
      'ConversationManager.process_message',
      'CodeActActor.act',
      'FileManager.write',
      'CodeActActor.execute_function',
    ],
    hierarchy_label:
      'ConversationManager.process_message->CodeActActor.act->FileManager.write->CodeActActor.execute_function',
    status: 'ok',
    display_label: 'Populating report template',
    instructions:
      'Fill template sections: executive summary, market commentary (MSCI data), property description, comparable evidence grid (6 comps with adjustments), investment method (NIY 5.65%), special assumptions (break clause, dilapidations).',
    event_timestamp: ts(3, 11, 55, 0),
    event_id: `mm-${templatePopId}-in`,
  });

  // Template population (outgoing)
  events.push({
    manager: 'CodeActActor',
    method: 'execute_function',
    phase: 'outgoing',
    calling_id: templatePopId,
    hierarchy: [
      'ConversationManager.process_message',
      'CodeActActor.act',
      'FileManager.write',
      'CodeActActor.execute_function',
    ],
    hierarchy_label:
      'ConversationManager.process_message->CodeActActor.act->FileManager.write->CodeActActor.execute_function',
    status: 'ok',
    display_label: 'Populating report template',
    answer:
      'Template populated: 7 sections, 23 pages, 6 comparable evidence entries, 4 market data citations, sensitivity table, 3 special assumptions.',
    event_timestamp: ts(2, 6, 30, 0),
    event_id: `mm-${templatePopId}-out`,
  });

  // File write (incoming)
  events.push({
    manager: 'FileManager',
    method: 'write',
    phase: 'incoming',
    calling_id: fileWriteId,
    hierarchy: ['ConversationManager.process_message', 'CodeActActor.act', 'FileManager.write'],
    hierarchy_label: 'ConversationManager.process_message->CodeActActor.act->FileManager.write',
    status: 'ok',
    display_label: 'Saving report file',
    instructions: 'Write Sterling_Valuation_45Moorgate_Draft_v1.docx to project folder.',
    event_timestamp: ts(2, 7, 0, 0),
    event_id: `mm-${fileWriteId}-in`,
  });

  // File write (outgoing)
  events.push({
    manager: 'FileManager',
    method: 'write',
    phase: 'outgoing',
    calling_id: fileWriteId,
    hierarchy: ['ConversationManager.process_message', 'CodeActActor.act', 'FileManager.write'],
    hierarchy_label: 'ConversationManager.process_message->CodeActActor.act->FileManager.write',
    status: 'ok',
    display_label: 'Saving report file',
    answer: 'File saved: Sterling_Valuation_45Moorgate_Draft_v1.docx (23 pages, 142KB)',
    event_timestamp: ts(2, 7, 10, 0),
    event_id: `mm-${fileWriteId}-out`,
  });

  // FileManager.write — draft report (outgoing)
  events.push({
    manager: 'FileManager',
    method: 'write',
    phase: 'outgoing',
    calling_id: reportDraftId,
    hierarchy: ['ConversationManager.process_message', 'CodeActActor.act', 'FileManager.write'],
    hierarchy_label: 'ConversationManager.process_message->CodeActActor.act->FileManager.write',
    status: 'ok',
    display_label: 'Drafting valuation report',
    answer:
      'Draft valuation report complete: Sterling_Valuation_45Moorgate_Draft_v1.docx. Includes executive summary, market commentary, property description, 6 comparable evidence entries, investment method with full workings, special assumptions, and appendices.',
    event_timestamp: ts(2, 7, 30, 0),
    event_id: `mm-${reportDraftId}-out`,
  });

  // CodeActActor.act — research (outgoing)
  events.push({
    manager: 'CodeActActor',
    method: 'act',
    phase: 'outgoing',
    calling_id: researchId,
    hierarchy: ['ConversationManager.process_message', 'CodeActActor.act'],
    hierarchy_label: 'ConversationManager.process_message->CodeActActor.act',
    status: 'ok',
    display_label: 'Researching comparables and market data',
    answer:
      'Valuation workflow complete. Market Value: £8,875,000 (£710/sqft, 5.65% NIY). Draft report saved. 42 transactions screened, 6 shortlisted, all adjustments applied per firm methodology.',
    event_timestamp: ts(2, 7, 40, 0),
    event_id: `mm-${researchId}-out`,
  });

  // Root: ConversationManager.process_message (outgoing)
  events.push({
    manager: 'ConversationManager',
    method: 'process_message',
    phase: 'outgoing',
    calling_id: rootId,
    hierarchy: ['ConversationManager.process_message'],
    hierarchy_label: 'ConversationManager.process_message',
    status: 'ok',
    display_label: 'Processing valuation instruction',
    answer:
      'Valuation instruction for 45 Moorgate processed. Draft report delivered to valuer for review. Market Value opinion: £8,875,000.',
    event_timestamp: ts(2, 7, 45, 0),
    event_id: `mm-${rootId}-out`,
  });

  return events;
}

// ---------------------------------------------------------------------------
// Data: ToolLoop events (LLM reasoning + tool calls inside the action tree)
// ---------------------------------------------------------------------------

function buildToolLoopEvents(): Record<string, unknown>[] {
  const events: Record<string, unknown>[] = [];
  const hierarchy = ['ConversationManager.process_message', 'CodeActActor.act'];
  const hierarchyLabel = hierarchy.join('->');

  // LLM reasoning — planning the search
  events.push({
    kind: 'tool_loop',
    message: {
      role: 'assistant',
      content:
        'I need to find comparable office transactions near 45 Moorgate, EC2R. The subject property is a Grade A office, 12,500 sqft NIA, refurbished 2023, single-let on a 10-year lease with a break at year 5. Let me search for transactions within 0.5 miles, 8,000–18,000 sqft, completed in the last 12 months.',
    },
    method: 'act',
    hierarchy,
    hierarchy_label: hierarchyLabel,
    event_timestamp: ts(3, 8, 37, 0),
    event_id: 'tl-001',
  });

  // Tool call — search_comps
  events.push({
    kind: 'tool_loop',
    message: {
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'tc-001',
          function: {
            name: 'search_comps',
            arguments: JSON.stringify({
              location: 'EC2R',
              radius_miles: 0.5,
              property_type: 'Office',
              min_sqft: 8000,
              max_sqft: 18000,
              min_grade: 'B+',
              months_lookback: 12,
              sources: ['CoStar', 'EGi', 'Land Registry', 'Internal Records'],
            }),
          },
        },
      ],
    },
    method: 'act',
    hierarchy,
    hierarchy_label: hierarchyLabel,
    event_timestamp: ts(3, 8, 38, 0),
    event_id: 'tl-002',
  });

  // Tool result — search_comps
  events.push({
    kind: 'tool_loop',
    message: {
      role: 'tool',
      content: JSON.stringify({
        total_results: 42,
        shortlisted: 6,
        top_comps: [
          { address: '12 Moorgate', sqft: 14200, price_sqft: 700, niy: 5.25, lease_yrs: 10 },
          { address: '55 Gresham St', sqft: 18500, price_sqft: 780, niy: 4.85, lease_yrs: 15 },
          { address: '25 Copthall Ave', sqft: 13400, price_sqft: 700, niy: 5.3, lease_yrs: 10 },
          { address: '30 Coleman St', sqft: 9200, price_sqft: 600, niy: 5.9, lease_yrs: 5 },
          { address: '60 London Wall', sqft: 16700, price_sqft: 750, niy: 4.95, lease_yrs: 12 },
          { address: '88 Wood St', sqft: 15100, price_sqft: 700, niy: 5.15, lease_yrs: 10 },
        ],
      }),
      tool_call_id: 'tc-001',
      name: 'search_comps',
    },
    method: 'act',
    hierarchy,
    hierarchy_label: hierarchyLabel,
    event_timestamp: ts(3, 9, 12, 0),
    event_id: 'tl-003',
  });

  // LLM reasoning — adjustments
  events.push({
    kind: 'tool_loop',
    message: {
      role: 'assistant',
      content:
        "Good, I have 6 strong comparables. Now I need to apply adjustments for the break clause, size differential, refurbishment quality, and location micro-factors. The 5-year tenant break is the key differentiator — it reduces income certainty and should add approximately 35-40bps to the yield. Let me run the adjustment calculations using the firm's methodology.",
    },
    method: 'act',
    hierarchy,
    hierarchy_label: hierarchyLabel,
    event_timestamp: ts(3, 9, 15, 30),
    event_id: 'tl-004',
  });

  // Tool call — adjust_comp (primary anchor)
  events.push({
    kind: 'tool_loop',
    message: {
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'tc-002',
          function: {
            name: 'adjust_comp',
            arguments: JSON.stringify({
              comp_address: '12 Moorgate',
              base_price_sqft: 700,
              base_niy: 5.25,
              adjustments: [
                {
                  factor: 'size',
                  pct: -1.5,
                  rationale: 'Subject 12% smaller — slightly less efficient floor plate',
                },
                {
                  factor: 'lease_break',
                  yield_bps: 40,
                  rationale: 'Tenant break at yr 5 vs no break — income uncertainty',
                },
                {
                  factor: 'refurbishment',
                  pct: 2.0,
                  rationale: '2023 Cat A refurb vs 2021 — superior specification',
                },
              ],
            }),
          },
        },
      ],
    },
    method: 'act',
    hierarchy,
    hierarchy_label: hierarchyLabel,
    event_timestamp: ts(3, 9, 20, 0),
    event_id: 'tl-005',
  });

  // Tool result — adjust_comp
  events.push({
    kind: 'tool_loop',
    message: {
      role: 'tool',
      content: JSON.stringify({
        adjusted_price_sqft: 710,
        adjusted_niy: 5.65,
        implied_capital_value: 8_875_000,
        adjustments_applied: 3,
        confidence: 'high',
      }),
      tool_call_id: 'tc-002',
      name: 'adjust_comp',
    },
    method: 'act',
    hierarchy,
    hierarchy_label: hierarchyLabel,
    event_timestamp: ts(3, 9, 22, 0),
    event_id: 'tl-006',
  });

  // Tool call — populate_template
  events.push({
    kind: 'tool_loop',
    message: {
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'tc-003',
          function: {
            name: 'populate_template',
            arguments: JSON.stringify({
              template: 'Sterling_RedBook_Office_v3.docx',
              sections: [
                'executive_summary',
                'market_commentary',
                'property_description',
                'comparable_evidence',
                'investment_method',
                'special_assumptions',
                'appendices',
              ],
              market_value: 8_875_000,
              market_rent_sqft: 90.0,
              niy: 5.65,
              equivalent_yield: 5.45,
              num_comps: 6,
              num_pages: 23,
            }),
          },
        },
      ],
    },
    method: 'act',
    hierarchy,
    hierarchy_label: hierarchyLabel,
    event_timestamp: ts(3, 11, 55, 0),
    event_id: 'tl-007',
  });

  // Tool result — populate_template
  events.push({
    kind: 'tool_loop',
    message: {
      role: 'tool',
      content: JSON.stringify({
        output_file: 'Sterling_Valuation_45Moorgate_Draft_v1.docx',
        pages: 23,
        sections_populated: 7,
        comp_evidence_entries: 6,
        market_data_citations: 4,
        file_size_kb: 142,
      }),
      tool_call_id: 'tc-003',
      name: 'populate_template',
    },
    method: 'act',
    hierarchy,
    hierarchy_label: hierarchyLabel,
    event_timestamp: ts(2, 7, 5, 0),
    event_id: 'tl-008',
  });

  // LLM reasoning — summary
  events.push({
    kind: 'tool_loop',
    message: {
      role: 'assistant',
      content:
        "The draft valuation report is complete. I've populated all 7 sections of the Sterling Red Book template with the subject property details, 6 comparable evidence entries with adjustments, investment method workings showing the derivation of the 5.65% NIY, and the Market Value opinion of £8,875,000. The report includes market commentary citing MSCI data, BoE base rate, and City vacancy statistics. Ready for the valuer's review.",
    },
    method: 'act',
    hierarchy,
    hierarchy_label: hierarchyLabel,
    event_timestamp: ts(2, 7, 10, 0),
    event_id: 'tl-009',
  });

  return events;
}

/* eslint-enable @typescript-eslint/naming-convention */

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------

export async function seedReAppraisal(): Promise<SeededState> {
  const valuer = createUser({ name: 'James', lastName: 'Whitfield', credits: 50_000 });
  createEmailLogin({ userId: valuer.id });

  const assistant = createAssistant({
    userId: valuer.id,
    firstName: 'Aria',
    surname: 'Sterling',
  });

  const { apiKey } = valuer;
  const { agentId } = assistant;
  const actionOpts = { apiKey, userId: valuer.id, assistantId: agentId };

  await ensureProject(apiKey, 'Assistants');

  await seedChatInfrastructure({
    apiKey,
    userId: valuer.id,
    assistantId: agentId,
    email: valuer.email,
  });

  // Make the auto-provisioned personal Coordinator chat-ready.
  await seedCoordinatorChatForUsers([valuer]);

  // Seed knowledge (comparables + market data)
  await Promise.all([
    seedLogs(apiKey, valuer.id, agentId, 'Contacts', CONTACTS),
    seedLogs(apiKey, valuer.id, agentId, 'Knowledge/Comparables', COMPARABLES),
    seedLogs(apiKey, valuer.id, agentId, 'Knowledge/MarketIndices', MARKET_INDICES),
  ]);

  // Seed action events (ManagerMethod tree + ToolLoop detail)
  const mmEvents = buildManagerMethodEvents();
  const tlEvents = buildToolLoopEvents();

  await seedManagerMethodEvents(actionOpts, mmEvents);
  await seedToolLoopEvents(actionOpts, tlEvents);

  // Seed transcripts sequentially to maintain message ordering
  const transcripts = buildTranscripts();
  const BATCH_SIZE = 20;
  for (let i = 0; i < transcripts.length; i += BATCH_SIZE) {
    await seedLogs(apiKey, valuer.id, agentId, 'Transcripts', transcripts.slice(i, i + BATCH_SIZE));
  }

  return {
    users: { valuer },
    assistants: [assistant],
    credentials: {
      valuer: {
        email: valuer.email,
        password: 'testpass123',
        apiKey: valuer.apiKey,
        userId: valuer.id,
      },
    },
  };
}
