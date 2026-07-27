/**
 * Tasks Tab E2E Tests — browser-based user flows verifying the dedicated
 * Tasks tab on the assistant right pane. The tab renders expandable task
 * cards (collapsed by default); expanding a card reveals its description,
 * the labelled field grid, and its run-history table. Covers empty states,
 * seeded data rendering, snapshot refresh, running-task indicators, search,
 * and the run-detail drawer — all driven by real data seeded via the Orchestra API.
 *
 * Run: npx playwright test src/tests/assistants/tasks.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  closeHireDialogIfOpen,
  deleteAllAssistantsForUser,
  ensureProjectSync,
  orchestraFetch,
  setUserCredits,
  openRailSection,
} from './helpers';

const user = createTestUser({ name: 'TasksE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);
test.describe.configure({ mode: 'serial' });

const ASSISTANT_CONTACT_ID = 0;
const OWNER_CONTACT_ID = 1;

const emptyAssistant = createAssistant({
  userId: user.id,
  firstName: 'EmptyBot',
  surname: 'NoTasks',
});

const dataAssistant = createAssistant({
  userId: user.id,
  firstName: 'TaskBot',
  surname: 'WithData',
});

test.afterAll(() => {
  setUserCredits(user.id, 50_000);
  deleteAllAssistantsForUser(user.id);
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
  contacts: Record<string, unknown>[]
) {
  for (const contact of contacts) {
    const res = await orchestraFetch(
      '/v0/logs',
      {
        method: 'POST',
        body: JSON.stringify({
          project_name: 'Assistants',
          context: `${userId}/${assistantId}/Contacts`,
          entries: [contact],
        }),
      },
      apiKey
    );
    if (!res.ok) throw new Error(`Failed to seed contact: ${res.status} ${await res.text()}`);
  }
}

async function seedTasks(
  apiKey: string,
  userId: string,
  assistantId: number,
  tasks: Record<string, unknown>[]
) {
  for (const task of tasks) {
    const res = await orchestraFetch(
      '/v0/logs',
      {
        method: 'POST',
        body: JSON.stringify({
          project_name: 'Assistants',
          context: `${userId}/${assistantId}/Tasks`,
          entries: [task],
        }),
      },
      apiKey
    );
    if (!res.ok) throw new Error(`Failed to seed task: ${res.status} ${await res.text()}`);
  }
}

async function seedTaskRuns(
  apiKey: string,
  userId: string,
  assistantId: number,
  runs: Record<string, unknown>[]
) {
  for (const run of runs) {
    const res = await orchestraFetch(
      '/v0/logs',
      {
        method: 'POST',
        body: JSON.stringify({
          project_name: 'Assistants',
          context: `${userId}/${assistantId}/Tasks/Executions`,
          entries: [run],
        }),
      },
      apiKey
    );
    if (!res.ok) throw new Error(`Failed to seed task run: ${res.status} ${await res.text()}`);
  }
}

/* eslint-enable @typescript-eslint/naming-convention */

