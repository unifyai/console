/**
 * Brain E2E Tests — browser-based user flows verifying each dedicated Brain
 * rail section on the assistant shell: Contacts (directory cards),
 * Transcripts (consolidated table), Knowledge (dynamic table), Functions
 * (skill cards) and Guidance (doc library). Every section is reached through
 * its own rail entry — the legacy aggregate "Brain" tab has been retired — and
 * is driven by real data seeded via the Orchestra API.
 *
 * Task-specific tests live in tasks.e2e.ts.
 *
 * Run: npx playwright test src/tests/assistants/brain.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  createOrg,
  deleteOrg,
  navigateToAssistants,
  closeHireDialogIfOpen,
  selectAssistantInList,
  deleteAllAssistantsForUser,
  ensureProjectSync,
  orchestraFetch,
  setUserCredits,
  dbExec,
  dbExecBlock,
  openRailSection,
  type SeededAssistant,
  type SeededOrg,
} from './helpers';

function uniqueBrainEmail(): string {
  return `brain-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@unify.ai`;
}

const user = createTestUser({
  email: uniqueBrainEmail(),
  name: 'BrainE2E',
  lastName: 'Tester',
  credits: 50_000,
});
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);
// Not serial: each test selects its own assistant + section and seeds via the
// idempotent `ensure*` helpers, so they're order-independent. Keeping them
// independent means a single flaky/slow test can't skip the rest of the file.

const ASSISTANT_CONTACT_ID = 0;
const OWNER_CONTACT_ID = 1;

const emptyAssistant = createAssistant({
  userId: user.id,
  firstName: 'EmptyBot',
  surname: 'NoBrain',
});

const dataAssistant = createAssistant({
  userId: user.id,
  firstName: 'MemBot',
  surname: 'WithData',
});

let brainOrg: SeededOrg | undefined;
let destinationAssistant: SeededAssistant | undefined;

function ensureDestinationAssistant(): { org: SeededOrg; assistant: SeededAssistant } {
  if (!brainOrg || !destinationAssistant) {
    brainOrg = createOrg({ name: `BrainOrg_${Date.now()}`, ownerId: user.id });
    ensureProjectSync(brainOrg.ownerOrgApiKey);
    destinationAssistant = createAssistant({
      userId: user.id,
      orgId: brainOrg.id,
      firstName: 'ScopeBot',
      surname: 'Drilldown',
    });
  }
  return { org: brainOrg, assistant: destinationAssistant };
}

test.afterAll(() => {
  setUserCredits(user.id, 50_000);
  deleteAllAssistantsForUser(user.id);
  if (brainOrg) {
    deleteOrg(brainOrg.id);
  }
  cleanupUser(user.id);
});

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/naming-convention */

async function seedContacts(
  apiKey: string,
  userId: string,
  assistantId: number,
  contacts: {
    contact_id: number;
    first_name: string;
    last_name: string;
    email_address: string;
    timezone?: string;
  }[],
  context = `${userId}/${assistantId}/Contacts`
) {
  for (const contact of contacts) {
    const res = await orchestraFetch(
      '/v0/logs',
      {
        method: 'POST',
        body: JSON.stringify({
          project_name: 'Assistants',
          context,
          entries: [contact],
        }),
      },
      apiKey
    );
    if (!res.ok) throw new Error(`Failed to seed contact: ${res.status} ${await res.text()}`);
  }
}

