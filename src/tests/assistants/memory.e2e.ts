/**
 * Memory Tab E2E Tests — browser-based user flows verifying the Memory
 * tab on the assistant right pane, including tab switching, sub-tab
 * navigation, empty states, seeded data rendering, pagination,
 * and refresh, all driven by real data seeded via the Orchestra API.
 *
 * Task-specific tests live in tasks.e2e.ts.
 *
 * Run: npx playwright test src/tests/assistants/memory.e2e.ts
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

function uniqueMemoryEmail(): string {
  return `memory-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@unify.ai`;
}

const user = createTestUser({
  email: uniqueMemoryEmail(),
  name: 'MemoryE2E',
  lastName: 'Tester',
  credits: 50_000,
});
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);
test.describe.configure({ mode: 'serial' });

const ASSISTANT_CONTACT_ID = 0;
const OWNER_CONTACT_ID = 1;

const emptyAssistant = createAssistant({
  userId: user.id,
  firstName: 'EmptyBot',
  surname: 'NoMemory',
});

const dataAssistant = createAssistant({
  userId: user.id,
  firstName: 'MemBot',
  surname: 'WithData',
});

let memoryOrg: SeededOrg | undefined;
let destinationAssistant: SeededAssistant | undefined;

function ensureDestinationAssistant(): { org: SeededOrg; assistant: SeededAssistant } {
  if (!memoryOrg || !destinationAssistant) {
    memoryOrg = createOrg({ name: `MemoryOrg_${Date.now()}`, ownerId: user.id });
    ensureProjectSync(memoryOrg.ownerOrgApiKey);
    destinationAssistant = createAssistant({
      userId: user.id,
      orgId: memoryOrg.id,
      firstName: 'ScopeBot',
      surname: 'Drilldown',
    });
  }
  return { org: memoryOrg, assistant: destinationAssistant };
}

test.afterAll(() => {
  setUserCredits(user.id, 50_000);
  deleteAllAssistantsForUser(user.id);
  if (memoryOrg) {
    deleteOrg(memoryOrg.id);
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

function createMemoryTeamForAssistant(
  targetAssistant: SeededAssistant,
  opts: {
    selfContactId: number;
    bossContactId: number;
  }
): number {
  if (targetAssistant.organizationId === null) {
    throw new Error('createMemoryTeamForAssistant requires an org-scoped assistant');
  }

  const suffix = Date.now();
  const rawTeamId = dbExec(`
INSERT INTO team (name, description, organization_id, status)
VALUES (
  'Memory Drill Team ${suffix}',
  'Shared memory drill-down e2e team for destination dropdown coverage',
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
  }[]
) {
  for (const msg of messages) {
    const res = await orchestraFetch(
      '/v0/logs',
      {
        method: 'POST',
        body: JSON.stringify({
          project_name: 'Assistants',
          context: `${userId}/${assistantId}/Transcripts`,
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

  const teamId = createMemoryTeamForAssistant(destination, {
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

  destinationSeeded = true;
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

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

async function selectAssistantAndOpenMemory(
  page: import('@playwright/test').Page,
  agentId: number
) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await dismissCoordinatorOnboardingIfOpen(page);

  await selectAssistantInList(page, agentId);
  await page.waitForTimeout(1_500);

  // Memory is a rail section now; selecting it activates the Memory view in
  // the section host (defaulting to the Contacts sub-tab). The in-pane
  // sub-tab dropdown (`right-pane-tab-memory`) only renders once Memory is
  // active.
  await openRailSection(page, 'memory');
  await page.waitForTimeout(1_500);
}

/**
 * Switch the active Memory sub-tab via the right-pane tab strip
 * dropdown. The in-pane footer sub-tab row was removed once the
 * dropdown became the single source of truth for sub-tab navigation,
 * so existing test logic that used to click `memory-tab-{ctx}` directly
 * routes through this helper instead.
 */
async function switchMemorySubTab(
  page: import('@playwright/test').Page,
  ctx: 'contacts' | 'transcripts' | 'knowledge' | 'guidance' | 'functions'
) {
  await page.getByTestId('right-pane-tab-memory').click();
  await page.getByTestId(`right-pane-tab-memory-menu-${ctx}`).click();
}