let seeded = false;
async function ensureSeeded() {
  if (seeded) return;

  await seedContacts(user.apiKey, user.id, dataAssistant.agentId, [
    {
      contact_id: ASSISTANT_CONTACT_ID,
      first_name: 'TaskBot',
      last_name: 'WithData',
      email_address: 'taskbot@test.ai',
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

  await seedTasks(user.apiKey, user.id, dataAssistant.agentId, [
    {
      task_id: 1,
      name: 'Send report',
      description: 'Compile and send the weekly report to Alice.',
      status: 'scheduled',
      priority: 2,
      schedule: { start_at: '2025-06-02T12:30:00Z' },
      repeat: [{ frequency: 'weekly', interval: 1, weekdays: ['MO'] }],
      created_at: '2025-06-01T09:00:00Z',
      updated_at: '2025-06-01T09:10:00Z',
    },
    {
      task_id: 2,
      name: 'Escalate security emails',
      description: 'Watch for urgent security emails and surface them to the boss.',
      status: 'triggerable',
      priority: 2,
      trigger: { medium: 'email', recurring: true },
      created_at: '2025-06-02T12:00:00Z',
      updated_at: '2025-06-02T12:05:00Z',
    },
    {
      task_id: 3,
      name: 'Follow up with Alice',
      description: 'Reply when Alice emails about the project status.',
      status: 'triggerable',
      priority: 2,
      offline: true,
      entrypoint: 101,
      trigger: { medium: 'email', from_contact_ids: [1] },
      created_at: '2025-06-03T09:00:00Z',
      updated_at: '2025-06-03T09:15:00Z',
    },
  ]);

  await seedTaskRuns(user.apiKey, user.id, dataAssistant.agentId, [
    {
      run_id: 9001,
      run_key: 'live:scheduled:run-9001',
      assistant_id: String(dataAssistant.agentId),
      task_id: 2,
      task_name: 'Send report',
      task_description: 'Compile and send the weekly report to Alice.',
      wake: 'scheduled',
      delivery: 'live',
      state: 'completed',
      scheduled_for: '2025-06-02T12:30:00Z',
      started_at: '2025-06-02T12:30:05Z',
      completed_at: '2025-06-02T12:31:00Z',
      source_medium: 'calendar',
      job_name: 'unity-live-9001',
    },
    {
      run_id: 9002,
      run_key: 'offline:triggered:run-9002',
      assistant_id: String(dataAssistant.agentId),
      task_id: 3,
      task_name: 'Follow up with Alice',
      task_description: 'Reply when Alice emails about the project status.',
      wake: 'triggered',
      delivery: 'offline',
      state: 'running',
      source_medium: 'email',
      source_contact_id: '1',
      source_contact_display_name: 'Alice Owner',
      started_at: '2025-06-03T09:20:00Z',
      job_name: 'unity-offline-9002',
    },
  ]);

  seeded = true;
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

async function selectAssistantAndOpenTasks(page: import('@playwright/test').Page, agentId: number) {
  await page.goto(`/assistants?profile=${agentId}`);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await closeHireDialogIfOpen(page);
  await page.waitForTimeout(1_500);

  // Tasks is a rail section; selecting it mounts the Tasks pane (a list of
  // expandable task cards) in the section host.
  await openRailSection(page, 'tasks');
  await page.waitForTimeout(1_500);
}

/** Locate a task card by the task name it renders in its header. */
function taskCard(page: import('@playwright/test').Page, name: string) {
  return page.getByTestId('task-card').filter({ hasText: name });
}

/** Expand a task card (cards are collapsed by default) and return it. */
async function expandTaskCard(page: import('@playwright/test').Page, name: string) {
  const card = taskCard(page, name);
  await expect(card).toBeVisible({ timeout: 10_000 });
  if ((await card.getAttribute('data-open')) === null) {
    await card.getByTestId('task-card-head').click();
    await expect(card.getByTestId('task-card-body')).toBeVisible({ timeout: 5_000 });
  }
  return card;
}

// ===========================================================================
// Empty States
// ===========================================================================

test('Tasks pane shows empty state when assistant has no tasks', async ({ authedPage: page }) => {
  await selectAssistantAndOpenTasks(page, emptyAssistant.agentId);

  await expect(page.getByText('No tasks found')).toBeVisible({ timeout: 10_000 });
});

// ===========================================================================
// Seeded Data — Task Cards
// ===========================================================================

test('displays seeded tasks with status badges and descriptions', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenTasks(page, dataAssistant.agentId);

  const scheduledCard = taskCard(page, 'Send report');
  const triggeredCard = taskCard(page, 'Escalate security emails');
  const offlineCard = taskCard(page, 'Follow up with Alice');

  await expect(scheduledCard).toBeVisible({ timeout: 10_000 });
  await expect(triggeredCard).toBeVisible({ timeout: 5_000 });
  await expect(offlineCard).toBeVisible({ timeout: 5_000 });

  // Collapsed header shows the human status label.
  await expect(scheduledCard).toContainText('Scheduled');
  await expect(triggeredCard).toContainText('Ready');

  // Expanding reveals the description and the labelled field grid.
  await expandTaskCard(page, 'Send report');
  await expect(scheduledCard).toContainText('Compile and send the weekly report to Alice.');
  await expect(scheduledCard).toContainText('Type');
  await expect(scheduledCard).toContainText('Cadence');
  await expect(scheduledCard).toContainText('Priority');

  await expandTaskCard(page, 'Follow up with Alice');
  await expect(offlineCard).toContainText('Offline');
});

// ===========================================================================
// Run History (inside expanded card)
// ===========================================================================

test('expanded card shows run history with state and source', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenTasks(page, dataAssistant.agentId);

  const card = await expandTaskCard(page, 'Follow up with Alice');

  const runRow = card.getByTestId('task-run-row').first();
  await expect(runRow).toBeVisible({ timeout: 5_000 });
  await expect(runRow).toContainText('Running');
  await expect(runRow).toContainText('Triggered by Email');
});

// ===========================================================================
// Running Task Indicators
// ===========================================================================

test('Working indicator appears in header when a run is in progress', async ({
  authedPage: page,
}) => {
  await ensureSeeded();
  await selectAssistantAndOpenTasks(page, dataAssistant.agentId);

  const snapshotStatus = page.getByTestId('tasks-snapshot-status');
  await expect(snapshotStatus).toBeVisible({ timeout: 5_000 });
  await expect(snapshotStatus).toContainText('Working');
  await expect(page.getByTestId('tasks-snapshot-working-indicator')).toBeVisible({
    timeout: 5_000,
  });
});

// ===========================================================================
// Refresh
// ===========================================================================

test('refresh picks up newly seeded tasks', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenTasks(page, dataAssistant.agentId);

  const footer = page.getByTestId('tasks-table-footer');
  await expect(footer).toContainText('3 tasks', { timeout: 10_000 });

  const taskId = Date.now();
  await seedTasks(user.apiKey, user.id, dataAssistant.agentId, [
    {
      task_id: taskId,
      name: `Follow up customer ${taskId}`,
      description: 'Reach out to the customer with the updated delivery timeline.',
      status: 'scheduled',
      priority: 3,
      schedule: { start_at: '2025-06-04T12:30:00Z' },
      created_at: '2025-06-04T12:00:00Z',
      updated_at: '2025-06-04T12:05:00Z',
    },
  ]);

  await page.getByTestId('tasks-refresh').click();

  await expect(footer).toContainText('4 tasks', { timeout: 10_000 });
  await expect(taskCard(page, `Follow up customer ${taskId}`)).toBeVisible({ timeout: 5_000 });
});

// ===========================================================================
// Run-detail drawer (opened from a run-history row)
// ===========================================================================

test('clicking a run row opens the run-detail drawer', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenTasks(page, dataAssistant.agentId);

  const card = await expandTaskCard(page, 'Follow up with Alice');
  await card.getByTestId('task-run-row').first().click();
  await page.waitForTimeout(500);

  const detail = page.getByTestId('brain-row-detail');
  await expect(detail).toBeVisible({ timeout: 5_000 });

  const fields = page.getByTestId('brain-row-detail-fields');
  await expect(fields.getByRole('heading', { name: 'Started by' })).toBeVisible({ timeout: 3_000 });
  await expect(fields.getByText('Alice Owner')).toBeVisible({ timeout: 3_000 });

  const closeBtn = detail.locator('button:has(svg)').first();
  await closeBtn.click();
  await expect(detail).not.toBeVisible({ timeout: 3_000 });
});