function createBrainTeamForAssistant(
  targetAssistant: SeededAssistant,
  opts: {
    selfContactId: number;
    bossContactId: number;
  }
): number {
  if (targetAssistant.organizationId === null) {
    throw new Error('createBrainTeamForAssistant requires an org-scoped assistant');
  }

  const suffix = Date.now();
  const rawTeamId = dbExec(`
INSERT INTO team (name, description, organization_id, status)
VALUES (
  'Brain Drill Team ${suffix}',
  'Shared brain drill-down e2e team for destination dropdown coverage',
  ${targetAssistant.organizationId},
  'active'
)
RETURNING id;
`);
  const teamId = Number(rawTeamId.match(/^\d+$/m)?.[0]);
  if (!Number.isInteger(teamId)) {
    throw new Error(`Failed to parse seeded team id from psql output: ${rawTeamId}`);
  }

  dbExecBlock(`
INSERT INTO team_assistant_memberships (team_id, assistant_id, added_by)
VALUES (${teamId}, ${targetAssistant.agentId}, '${targetAssistant.userId}')
ON CONFLICT DO NOTHING;

INSERT INTO contact_memberships (
  assistant_id,
  contact_id,
  target_scope,
  target_team_id,
  relationship,
  should_respond,
  response_policy,
  can_edit
)
VALUES
  (${targetAssistant.agentId}, ${opts.selfContactId}, 'team', ${teamId}, 'self', true, '', true),
  (${targetAssistant.agentId}, ${opts.bossContactId}, 'team', ${teamId}, 'boss', true, '', true)
ON CONFLICT DO NOTHING;
`);

  return teamId;
}

async function seedTranscripts(
  apiKey: string,
  userId: string,
  assistantId: number,
  messages: {
    message_id: number;
    medium: string;
    sender_id: number;
    receiver_ids: number[];
    timestamp: string;
    content: string;
    exchange_id: number;
  }[],
  context = `${userId}/${assistantId}/Transcripts`
) {
  for (const msg of messages) {
    const res = await orchestraFetch(
      '/v0/logs',
      {
        method: 'POST',
        body: JSON.stringify({
          project_name: 'Assistants',
          context,
          entries: [msg],
        }),
      },
      apiKey
    );
    if (!res.ok) throw new Error(`Failed to seed transcript: ${res.status} ${await res.text()}`);
  }
}

/* eslint-enable @typescript-eslint/naming-convention */

let seeded = false;
async function ensureSeeded() {
  if (seeded) return;

  await seedContacts(user.apiKey, user.id, dataAssistant.agentId, [
    {
      contact_id: ASSISTANT_CONTACT_ID,
      first_name: 'MemBot',
      last_name: 'WithData',
      email_address: 'membot@test.ai',
      timezone: 'UTC',
    },
    {
      contact_id: OWNER_CONTACT_ID,
      first_name: 'Alice',
      last_name: 'Owner',
      email_address: 'alice@example.com',
      timezone: 'America/New_York',
    },
    {
      contact_id: 2,
      first_name: 'Bob',
      last_name: 'User',
      email_address: 'bob@example.com',
      timezone: 'Europe/London',
    },
  ]);

  await seedTranscripts(user.apiKey, user.id, dataAssistant.agentId, [
    {
      message_id: 1,
      medium: 'unify_message',
      sender_id: OWNER_CONTACT_ID,
      receiver_ids: [ASSISTANT_CONTACT_ID],
      timestamp: '2025-06-01T10:00:00Z',
      content: 'Hello, can you help me with my schedule?',
      exchange_id: 1,
    },
    {
      message_id: 2,
      medium: 'unify_message',
      sender_id: ASSISTANT_CONTACT_ID,
      receiver_ids: [OWNER_CONTACT_ID],
      timestamp: '2025-06-01T10:01:00Z',
      content: 'Of course! Let me check your calendar.',
      exchange_id: 1,
    },
    {
      message_id: 3,
      medium: 'unify_message',
      sender_id: 2,
      receiver_ids: [ASSISTANT_CONTACT_ID],
      timestamp: '2025-06-02T14:30:00Z',
      content: 'What is the status of the project?',
      exchange_id: 2,
    },
  ]);

  seeded = true;
}