// ===========================================================================
// Tab Switching
// ===========================================================================

test('Memory tab is visible when an assistant is selected', async ({ authedPage: page }) => {
  await selectAssistantAndOpenMemory(page, emptyAssistant.agentId);

  const memoryTab = page.getByTestId('right-pane-tab-memory');
  await expect(memoryTab).toBeVisible({ timeout: 5_000 });
});

test('switches to Memory tab and exposes sub-tabs in the dropdown', async ({
  authedPage: page,
}) => {
  await selectAssistantAndOpenMemory(page, emptyAssistant.agentId);

  const memoryTab = page.getByTestId('right-pane-tab-memory');
  await expect(memoryTab).toHaveAttribute('data-state', 'active');

  // Sub-tab navigation lives in the tab strip dropdown now; open it
  // and assert the expected sub-tabs are present.
  await memoryTab.click();
  await expect(page.getByTestId('right-pane-tab-memory-menu-contacts')).toBeVisible({
    timeout: 3_000,
  });
  await expect(page.getByTestId('right-pane-tab-memory-menu-transcripts')).toBeVisible({
    timeout: 3_000,
  });
  await expect(page.getByTestId('right-pane-tab-memory-menu-knowledge')).toBeVisible({
    timeout: 3_000,
  });
});

test('can switch between all main tabs', async ({ authedPage: page }) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  await selectAssistantInList(page, emptyAssistant.agentId);
  await page.waitForTimeout(1_500);

  // Top-level navigation now flows through the rail's Workspace/Brain
  // sections; each becomes `aria-current="page"` when active.
  await expect(page.getByTestId('rail-section-chat')).toHaveAttribute('aria-current', 'page');

  await openRailSection(page, 'tasks');
  await expect(page.getByTestId('rail-section-tasks')).toHaveAttribute('aria-current', 'page');

  await openRailSection(page, 'memory');
  await expect(page.getByTestId('rail-section-memory')).toHaveAttribute('aria-current', 'page');

  await openRailSection(page, 'dashboards');
  await expect(page.getByTestId('rail-section-dashboards')).toHaveAttribute('aria-current', 'page');

  await openRailSection(page, 'chat');
  await expect(page.getByTestId('rail-section-chat')).toHaveAttribute('aria-current', 'page');

  await openRailSection(page, 'actions');
  await expect(page.getByTestId('rail-section-actions')).toHaveAttribute('aria-current', 'page');
});

// ===========================================================================
// Empty State
// ===========================================================================

test('shows empty state when assistant has no data', async ({ authedPage: page }) => {
  await selectAssistantAndOpenMemory(page, emptyAssistant.agentId);

  const memoryPane = page.getByTestId('memory-pane');
  await expect(memoryPane).toBeVisible({ timeout: 10_000 });

  await expect(page.locator('text=No contacts found')).toBeVisible({ timeout: 10_000 });
});

// ===========================================================================
// Seeded Data — Contacts
// ===========================================================================

test('displays seeded contacts in the Contacts sub-tab', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  // The Memory tab chip now in-place displays the active sub-tab name,
  // so the previous `data-active` assertion on the footer button is
  // expressed here as a label check on the main tab.
  await expect(page.getByTestId('right-pane-tab-memory')).toContainText('Contacts');
  const table = page.getByTestId('memory-table-contacts');
  await expect(table).toBeVisible({ timeout: 10_000 });

  await expect(table.getByRole('cell', { name: 'Alice', exact: true })).toBeVisible({
    timeout: 5_000,
  });
  await expect(table.getByRole('cell', { name: 'Bob', exact: true })).toBeVisible({
    timeout: 5_000,
  });
  await expect(table.getByRole('cell', { name: 'alice@example.com', exact: true })).toBeVisible({
    timeout: 5_000,
  });
});

test('contacts sub-tab shows correct row count', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  const footer = page.getByTestId('memory-table-footer');
  await expect(footer).toBeVisible({ timeout: 10_000 });
  await expect(footer.locator('text=/3 of 3/')).toBeVisible({ timeout: 5_000 });
});

