/**
 * Tasks Tab E2E Tests — browser-based user flows verifying the dedicated
 * Tasks tab on the assistant right pane, including task/activity views,
 * empty states, seeded data rendering, status badges, snapshot refresh,
 * running-task indicators, search, sorting, and detail panel — all
 * driven by real data seeded via the Orchestra API.
 *
 * Run: npx playwright test src/tests/assistants/tasks.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  navigateToAssistants,
  closeHireDialogIfOpen,
  deleteAllAssistantsForUser,
  ensureProjectSync,
  orchestraFetch,
  setUserCredits,
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
          context: `${userId}/${assistantId}/Tasks/Runs`,
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
      source_type: 'scheduled',
      execution_mode: 'live',
      state: 'completed',
      scheduled_for: '2025-06-02T12:30:00Z',
      started_at: '2025-06-02T12:30:05Z',
      completed_at: '2025-06-02T12:31:00Z',
      source_medium: 'calendar',
      job_name: 'droid-live-9001',
    },
    {
      run_id: 9002,
      run_key: 'offline:triggered:run-9002',
      assistant_id: String(dataAssistant.agentId),
      task_id: 3,
      task_name: 'Follow up with Alice',
      task_description: 'Reply when Alice emails about the project status.',
      source_type: 'triggered',
      execution_mode: 'offline',
      state: 'running',
      source_medium: 'email',
      source_contact_id: '1',
      source_contact_display_name: 'Alice Owner',
      started_at: '2025-06-03T09:20:00Z',
      job_name: 'droid-offline-9002',
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

  // Tasks is now a dropdown trigger: click opens the sub-tab menu,
  // picking a sub-tab switches the slot to Tasks + that sub-tab.
  const tasksTab = page.getByTestId('right-pane-tab-tasks');
  await expect(tasksTab).toBeVisible({ timeout: 5_000 });
  await tasksTab.click();
  await page.getByTestId('right-pane-tab-tasks-menu-tasks').click();
  await page.waitForTimeout(1_500);
}

/**
 * Switch the active Tasks sub-tab via the right-pane tab strip
 * dropdown. The in-pane footer Tasks/Activity row was removed once the
 * dropdown became the single source of truth for sub-tab navigation,
 * so existing test logic that used to click `tasks-view-{view}` directly
 * routes through this helper instead.
 */
async function switchTasksView(page: import('@playwright/test').Page, view: 'tasks' | 'activity') {
  await page.getByTestId('right-pane-tab-tasks').click();
  await page.getByTestId(`right-pane-tab-tasks-menu-${view}`).click();
}

// ===========================================================================
// Tab Visibility
// ===========================================================================