let destinationSeeded = false;
async function ensureDestinationSeeded() {
  if (destinationSeeded) return;

  const { org, assistant: destination } = ensureDestinationAssistant();

  // Personal-root contacts (resolve transcript sender labels) + a personal
  // transcript that should only appear under the Personal / All destinations.
  await seedContacts(org.ownerOrgApiKey, user.id, destination.agentId, [
    {
      contact_id: ASSISTANT_CONTACT_ID,
      first_name: 'ScopeBot',
      last_name: 'Drilldown',
      email_address: 'scopebot@test.ai',
      timezone: 'UTC',
    },
    {
      contact_id: OWNER_CONTACT_ID,
      first_name: 'Alice',
      last_name: 'Owner',
      email_address: 'alice@example.com',
      timezone: 'America/New_York',
    },
  ]);
  await seedTranscripts(org.ownerOrgApiKey, user.id, destination.agentId, [
    {
      message_id: 11,
      medium: 'unify_message',
      sender_id: OWNER_CONTACT_ID,
      receiver_ids: [ASSISTANT_CONTACT_ID],
      timestamp: '2025-06-03T09:00:00Z',
      content: 'Personal scope ping',
      exchange_id: 11,
    },
  ]);

  // Team-root data: a shared contact and a shared transcript that should only
  // appear under the team destination.
  const teamId = createBrainTeamForAssistant(destination, {
    selfContactId: 901,
    bossContactId: 902,
  });
  await seedContacts(
    org.ownerOrgApiKey,
    user.id,
    destination.agentId,
    [
      {
        contact_id: 701,
        first_name: 'SharedOnly',
        last_name: 'TeamContact',
        email_address: 'shared-only@example.com',
        timezone: 'UTC',
      },
    ],
    `Teams/${teamId}/Contacts`
  );
  await seedTranscripts(
    org.ownerOrgApiKey,
    user.id,
    destination.agentId,
    [
      {
        message_id: 12,
        medium: 'unify_message',
        sender_id: 901,
        receiver_ids: [ASSISTANT_CONTACT_ID],
        timestamp: '2025-06-03T10:00:00Z',
        content: 'Shared scope ping',
        exchange_id: 12,
      },
    ],
    `Teams/${teamId}/Transcripts`
  );

  destinationSeeded = true;
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

type BrainSection = 'contacts' | 'transcripts' | 'knowledge' | 'functions' | 'guidance' | 'data';

async function dismissCoordinatorOnboardingIfOpen(page: import('@playwright/test').Page) {
  const pickChat = page.getByTestId('coordinator-onboarding-pick-chat');
  if (!(await pickChat.isVisible({ timeout: 10_000 }).catch(() => false))) {
    return;
  }
  // Picking chat tears the intro overlay down, dropping us into the
  // regular platform with the Coordinator selected.
  await pickChat.click();
  await page
    .getByTestId('coordinator-onboarding')
    .waitFor({ state: 'hidden', timeout: 10_000 })
    .catch(() => {});
}

async function selectAssistant(page: import('@playwright/test').Page, agentId: number) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await dismissCoordinatorOnboardingIfOpen(page);
  await selectAssistantInList(page, agentId);
  await page.waitForTimeout(1_500);
}

/** Selects an assistant then opens one of its dedicated Brain rail sections. */
async function openBrainSection(
  page: import('@playwright/test').Page,
  agentId: number,
  section: BrainSection
) {
  await selectAssistant(page, agentId);
  await openRailSection(page, section);
  await page.waitForTimeout(1_000);
}

// ===========================================================================
// Rail navigation
// ===========================================================================

test('rail Brain sections switch the active view', async ({ authedPage: page }) => {
  await selectAssistant(page, emptyAssistant.agentId);

  // Default landing is Chat; each Brain rail section takes over the section
  // host and becomes `aria-current="page"` when selected.
  await expect(page.getByTestId('rail-section-chat')).toHaveAttribute('aria-current', 'page');

  for (const section of [
    'contacts',
    'transcripts',
    'knowledge',
    'functions',
    'guidance',
  ] as const) {
    await openRailSection(page, section);
    await expect(page.getByTestId(`rail-section-${section}`)).toHaveAttribute(
      'aria-current',
      'page'
    );
  }

  // The legacy aggregate "Brain" rail entry is gone.
  await expect(page.getByTestId('rail-section-brain')).toHaveCount(0);
});

// ===========================================================================
// Contacts — directory cards
// ===========================================================================