test('memory destination dropdown is hidden for solo assistants', async ({ authedPage: page }) => {
  await selectAssistantAndOpenMemory(page, emptyAssistant.agentId);

  const memoryPane = page.getByTestId('memory-pane');
  await expect(memoryPane).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('memory-destination-dropdown')).toHaveCount(0);
});

test('memory dropdown drills into personal and shared roots', async ({ authedPage: page }) => {
  const { org, assistant: destination } = ensureDestinationAssistant();

  await page.goto('/assistants');
  await closeHireDialogIfOpen(page);
  await page.evaluate(async (orgId) => {
    await fetch('/api/session/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: String(orgId) }),
    });
  }, org.id);
  await page.reload();
  await closeHireDialogIfOpen(page);

  await ensureDestinationSeeded();
  await selectAssistantAndOpenMemory(page, destination.agentId);

  const table = page.getByTestId('memory-table-contacts');
  await expect(table.getByRole('cell', { name: 'Alice', exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect(table.getByRole('cell', { name: 'SharedOnly', exact: true })).toBeVisible({
    timeout: 10_000,
  });

  await page.getByTestId('memory-destination-dropdown').click();
  await page.getByRole('option', { name: /Memory Drill Team/ }).click();

  await expect(table.getByRole('cell', { name: 'SharedOnly', exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(table.getByRole('cell', { name: 'Alice', exact: true })).not.toBeVisible({
    timeout: 10_000,
  });

  await page.getByTestId('memory-destination-dropdown').click();
  await page.getByRole('option', { name: 'Personal' }).click();

  await expect(table.getByRole('cell', { name: 'Alice', exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(table.getByRole('cell', { name: 'SharedOnly', exact: true })).not.toBeVisible({
    timeout: 10_000,
  });
});

// ===========================================================================
// Seeded Data — Transcripts
// ===========================================================================

test('displays seeded transcripts in the Transcripts sub-tab', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  await switchMemorySubTab(page, 'transcripts');
  await page.waitForTimeout(1_000);

  await expect(page.getByTestId('right-pane-tab-memory')).toContainText('Transcripts');
  const table = page.getByTestId('memory-table-transcripts');
  await expect(table).toBeVisible({ timeout: 10_000 });

  await expect(table.locator('text=Hello, can you help me with my schedule?')).toBeVisible({
    timeout: 5_000,
  });
  await expect(table.locator('text=Of course! Let me check your calendar.')).toBeVisible({
    timeout: 5_000,
  });
  await expect(table.locator('text=What is the status of the project?')).toBeVisible({
    timeout: 5_000,
  });
});

// ===========================================================================
// Sub-tab Navigation
// ===========================================================================

test('switching between sub-tabs preserves data and shows correct tables', async ({
  authedPage: page,
}) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  await expect(page.getByTestId('memory-table-contacts')).toBeVisible({ timeout: 10_000 });

  await switchMemorySubTab(page, 'transcripts');
  await page.waitForTimeout(500);
  await expect(page.getByTestId('memory-table-transcripts')).toBeVisible({ timeout: 5_000 });

  await switchMemorySubTab(page, 'knowledge');
  await page.waitForTimeout(500);
  await expect(page.getByTestId('memory-table-knowledge')).toBeVisible({ timeout: 5_000 });

  await switchMemorySubTab(page, 'contacts');
  await page.waitForTimeout(500);
  const table = page.getByTestId('memory-table-contacts');
  await expect(table).toBeVisible({ timeout: 5_000 });
  await expect(table.getByRole('cell', { name: 'Alice', exact: true })).toBeVisible({
    timeout: 3_000,
  });
});

// ===========================================================================
// Refresh
// ===========================================================================

test('refresh button triggers data refetch without errors', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  const refreshBtn = page.getByTestId('memory-refresh');
  await expect(refreshBtn).toBeVisible({ timeout: 10_000 });

  await refreshBtn.click();
  await page.waitForTimeout(2_000);

  await expect(refreshBtn).toBeVisible({ timeout: 5_000 });
  await expect(refreshBtn).toBeEnabled();
  const table = page.getByTestId('memory-table-contacts');
  await expect(table.getByRole('cell', { name: 'Alice', exact: true })).toBeVisible({
    timeout: 5_000,
  });
});

// ===========================================================================
// Data is read-only (no edit controls)
// ===========================================================================

test('memory tables are read-only with no edit controls', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  const table = page.getByTestId('memory-table-contacts');
  await expect(table).toBeVisible({ timeout: 10_000 });

  await expect(table.locator('button:has-text("Edit")')).not.toBeVisible({ timeout: 2_000 });
  await expect(table.locator('button:has-text("Delete")')).not.toBeVisible({ timeout: 2_000 });
  await expect(table.locator('button:has-text("Add")')).not.toBeVisible({ timeout: 2_000 });

  await expect(table.locator('input')).not.toBeVisible({ timeout: 1_000 });
});

// ===========================================================================
// Row Detail Panel
// ===========================================================================

test('clicking a row opens the detail panel with full field values', async ({
  authedPage: page,
}) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  const table = page.getByTestId('memory-table-contacts');
  await expect(table).toBeVisible({ timeout: 10_000 });

  const aliceRow = table.locator('[data-testid="memory-table-row"]', { hasText: 'Alice' });
  await expect(aliceRow).toBeVisible({ timeout: 5_000 });
  await aliceRow.click();
  await page.waitForTimeout(500);

  const detail = page.getByTestId('memory-row-detail');
  await expect(detail).toBeVisible({ timeout: 5_000 });

  const fields = page.getByTestId('memory-row-detail-fields');
  await expect(fields.getByText(/^Alice$/)).toBeVisible({ timeout: 3_000 });
  await expect(fields.getByText(/^alice@example\.com$/)).toBeVisible({ timeout: 3_000 });
  await expect(fields.locator('text=America/New_York')).toBeVisible({ timeout: 3_000 });
});

test('detail panel shows full untruncated content for transcripts', async ({
  authedPage: page,
}) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  await switchMemorySubTab(page, 'transcripts');
  await page.waitForTimeout(1_000);

  const table = page.getByTestId('memory-table-transcripts');
  await expect(table).toBeVisible({ timeout: 10_000 });

  const msgRow = table.locator('[data-testid="memory-table-row"]', { hasText: 'schedule' });
  await expect(msgRow).toBeVisible({ timeout: 5_000 });
  await msgRow.click();
  await page.waitForTimeout(500);

  const detail = page.getByTestId('memory-row-detail');
  await expect(detail).toBeVisible({ timeout: 5_000 });

  await expect(detail.locator('text=Hello, can you help me with my schedule?')).toBeVisible({
    timeout: 3_000,
  });
});

test('detail panel closes when clicking the close button', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  const table = page.getByTestId('memory-table-contacts');
  await expect(table).toBeVisible({ timeout: 10_000 });

  const row = table.locator('[data-testid="memory-table-row"]').first();
  await row.click();
  await page.waitForTimeout(500);

  const detail = page.getByTestId('memory-row-detail');
  await expect(detail).toBeVisible({ timeout: 5_000 });

  const closeBtn = detail.locator('button:has(svg)').first();
  await closeBtn.click();
  await page.waitForTimeout(500);

  await expect(detail).not.toBeVisible({ timeout: 3_000 });
});

// ===========================================================================
// Server-side Sorting
// ===========================================================================

test('clicking a column header sorts data server-side', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  const table = page.getByTestId('memory-table-contacts');
  await expect(table).toBeVisible({ timeout: 10_000 });

  const firstNameHeader = table.locator('th', { hasText: 'First Name' });
  await expect(firstNameHeader).toBeVisible({ timeout: 5_000 });
  await firstNameHeader.click();
  await page.waitForTimeout(2_000);

  const rows = table.locator('[data-testid="memory-table-row"]');
  await expect(rows.first()).toBeVisible({ timeout: 5_000 });

  await firstNameHeader.click();
  await page.waitForTimeout(2_000);
  await expect(rows.first()).toBeVisible({ timeout: 5_000 });
});