test('Tasks tab is visible when an assistant is selected', async ({ authedPage: page }) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const listItem = page.getByTestId(`assistant-list-item-${emptyAssistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();
  await page.waitForTimeout(1_500);

  const tasksTab = page.getByTestId('right-pane-tab-tasks');
  await expect(tasksTab).toBeVisible({ timeout: 5_000 });
});

test('Tasks tab exposes Tasks and Activity sub-tabs in the dropdown', async ({
  authedPage: page,
}) => {
  await selectAssistantAndOpenTasks(page, emptyAssistant.agentId);

  const tasksTab = page.getByTestId('right-pane-tab-tasks');
  await expect(tasksTab).toHaveAttribute('data-state', 'active');

  // Sub-tab navigation lives in the tab strip dropdown now; open it
  // and assert the expected sub-tabs are present.
  await tasksTab.click();
  await expect(page.getByTestId('right-pane-tab-tasks-menu-tasks')).toBeVisible({ timeout: 3_000 });
  await expect(page.getByTestId('right-pane-tab-tasks-menu-activity')).toBeVisible({
    timeout: 3_000,
  });
});

// ===========================================================================
// Empty States
// ===========================================================================

test('Tasks tab shows empty state when assistant has no tasks', async ({ authedPage: page }) => {
  await selectAssistantAndOpenTasks(page, emptyAssistant.agentId);

  await expect(page.getByText('No tasks found')).toBeVisible({ timeout: 10_000 });
});

test('Activity view shows empty placeholder when no activity', async ({ authedPage: page }) => {
  await selectAssistantAndOpenTasks(page, emptyAssistant.agentId);

  await switchTasksView(page, 'activity');
  await page.waitForTimeout(500);

  await expect(page.getByText('No activity found')).toBeVisible({ timeout: 5_000 });
});

// ===========================================================================
// Seeded Data — Tasks View
// ===========================================================================

test('displays seeded tasks with correct status badges and descriptions', async ({
  authedPage: page,
}) => {
  await ensureSeeded();
  await selectAssistantAndOpenTasks(page, dataAssistant.agentId);

  // The Tasks tab chip now in-place displays the active sub-tab name,
  // so the previous `data-active` assertion on the footer button is
  // expressed here as a label check on the main tab.
  await expect(page.getByTestId('right-pane-tab-tasks')).toContainText('Tasks');
  const table = page.getByTestId('tasks-table-tasks');
  await expect(table).toBeVisible({ timeout: 10_000 });

  const scheduledRow = table.locator('[data-testid="memory-table-row"]', {
    hasText: 'Send report',
  });
  const triggeredRow = table.locator('[data-testid="memory-table-row"]', {
    hasText: 'Escalate security emails',
  });
  const offlineRow = table.locator('[data-testid="memory-table-row"]', {
    hasText: 'Follow up with Alice',
  });

  await expect(scheduledRow).toBeVisible({ timeout: 5_000 });
  await expect(triggeredRow).toBeVisible({ timeout: 5_000 });
  await expect(offlineRow).toBeVisible({ timeout: 5_000 });

  await expect(scheduledRow).toContainText('Scheduled');
  await expect(scheduledRow).toContainText('Recurring');
  await expect(triggeredRow).toContainText('Triggered');
  await expect(triggeredRow).toContainText('Recurring');
  await expect(offlineRow).toContainText('Offline');
  await expect(offlineRow).toContainText('One-time');
  await expect(triggeredRow).toContainText('Ready');

  await expect(table.locator('text=Compile and send the weekly report to Alice.')).toBeVisible({
    timeout: 5_000,
  });
  await expect(table.getByText(/^Manual$/)).not.toBeVisible();
  await expect(table.locator('text=/Task #|Entrypoint|Priority/')).not.toBeVisible();
});

// ===========================================================================
// Seeded Data — Activity View
// ===========================================================================

test('Activity view shows task runs with correct state and sources', async ({
  authedPage: page,
}) => {
  await ensureSeeded();
  await selectAssistantAndOpenTasks(page, dataAssistant.agentId);

  await switchTasksView(page, 'activity');
  await page.waitForTimeout(500);

  const activityTable = page.getByTestId('tasks-table-activity');
  await expect(activityTable).toBeVisible({ timeout: 10_000 });

  await expect(activityTable.locator('text=Follow up with Alice')).toBeVisible({ timeout: 5_000 });
  await expect(activityTable.locator('text=Triggered by Email')).toBeVisible({ timeout: 5_000 });
  await expect(activityTable.locator('text=Alice Owner')).toBeVisible({ timeout: 5_000 });
  await expect(activityTable.locator('text=On schedule')).toBeVisible({ timeout: 5_000 });
  await expect(activityTable.locator('text=Calendar')).toBeVisible({ timeout: 5_000 });
  await expect(activityTable.getByText(/^Running$/)).toBeVisible({ timeout: 5_000 });
  await expect(activityTable.getByText(/^Completed$/)).toBeVisible({ timeout: 5_000 });
  await expect(activityTable.locator('text=/Run #|Job /')).not.toBeVisible();
});

// ===========================================================================
// Status Badge Tooltips
// ===========================================================================

test('status badges show descriptive tooltips on hover', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenTasks(page, dataAssistant.agentId);

  const tasksTable = page.getByTestId('tasks-table-tasks');
  await expect(tasksTable).toBeVisible({ timeout: 10_000 });

  await tasksTable
    .getByText(/^Ready$/)
    .first()
    .hover();
  await expect(page.getByRole('tooltip')).toContainText(
    'Is armed and waiting for a matching event to happen.'
  );
});

test('activity Running badge shows tooltip', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenTasks(page, dataAssistant.agentId);

  await switchTasksView(page, 'activity');
  await page.waitForTimeout(500);

  const activityTable = page.getByTestId('tasks-table-activity');
  await expect(activityTable).toBeVisible({ timeout: 10_000 });

  await activityTable.getByText(/^Running$/).hover();
  await expect(page.getByRole('tooltip')).toContainText('Is actively executing right now.');
});

// ===========================================================================
// Running Task Indicators
// ===========================================================================

test('Working indicator appears in header when tasks are running', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenTasks(page, dataAssistant.agentId);

  const snapshotStatus = page.getByTestId('tasks-snapshot-status');
  await expect(snapshotStatus).toBeVisible({ timeout: 5_000 });
  await expect(snapshotStatus).toContainText('Working');
  await expect(page.getByTestId('tasks-snapshot-working-indicator')).toBeVisible({
    timeout: 5_000,
  });
});

test('running activity rows have visual emphasis', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenTasks(page, dataAssistant.agentId);

  await switchTasksView(page, 'activity');
  await page.waitForTimeout(500);

  const activityTable = page.getByTestId('tasks-table-activity');
  await expect(activityTable).toBeVisible({ timeout: 10_000 });

  await expect(activityTable.getByTestId('memory-running-state-indicator')).toBeVisible({
    timeout: 5_000,
  });
  await expect(
    activityTable.locator('[data-testid="memory-table-row"][data-row-emphasis="running"]')
  ).toBeVisible({ timeout: 5_000 });
  await expect(activityTable.getByTestId('memory-running-row-accent')).toBeVisible({
    timeout: 5_000,
  });
});

// ===========================================================================
// Refresh
// ===========================================================================

test('refresh updates tasks and activity together', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenTasks(page, dataAssistant.agentId);

  await switchTasksView(page, 'activity');
  await page.waitForTimeout(500);

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
  await seedTaskRuns(user.apiKey, user.id, dataAssistant.agentId, [
    {
      run_id: taskId,
      run_key: `live:scheduled:run-${taskId}`,
      assistant_id: String(dataAssistant.agentId),
      task_id: taskId,
      task_name: `Follow up customer ${taskId}`,
      task_description: 'Reach out to the customer with the updated delivery timeline.',
      source_type: 'scheduled',
      execution_mode: 'live',
      state: 'completed',
      scheduled_for: '2025-06-04T12:30:00Z',
      started_at: '2025-06-04T12:30:05Z',
      completed_at: '2025-06-04T12:31:00Z',
      source_medium: 'calendar',
      job_name: `droid-live-${taskId}`,
    },
  ]);

  await page.getByTestId('tasks-refresh').click();

  // Sub-tab count badges were removed when the dropdown took over
  // sub-tab navigation; verify the refresh picked up the new rows via
  // the active table's footer row-count chip + the new activity row
  // becoming visible in the table.
  const tasksFooter = page.getByTestId('tasks-table-footer');
  await expect(tasksFooter).toContainText('4 of 4', { timeout: 10_000 });

  await switchTasksView(page, 'activity');
  await expect(tasksFooter).toContainText('3 of 3', { timeout: 5_000 });
  await expect(
    page.getByTestId('tasks-table-activity').getByText(`Follow up customer ${taskId}`)
  ).toBeVisible({ timeout: 5_000 });
});

test('refresh preserves Working indicator when activity is filtered', async ({
  authedPage: page,
}) => {
  await ensureSeeded();
  await selectAssistantAndOpenTasks(page, dataAssistant.agentId);

  await switchTasksView(page, 'activity');
  await page.waitForTimeout(500);

  const searchInput = page.getByTestId('tasks-search');
  const footer = page.getByTestId('tasks-table-footer');
  const activityTable = page.getByTestId('tasks-table-activity');
  const snapshotStatus = page.getByTestId('tasks-snapshot-status');

  await expect(snapshotStatus).toContainText('Working');
  await expect(page.getByTestId('tasks-snapshot-working-indicator')).toBeVisible({
    timeout: 5_000,
  });

  await searchInput.fill('Send report');
  await searchInput.press('Enter');

  await expect(footer).toContainText('1 of 1', { timeout: 10_000 });
  await expect(activityTable.getByText('Send report')).toBeVisible({ timeout: 5_000 });

  await page.getByTestId('tasks-refresh').click();

  await expect(snapshotStatus).toContainText('Working', { timeout: 10_000 });
  await expect(page.getByTestId('tasks-snapshot-working-indicator')).toBeVisible({
    timeout: 5_000,
  });
});

// ===========================================================================
// Detail Panel
// ===========================================================================

test('task detail panel groups human-first task information', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenTasks(page, dataAssistant.agentId);

  await switchTasksView(page, 'activity');
  await page.waitForTimeout(500);

  const table = page.getByTestId('tasks-table-activity');
  await expect(table).toBeVisible({ timeout: 10_000 });

  const runRow = table.locator('[data-testid="memory-table-row"]', {
    hasText: 'Follow up with Alice',
  });
  await expect(runRow).toBeVisible({ timeout: 5_000 });
  await runRow.click();
  await page.waitForTimeout(500);

  const detail = page.getByTestId('memory-row-detail');
  await expect(detail).toBeVisible({ timeout: 5_000 });
  await expect(detail.getByText('What happened, why it started, and when it ran.')).toBeVisible({
    timeout: 3_000,
  });

  const fields = page.getByTestId('memory-row-detail-fields');
  await expect(fields.getByRole('heading', { name: 'Started by' })).toBeVisible({
    timeout: 3_000,
  });
  await expect(fields.getByRole('heading', { name: 'Timing' })).toBeVisible({ timeout: 3_000 });
  await expect(fields.getByText('Alice Owner')).toBeVisible({ timeout: 3_000 });
  await expect(fields.getByText('Reply when Alice emails about the project status.')).toBeVisible({
    timeout: 3_000,
  });
  await expect(detail.getByText('Identifiers & Debug')).not.toBeVisible();
  await expect(detail.getByText('Additional metadata')).not.toBeVisible();
});

test('task detail panel shows recurrence for recurring tasks', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenTasks(page, dataAssistant.agentId);

  const table = page.getByTestId('tasks-table-tasks');
  await expect(table).toBeVisible({ timeout: 10_000 });

  const scheduledRow = table.locator('[data-testid="memory-table-row"]', {
    hasText: 'Send report',
  });
  await expect(scheduledRow).toBeVisible({ timeout: 5_000 });
  await scheduledRow.click();
  await page.waitForTimeout(500);

  const detail = page.getByTestId('memory-row-detail');
  await expect(detail).toBeVisible({ timeout: 5_000 });

  const fields = page.getByTestId('memory-row-detail-fields');
  await expect(fields.getByText('Recurring')).toBeVisible({ timeout: 3_000 });
  await expect(fields.getByText('Every week on Mon')).toBeVisible({ timeout: 3_000 });
});

test('detail panel closes when clicking the close button', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenTasks(page, dataAssistant.agentId);

  const table = page.getByTestId('tasks-table-tasks');
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

  await expect(footer).toContainText('1 of 1', { timeout: 10_000 });
  const rows = page.getByTestId('memory-table-row');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Escalate');
});

test('clear button removes search filter', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenTasks(page, dataAssistant.agentId);

  const searchInput = page.getByTestId('tasks-search');
  const footer = page.getByTestId('tasks-table-footer');
  await expect(footer).toBeVisible({ timeout: 10_000 });

  await searchInput.fill('Escalate');
  await searchInput.press('Enter');
  await expect(footer).toContainText('1 of 1', { timeout: 10_000 });

  const clearBtn = page.getByTestId('tasks-search-clear');
  await expect(clearBtn).toBeVisible({ timeout: 3_000 });

  await clearBtn.click();
  await expect(footer).toContainText(/3 of 3/, { timeout: 10_000 });
  await expect(clearBtn).not.toBeVisible();
});

test('search with no results shows empty message', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenTasks(page, dataAssistant.agentId);

  const searchInput = page.getByTestId('tasks-search');
  await searchInput.fill('xyznonexistent');
  await searchInput.press('Enter');

  await expect(page.getByText('No results match your search')).toBeVisible({ timeout: 10_000 });
});

// ===========================================================================
// Sorting
// ===========================================================================

test('clicking a column header sorts data server-side', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenTasks(page, dataAssistant.agentId);

  const table = page.getByTestId('tasks-table-tasks');
  await expect(table).toBeVisible({ timeout: 10_000 });

  const statusHeader = table.locator('th', { hasText: 'Status' });
  await expect(statusHeader).toBeVisible({ timeout: 5_000 });

  await statusHeader.click();
  await page.waitForTimeout(2_000);
  const rows = table.locator('[data-testid="memory-table-row"]');
  await expect(rows.first()).toBeVisible({ timeout: 5_000 });

  await statusHeader.click();
  await page.waitForTimeout(2_000);
  await expect(rows.first()).toBeVisible({ timeout: 5_000 });

  await statusHeader.click();
  await page.waitForTimeout(2_000);
  await expect(rows.first()).toBeVisible({ timeout: 5_000 });
});

// ===========================================================================
// View Switching
// ===========================================================================

test('switching between Tasks and Activity views preserves data', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenTasks(page, dataAssistant.agentId);

  const tasksTable = page.getByTestId('tasks-table-tasks');
  await expect(tasksTable).toBeVisible({ timeout: 10_000 });
  await expect(tasksTable.locator('text=Send report')).toBeVisible({ timeout: 5_000 });

  await switchTasksView(page, 'activity');
  await page.waitForTimeout(500);
  const activityTable = page.getByTestId('tasks-table-activity');
  await expect(activityTable).toBeVisible({ timeout: 5_000 });
  await expect(activityTable.locator('text=Follow up with Alice')).toBeVisible({ timeout: 5_000 });

  await switchTasksView(page, 'tasks');
  await page.waitForTimeout(500);
  await expect(tasksTable).toBeVisible({ timeout: 5_000 });
  await expect(tasksTable.locator('text=Send report')).toBeVisible({ timeout: 3_000 });
});

test('active sub-tab is visually indicated by the Tasks tab chip label', async ({
  authedPage: page,
}) => {
  await ensureSeeded();
  await selectAssistantAndOpenTasks(page, dataAssistant.agentId);

  // The Tasks tab chip in-place displays the active sub-tab name now
  // that the footer Tasks/Activity row was removed.
  const tasksTabChip = page.getByTestId('right-pane-tab-tasks');
  await expect(tasksTabChip).toContainText('Tasks');

  await switchTasksView(page, 'activity');
  await page.waitForTimeout(500);

  await expect(tasksTabChip).toContainText('Activity');
});

// ===========================================================================
// Backend Data Verification
// ===========================================================================

test('Tasks tab data matches what was seeded via Orchestra API', async ({ authedPage: page }) => {
  await ensureSeeded();

  const tasksRes = await orchestraFetch(
    `/v0/logs?project_name=Assistants&context=${user.id}/${dataAssistant.agentId}/Tasks`,
    { method: 'GET' },
    user.apiKey
  );
  expect(tasksRes.ok).toBeTruthy();
  const tasksData = await tasksRes.json();
  const taskCount = tasksData.logs.length;
  expect(taskCount).toBeGreaterThanOrEqual(3);

  const runsRes = await orchestraFetch(
    `/v0/logs?project_name=Assistants&context=${user.id}/${dataAssistant.agentId}/Tasks/Runs`,
    { method: 'GET' },
    user.apiKey
  );
  expect(runsRes.ok).toBeTruthy();
  const runsData = await runsRes.json();
  const runCount = runsData.logs.length;
  expect(runCount).toBeGreaterThanOrEqual(2);

  await selectAssistantAndOpenTasks(page, dataAssistant.agentId);

  // The sub-tab count badges were removed when the dropdown took over
  // sub-tab navigation, so we verify the seeded counts via each
  // sub-tab's table footer row-count chip instead.
  const tasksFooter = page.getByTestId('tasks-table-footer');
  await expect(tasksFooter).toContainText(`${taskCount} of ${taskCount}`, { timeout: 10_000 });

  await switchTasksView(page, 'activity');
  await expect(tasksFooter).toContainText(`${runCount} of ${runCount}`, { timeout: 5_000 });
});