test('Contacts: empty state when the assistant has no contacts', async ({ authedPage: page }) => {
  await openBrainSection(page, emptyAssistant.agentId, 'contacts');

  await expect(page.getByTestId('contacts-pane')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('No contacts found.')).toBeVisible({ timeout: 10_000 });
});

test('Contacts: displays seeded contact cards', async ({ authedPage: page }) => {
  await ensureSeeded();
  await openBrainSection(page, dataAssistant.agentId, 'contacts');

  const body = page.getByTestId('contacts-body');
  await expect(body).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId(`contact-card-${OWNER_CONTACT_ID}`)).toContainText('Alice', {
    timeout: 10_000,
  });
  await expect(page.getByTestId('contact-card-2')).toContainText('Bob');
  await expect(body.getByText('alice@example.com')).toBeVisible();

  await expect(page.getByTestId('contacts-footer')).toContainText('3 of 3');
});

test('Contacts: search filters the directory and clears', async ({ authedPage: page }) => {
  await ensureSeeded();
  await openBrainSection(page, dataAssistant.agentId, 'contacts');

  const footer = page.getByTestId('contacts-footer');
  await expect(footer).toContainText('3 of 3', { timeout: 10_000 });

  const search = page.getByTestId('contacts-search');
  await search.fill('Alice');
  await expect(footer).toContainText('1 of 3', { timeout: 5_000 });
  await expect(page.getByTestId(`contact-card-${OWNER_CONTACT_ID}`)).toBeVisible();
  await expect(page.getByTestId('contact-card-2')).toHaveCount(0);

  await page.getByTestId('contacts-search-clear').click();
  await expect(footer).toContainText('3 of 3', { timeout: 5_000 });
});

test('Contacts: clicking a card opens the detail drawer', async ({ authedPage: page }) => {
  await ensureSeeded();
  await openBrainSection(page, dataAssistant.agentId, 'contacts');

  await page.getByTestId(`contact-card-${OWNER_CONTACT_ID}`).click();

  const detail = page.getByTestId('contact-detail');
  await expect(detail).toBeVisible({ timeout: 5_000 });
  const detailBody = page.getByTestId('contact-detail-body');
  await expect(detailBody.getByText('alice@example.com')).toBeVisible({ timeout: 3_000 });
  await expect(detailBody.getByText('America/New_York')).toBeVisible({ timeout: 3_000 });
});

// ===========================================================================
// Transcripts — feed / threads pane (dedicated rail section)
// ===========================================================================

async function openTranscriptsSection(page: import('@playwright/test').Page, agentId: number) {
  await openBrainSection(page, agentId, 'transcripts');
  await expect(page.getByTestId('transcripts-pane')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('transcripts-threads')).toBeVisible({ timeout: 15_000 });
}

test('Transcripts: displays seeded messages in the threads view', async ({ authedPage: page }) => {
  await ensureSeeded();
  await openTranscriptsSection(page, dataAssistant.agentId);

  const reader = page.getByTestId('transcripts-reader');
  await expect(reader).toBeVisible({ timeout: 10_000 });
  await expect(reader.getByText('Hello, can you help me with my schedule?')).toBeVisible({
    timeout: 5_000,
  });
  await expect(reader.getByText('Of course! Let me check your calendar.')).toBeVisible({
    timeout: 5_000,
  });

  await expect(page.getByTestId('brain-sub-tabs')).toHaveCount(0);
});

test('Transcripts: selecting a thread shows its messages in the reader', async ({
  authedPage: page,
}) => {
  await ensureSeeded();
  await openTranscriptsSection(page, dataAssistant.agentId);

  const threadRow = page.getByTestId('transcripts-threads').locator('button', {
    hasText: 'project',
  });
  await expect(threadRow).toBeVisible({ timeout: 10_000 });
  await threadRow.click();

  const reader = page.getByTestId('transcripts-reader');
  await expect(reader.getByText('What is the status of the project?')).toBeVisible({
    timeout: 5_000,
  });
});