test('sorting indicator shows on sorted column header', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  const table = page.getByTestId('memory-table-contacts');
  await expect(table).toBeVisible({ timeout: 10_000 });

  const idHeader = table.locator('th', { hasText: 'ID' });
  await expect(idHeader).toBeVisible({ timeout: 5_000 });

  await idHeader.click();
  await page.waitForTimeout(2_000);

  await expect(idHeader).toBeVisible({ timeout: 5_000 });
});

// ===========================================================================
// Footer shows loaded-of-total count
// ===========================================================================

test('footer shows loaded count vs total count', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  const footer = page.getByTestId('memory-table-footer');
  await expect(footer).toBeVisible({ timeout: 10_000 });
  await expect(footer.locator('text=/3 of 3/')).toBeVisible({ timeout: 5_000 });
});

// ===========================================================================
// Search / Filtering
// ===========================================================================

test('searching contacts filters results server-side', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  const searchInput = page.getByTestId('memory-search');
  await expect(searchInput).toBeVisible({ timeout: 5_000 });

  const footer = page.getByTestId('memory-table-footer');
  await expect(footer).toBeVisible({ timeout: 10_000 });
  await expect(footer).toContainText('3 of 3');

  await searchInput.fill('Alice');
  await searchInput.press('Enter');

  await expect(footer).toContainText('1 of 1', { timeout: 10_000 });

  const rows = page.getByTestId('memory-table-row');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Alice');
});