// ===========================================================================
// Cadence rendering (recurring tasks)
// ===========================================================================

test('recurring task card surfaces its derived cadence', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenTasks(page, dataAssistant.agentId);

  const card = await expandTaskCard(page, 'Send report');
  await expect(card).toContainText('Every week on Mon');
});

// ===========================================================================
// Search / Filtering
// ===========================================================================

test('searching tasks filters results server-side', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenTasks(page, dataAssistant.agentId);

  const searchInput = page.getByTestId('tasks-search');
  await expect(searchInput).toBeVisible({ timeout: 5_000 });

  const footer = page.getByTestId('tasks-table-footer');
  await expect(footer).toBeVisible({ timeout: 10_000 });

  await searchInput.fill('Escalate');
  await searchInput.press('Enter');

  await expect(footer).toContainText('1 task', { timeout: 10_000 });
  await expect(page.getByTestId('task-card')).toHaveCount(1);
  await expect(taskCard(page, 'Escalate security emails')).toBeVisible({ timeout: 5_000 });

  const clearBtn = page.getByTestId('tasks-search-clear');
  await expect(clearBtn).toBeVisible({ timeout: 3_000 });
  await clearBtn.click();
  await expect(footer).toContainText('3 tasks', { timeout: 10_000 });
  await expect(clearBtn).not.toBeVisible();

  await searchInput.fill('xyznonexistent');
  await searchInput.press('Enter');
  await expect(page.getByText('No results match your search')).toBeVisible({ timeout: 10_000 });
});