test('Transcripts: search filters the thread list', async ({ authedPage: page }) => {
  await ensureSeeded();
  await openTranscriptsSection(page, dataAssistant.agentId);

  await expect(
    page.getByTestId('transcripts-reader').getByText('What is the status of the project?')
  ).toBeVisible({ timeout: 10_000 });

  await page.getByTestId('transcripts-search').fill('schedule');
  await expect(
    page.getByTestId('transcripts-threads').getByText('What is the status of the project?')
  ).not.toBeVisible({ timeout: 5_000 });

  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(
    page.getByTestId('transcripts-reader').getByText('What is the status of the project?')
  ).toBeVisible({ timeout: 10_000 });
});

test('Transcripts: refresh reloads transcript data', async ({ authedPage: page }) => {
  await ensureSeeded();
  await openTranscriptsSection(page, dataAssistant.agentId);

  await page.getByRole('button', { name: 'Refresh transcripts' }).click();
  await expect(page.getByTestId('transcripts-pane')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('transcripts-reader')).toBeVisible({ timeout: 10_000 });
});

test('Transcripts: the pane is read-only', async ({ authedPage: page }) => {
  await ensureSeeded();
  await openTranscriptsSection(page, dataAssistant.agentId);

  const pane = page.getByTestId('transcripts-pane');
  await expect(pane).toBeVisible({ timeout: 10_000 });
  await expect(pane.locator('button:has-text("Edit")')).toHaveCount(0);
  await expect(pane.locator('button:has-text("Delete")')).toHaveCount(0);
});

test('Transcripts: destination dropdown is not shown in the transcripts rail', async ({
  authedPage: page,
}) => {
  await openBrainSection(page, emptyAssistant.agentId, 'transcripts');
  await expect(page.getByTestId('transcripts-pane')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('brain-destination-dropdown')).toHaveCount(0);
});

// ===========================================================================
// Knowledge / Functions / Guidance — empty-state rendering
// ===========================================================================

// Knowledge, Functions and Guidance share the same empty-state shape, so a
// single selection that walks the three rail sections covers all of them
// while paying the (heavy) navigation + assistant-selection cost only once.
test('Knowledge / Functions / Guidance render dedicated empty states', async ({
  authedPage: page,
}) => {
  await openBrainSection(page, emptyAssistant.agentId, 'knowledge');
  await expect(page.getByTestId('brain-pane')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('No knowledge found.')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('brain-sub-tabs')).toHaveCount(0);

  await openRailSection(page, 'functions');
  await expect(page.getByTestId('functions-pane')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('No functions found.')).toBeVisible({ timeout: 10_000 });

  await openRailSection(page, 'guidance');
  await expect(page.getByTestId('doc-library-pane')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('No guidance matches.')).toBeVisible({ timeout: 10_000 });
});

// ===========================================================================
// Backend Data Verification
// ===========================================================================

test('seeded Brain data matches what was stored via the Orchestra API', async ({
  authedPage: page,
}) => {
  await ensureSeeded();

  const contactsRes = await orchestraFetch(
    `/v0/logs?project_name=Assistants&context=${user.id}/${dataAssistant.agentId}/Contacts`,
    { method: 'GET' },
    user.apiKey
  );
  expect(contactsRes.ok).toBeTruthy();
  const contactsData = await contactsRes.json();
  expect(contactsData.logs.length).toBe(3);

  const transcriptsRes = await orchestraFetch(
    `/v0/logs?project_name=Assistants&context=${user.id}/${dataAssistant.agentId}/Transcripts`,
    { method: 'GET' },
    user.apiKey
  );
  expect(transcriptsRes.ok).toBeTruthy();
  const transcriptsData = await transcriptsRes.json();
  expect(transcriptsData.logs.length).toBe(3);

  // The directory footer reflects the same three seeded contacts in the UI.
  await openBrainSection(page, dataAssistant.agentId, 'contacts');
  await expect(page.getByTestId('contacts-footer')).toContainText('3 of 3', { timeout: 10_000 });
});