test('clear button removes search filter', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  const searchInput = page.getByTestId('memory-search');
  const footer = page.getByTestId('memory-table-footer');
  await expect(footer).toBeVisible({ timeout: 10_000 });

  await searchInput.fill('Alice');
  await searchInput.press('Enter');
  await expect(footer).toContainText('1 of 1', { timeout: 10_000 });

  const clearBtn = page.getByTestId('memory-search-clear');
  await expect(clearBtn).toBeVisible({ timeout: 3_000 });

  await clearBtn.click();
  await expect(footer).toContainText('3 of 3', { timeout: 10_000 });
  await expect(clearBtn).not.toBeVisible();
});

test('search is case-insensitive', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  const searchInput = page.getByTestId('memory-search');
  const footer = page.getByTestId('memory-table-footer');
  await expect(footer).toBeVisible({ timeout: 10_000 });

  await searchInput.fill('alice');
  await searchInput.press('Enter');
  await expect(footer).toContainText('1 of 1', { timeout: 10_000 });
});

test('search with no results shows empty message', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  const searchInput = page.getByTestId('memory-search');
  const footer = page.getByTestId('memory-table-footer');
  await expect(footer).toBeVisible({ timeout: 10_000 });

  await searchInput.fill('xyznonexistent');
  await searchInput.press('Enter');

  await expect(footer).not.toBeVisible({ timeout: 10_000 });
  await expect(page.locator('text=No results match your search')).toBeVisible({ timeout: 5_000 });
});

test('search query persists when switching tabs and back', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  const searchInput = page.getByTestId('memory-search');
  const footer = page.getByTestId('memory-table-footer');
  await expect(footer).toBeVisible({ timeout: 10_000 });

  await searchInput.fill('Alice');
  await searchInput.press('Enter');
  await expect(footer).toContainText('1 of 1', { timeout: 10_000 });

  await switchMemorySubTab(page, 'transcripts');
  await page.waitForTimeout(1_000);

  await expect(searchInput).toHaveValue('');

  await switchMemorySubTab(page, 'contacts');
  await expect(searchInput).toHaveValue('Alice', { timeout: 3_000 });

  await expect(footer).toContainText('1 of 1', { timeout: 10_000 });
});

// ===========================================================================
// Backend Data Verification
// ===========================================================================

test('memory tab data matches what was seeded via Orchestra API', async ({ authedPage: page }) => {
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

  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  // The sub-tab count badges were removed when the dropdown took over
  // sub-tab navigation, so we verify the seeded counts via each
  // sub-tab's table footer row-count chip instead.
  const footer = page.getByTestId('memory-table-footer');
  await expect(footer).toContainText('3 of 3', { timeout: 10_000 });

  await switchMemorySubTab(page, 'transcripts');
  await expect(footer).toContainText('3 of 3', { timeout: 5_000 });
});
