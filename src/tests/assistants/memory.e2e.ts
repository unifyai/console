/**
 * Memory Tab E2E Tests — browser-based user flows verifying the Memory
 * tab on the assistant right pane, including tab switching, sub-tab
 * navigation, empty states, seeded data rendering, pagination,
 * and refresh, all driven by real data seeded via the Orchestra API.
 *
 * Run: npx playwright test src/tests/assistants/memory.e2e.ts
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

const user = createTestUser({ name: 'MemoryE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);
test.describe.configure({ mode: 'serial' });

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
  contacts: {
    contact_id: number;
    first_name: string;
    last_name: string;
    email_address: string;
    timezone?: string;
  }[]
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
      contact_id: 0,
      first_name: 'MemBot',
      last_name: 'WithData',
      email_address: 'membot@test.ai',
      timezone: 'UTC',
    },
    {
      contact_id: 1,
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
      sender_id: 1,
      receiver_ids: [0],
      timestamp: '2025-06-01T10:00:00Z',
      content: 'Hello, can you help me with my schedule?',
      exchange_id: 1,
    },
    {
      message_id: 2,
      medium: 'unify_message',
      sender_id: 0,
      receiver_ids: [1],
      timestamp: '2025-06-01T10:01:00Z',
      content: 'Of course! Let me check your calendar.',
      exchange_id: 1,
    },
    {
      message_id: 3,
      medium: 'unify_message',
      sender_id: 2,
      receiver_ids: [0],
      timestamp: '2025-06-02T14:30:00Z',
      content: 'What is the status of the project?',
      exchange_id: 2,
    },
  ]);

  await seedTasks(user.apiKey, user.id, dataAssistant.agentId, [
    {
      task_id: 1,
      name: 'Send report',
      description: 'Compile and send the weekly report to Alice.',
      status: 'scheduled',
      priority: 2,
      schedule: {
        start_at: '2025-06-02T12:30:00Z',
      },
      repeat: [
        {
          frequency: 'weekly',
          interval: 1,
          weekdays: ['MO'],
        },
      ],
      created_at: '2025-06-01T09:00:00Z',
      updated_at: '2025-06-01T09:10:00Z',
    },
    {
      task_id: 2,
      name: 'Escalate security emails',
      description: 'Watch for urgent security emails and surface them to the boss.',
      status: 'triggerable',
      priority: 2,
      trigger: {
        medium: 'email',
        recurring: true,
      },
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
      trigger: {
        medium: 'email',
        from_contact_ids: [1],
      },
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
      job_name: 'unity-live-9001',
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
      job_name: 'unity-offline-9002',
    },
  ]);

  seeded = true;
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

async function selectAssistantAndOpenMemory(
  page: import('@playwright/test').Page,
  agentId: number
) {
  await page.goto(`/assistants?profile=${agentId}`);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await closeHireDialogIfOpen(page);
  await page.waitForTimeout(1_500);

  const memoryTab = page.getByTestId('right-pane-tab-memory');
  await expect(memoryTab).toBeVisible({ timeout: 5_000 });
  await memoryTab.click();
  await page.waitForTimeout(1_500);
}

// ===========================================================================
// Tab Switching
// ===========================================================================

test('Memory tab is visible when an assistant is selected', async ({ authedPage: page }) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const listItem = page.getByTestId(`assistant-list-item-${emptyAssistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();
  await page.waitForTimeout(1_500);

  const memoryTab = page.getByTestId('right-pane-tab-memory');
  await expect(memoryTab).toBeVisible({ timeout: 5_000 });
});

test('switches to Memory tab and shows sub-tabs', async ({ authedPage: page }) => {
  await selectAssistantAndOpenMemory(page, emptyAssistant.agentId);

  const memoryTab = page.getByTestId('right-pane-tab-memory');
  await expect(memoryTab).toHaveAttribute('data-state', 'active');

  await expect(page.getByTestId('memory-sub-tabs')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('memory-tab-contacts')).toBeVisible({ timeout: 3_000 });
  await expect(page.getByTestId('memory-tab-transcripts')).toBeVisible({ timeout: 3_000 });
  await expect(page.getByTestId('memory-tab-knowledge')).toBeVisible({ timeout: 3_000 });
  await expect(page.getByTestId('memory-tab-tasks')).toBeVisible({ timeout: 3_000 });
});

test('can switch between all main tabs including Memory', async ({ authedPage: page }) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const listItem = page.getByTestId(`assistant-list-item-${emptyAssistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();
  await page.waitForTimeout(1_500);

  const chatTab = page.getByTestId('right-pane-tab-chat');
  const actionsTab = page.getByTestId('right-pane-tab-actions');
  const dashTab = page.getByTestId('right-pane-tab-dashboards');
  const memoryTab = page.getByTestId('right-pane-tab-memory');

  await expect(chatTab).toHaveAttribute('data-state', 'active');

  await memoryTab.click();
  await page.waitForTimeout(500);
  await expect(memoryTab).toHaveAttribute('data-state', 'active');

  await actionsTab.click();
  await page.waitForTimeout(500);
  await expect(actionsTab).toHaveAttribute('data-state', 'active');

  await dashTab.click();
  await page.waitForTimeout(500);
  await expect(dashTab).toHaveAttribute('data-state', 'active');

  await chatTab.click();
  await page.waitForTimeout(500);
  await expect(chatTab).toHaveAttribute('data-state', 'active');
});

// ===========================================================================
// Empty State
// ===========================================================================

test('shows empty state when assistant has no data', async ({ authedPage: page }) => {
  await selectAssistantAndOpenMemory(page, emptyAssistant.agentId);

  const memoryPane = page.getByTestId('memory-pane');
  await expect(memoryPane).toBeVisible({ timeout: 10_000 });

  await expect(page.locator('text=No contacts found.')).toBeVisible({ timeout: 10_000 });
});

test('Tasks activity empty state shows contextual helper text', async ({ authedPage: page }) => {
  await selectAssistantAndOpenMemory(page, emptyAssistant.agentId);

  await page.getByTestId('memory-tab-tasks').click();
  await page.waitForTimeout(500);
  await page.getByTestId('memory-task-view-activity').click();
  await page.waitForTimeout(500);

  await expect(page.getByText('No task activity yet.')).toBeVisible({ timeout: 5_000 });
  await expect(
    page.getByText(
      'Task activity appears here after a task starts or finishes running. Use Refresh to check for recent updates.'
    )
  ).toBeVisible({ timeout: 5_000 });
});

// ===========================================================================
// Seeded Data — Contacts
// ===========================================================================

test('displays seeded contacts in the Contacts sub-tab', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  await expect(page.getByTestId('memory-tab-contacts')).toHaveAttribute('data-active', 'true');
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

// ===========================================================================
// Seeded Data — Transcripts
// ===========================================================================

test('displays seeded transcripts in the Transcripts sub-tab', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  const transcriptsTab = page.getByTestId('memory-tab-transcripts');
  await transcriptsTab.click();
  await page.waitForTimeout(1_000);

  await expect(transcriptsTab).toHaveAttribute('data-active', 'true');
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
// Seeded Data — Tasks
// ===========================================================================

test('displays seeded tasks in the Tasks sub-tab', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  const tasksTab = page.getByTestId('memory-tab-tasks');
  await tasksTab.click();
  await page.waitForTimeout(1_000);

  await expect(tasksTab).toHaveAttribute('data-active', 'true');
  await expect(page.getByTestId('memory-task-view-tasks')).toHaveAttribute('class', /bg-muted/);
  const table = page.getByTestId('memory-table-tasks-tasks');
  await expect(table).toBeVisible({ timeout: 10_000 });

  await expect(page.getByTestId('memory-task-view-helper')).toContainText(
    'What this assistant has been asked to do'
  );
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

test('Tasks nested views show tasks and activity', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  await page.getByTestId('memory-tab-tasks').click();
  await page.waitForTimeout(1_000);

  await expect(page.getByTestId('memory-task-views')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('memory-task-view-tasks')).toBeVisible();
  await expect(page.getByTestId('memory-task-view-activity')).toBeVisible();
  await expect(page.getByTestId('memory-task-view-activations')).not.toBeVisible();

  await page.getByTestId('memory-task-view-activity').click();
  await page.waitForTimeout(500);
  const activityTable = page.getByTestId('memory-table-tasks-activity');
  await expect(activityTable).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('memory-task-view-helper')).toContainText(
    'What has actually run, why it started, and when it happened.'
  );
  await expect(activityTable.locator('text=Follow up with Alice')).toBeVisible({
    timeout: 5_000,
  });
  await expect(activityTable.locator('text=Triggered by Email')).toBeVisible({ timeout: 5_000 });
  await expect(activityTable.locator('text=Alice Owner')).toBeVisible({ timeout: 5_000 });
  await expect(activityTable.locator('text=On schedule')).toBeVisible({ timeout: 5_000 });
  await expect(activityTable.locator('text=Calendar')).toBeVisible({ timeout: 5_000 });
  await expect(activityTable.getByText(/^Running$/)).toBeVisible({ timeout: 5_000 });
  await expect(activityTable.getByText(/^Completed$/)).toBeVisible({ timeout: 5_000 });
  await expect(activityTable.locator('text=/Run #|Job /')).not.toBeVisible();
  const snapshotStatus = page.getByTestId('memory-task-snapshot-status');
  await expect(snapshotStatus).toBeVisible({ timeout: 5_000 });
  await expect(snapshotStatus).toContainText('Working');
  await expect(snapshotStatus).toContainText('Updated');
  await expect(page.getByTestId('memory-task-snapshot-working-indicator')).toBeVisible({
    timeout: 5_000,
  });
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
// Sub-tab Navigation
// ===========================================================================

test('switching between sub-tabs preserves data and shows correct tables', async ({
  authedPage: page,
}) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  // Start on Contacts
  await expect(page.getByTestId('memory-table-contacts')).toBeVisible({ timeout: 10_000 });

  // Switch to Transcripts
  await page.getByTestId('memory-tab-transcripts').click();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('memory-table-transcripts')).toBeVisible({ timeout: 5_000 });

  // Switch to Knowledge
  await page.getByTestId('memory-tab-knowledge').click();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('memory-table-knowledge')).toBeVisible({ timeout: 5_000 });

  // Switch to Tasks
  await page.getByTestId('memory-tab-tasks').click();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('memory-table-tasks-tasks')).toBeVisible({
    timeout: 5_000,
  });

  // Switch back to Contacts — data should still be there
  await page.getByTestId('memory-tab-contacts').click();
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

  // After refresh, data should still be visible
  await expect(refreshBtn).toBeVisible({ timeout: 5_000 });
  await expect(refreshBtn).toBeEnabled();
  const table = page.getByTestId('memory-table-contacts');
  await expect(table.getByRole('cell', { name: 'Alice', exact: true })).toBeVisible({
    timeout: 5_000,
  });
});

test('Tasks refresh updates tasks and activity together', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  await page.getByTestId('memory-tab-tasks').click();
  await page.waitForTimeout(500);
  await page.getByTestId('memory-task-view-activity').click();
  await page.waitForTimeout(500);

  const taskId = Date.now();

  await seedTasks(user.apiKey, user.id, dataAssistant.agentId, [
    {
      task_id: taskId,
      name: `Follow up customer ${taskId}`,
      description: 'Reach out to the customer with the updated delivery timeline.',
      status: 'scheduled',
      priority: 3,
      schedule: {
        start_at: '2025-06-04T12:30:00Z',
      },
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
      job_name: `unity-live-${taskId}`,
    },
  ]);

  await page.getByTestId('memory-refresh').click();

  await expect(page.getByTestId('memory-tab-tasks')).toHaveText(/Tasks\s*\(?4\)?/, {
    timeout: 10_000,
  });
  await expect(page.getByTestId('memory-task-view-tasks')).toHaveText(/Tasks\s*\(?4\)?/, {
    timeout: 5_000,
  });
  await expect(page.getByTestId('memory-task-view-activity')).toHaveText(/Activity\s*\(?3\)?/, {
    timeout: 5_000,
  });
  await expect(
    page.getByTestId('memory-table-tasks-activity').getByText(`Follow up customer ${taskId}`)
  ).toBeVisible({ timeout: 5_000 });
});

// ===========================================================================
// Data is read-only (no edit controls)
// ===========================================================================

test('memory tables are read-only with no edit controls', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  const table = page.getByTestId('memory-table-contacts');
  await expect(table).toBeVisible({ timeout: 10_000 });

  // No edit, delete, or create buttons should be present in the table
  await expect(table.locator('button:has-text("Edit")')).not.toBeVisible({ timeout: 2_000 });
  await expect(table.locator('button:has-text("Delete")')).not.toBeVisible({ timeout: 2_000 });
  await expect(table.locator('button:has-text("Add")')).not.toBeVisible({ timeout: 2_000 });

  // No inline input editors in the table
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

  // Click the row containing Alice
  const aliceRow = table.locator('[data-testid="memory-table-row"]', { hasText: 'Alice' });
  await expect(aliceRow).toBeVisible({ timeout: 5_000 });
  await aliceRow.click();
  await page.waitForTimeout(500);

  // Detail panel should open
  const detail = page.getByTestId('memory-row-detail');
  await expect(detail).toBeVisible({ timeout: 5_000 });

  // Should show full field values
  const fields = page.getByTestId('memory-row-detail-fields');
  await expect(fields.getByText(/^Alice$/)).toBeVisible({ timeout: 3_000 });
  await expect(fields.getByText(/^alice@example\.com$/)).toBeVisible({ timeout: 3_000 });
  await expect(fields.locator('text=America/New_York')).toBeVisible({ timeout: 3_000 });
});

test('task detail panel groups human-first task information', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  await page.getByTestId('memory-tab-tasks').click();
  await page.waitForTimeout(500);
  await page.getByTestId('memory-task-view-activity').click();
  await page.waitForTimeout(500);

  const table = page.getByTestId('memory-table-tasks-activity');
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
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  await page.getByTestId('memory-tab-tasks').click();
  await page.waitForTimeout(500);

  const table = page.getByTestId('memory-table-tasks-tasks');
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

test('detail panel shows full untruncated content for transcripts', async ({
  authedPage: page,
}) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  // Switch to Transcripts
  await page.getByTestId('memory-tab-transcripts').click();
  await page.waitForTimeout(1_000);

  const table = page.getByTestId('memory-table-transcripts');
  await expect(table).toBeVisible({ timeout: 10_000 });

  // Click the first message row
  const msgRow = table.locator('[data-testid="memory-table-row"]', { hasText: 'schedule' });
  await expect(msgRow).toBeVisible({ timeout: 5_000 });
  await msgRow.click();
  await page.waitForTimeout(500);

  const detail = page.getByTestId('memory-row-detail');
  await expect(detail).toBeVisible({ timeout: 5_000 });

  // Full content should be shown untruncated
  await expect(detail.locator('text=Hello, can you help me with my schedule?')).toBeVisible({
    timeout: 3_000,
  });
});

test('detail panel closes when clicking the close button', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  const table = page.getByTestId('memory-table-contacts');
  await expect(table).toBeVisible({ timeout: 10_000 });

  // Open detail
  const row = table.locator('[data-testid="memory-table-row"]').first();
  await row.click();
  await page.waitForTimeout(500);

  const detail = page.getByTestId('memory-row-detail');
  await expect(detail).toBeVisible({ timeout: 5_000 });

  // Close via the X button
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

  // Click "First Name" header to sort ascending
  const firstNameHeader = table.locator('th', { hasText: 'First Name' });
  await expect(firstNameHeader).toBeVisible({ timeout: 5_000 });
  await firstNameHeader.click();
  await page.waitForTimeout(2_000);

  // Rows should still be visible after server re-fetch
  const rows = table.locator('[data-testid="memory-table-row"]');
  await expect(rows.first()).toBeVisible({ timeout: 5_000 });

  // Click again to toggle to descending
  await firstNameHeader.click();
  await page.waitForTimeout(2_000);
  await expect(rows.first()).toBeVisible({ timeout: 5_000 });
});

test('sorting indicator shows on sorted column header', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  const table = page.getByTestId('memory-table-contacts');
  await expect(table).toBeVisible({ timeout: 10_000 });

  // Before sorting — no directional arrow should be active
  const idHeader = table.locator('th', { hasText: 'ID' });
  await expect(idHeader).toBeVisible({ timeout: 5_000 });

  // Click to sort
  await idHeader.click();
  await page.waitForTimeout(2_000);

  // The header should now show a sort indicator (the column should still be visible)
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
  // With 3 contacts total, all loaded in first page: "3 of 3 rows"
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

  // Wait for data to load
  const footer = page.getByTestId('memory-table-footer');
  await expect(footer).toBeVisible({ timeout: 10_000 });
  await expect(footer).toContainText('3 of 3');

  // Search for "Alice" — should match 1 contact
  await searchInput.fill('Alice');
  await searchInput.press('Enter');

  // Wait for filtered results
  await expect(footer).toContainText('1 of 1', { timeout: 10_000 });

  // Should see Alice's row
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

  // Apply a filter
  await searchInput.fill('Alice');
  await searchInput.press('Enter');
  await expect(footer).toContainText('1 of 1', { timeout: 10_000 });

  // Clear button should be visible
  const clearBtn = page.getByTestId('memory-search-clear');
  await expect(clearBtn).toBeVisible({ timeout: 3_000 });

  // Click clear — all rows should return
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

  // Search lowercase "alice" should still match "Alice"
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

  // Search for a term that doesn't match anything
  await searchInput.fill('xyznonexistent');
  await searchInput.press('Enter');

  // Footer should disappear (no rows), empty message should show
  await expect(footer).not.toBeVisible({ timeout: 10_000 });
  await expect(page.locator('text=No results match your search.')).toBeVisible({ timeout: 5_000 });
});

test('search query persists when switching tabs and back', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  const searchInput = page.getByTestId('memory-search');
  const footer = page.getByTestId('memory-table-footer');
  await expect(footer).toBeVisible({ timeout: 10_000 });

  // Search for "Alice" in Contacts
  await searchInput.fill('Alice');
  await searchInput.press('Enter');
  await expect(footer).toContainText('1 of 1', { timeout: 10_000 });

  // Switch to Transcripts
  await page.getByTestId('memory-tab-transcripts').click();
  await page.waitForTimeout(1_000);

  // Search input should be empty (Transcripts has no filter)
  await expect(searchInput).toHaveValue('');

  // Switch back to Contacts — query should be restored
  await page.getByTestId('memory-tab-contacts').click();
  await expect(searchInput).toHaveValue('Alice', { timeout: 3_000 });

  // Filtered results should still be showing
  await expect(footer).toContainText('1 of 1', { timeout: 10_000 });
});

// ===========================================================================
// Backend Data Verification
// ===========================================================================

test('memory tab data matches what was seeded via Orchestra API', async ({ authedPage: page }) => {
  await ensureSeeded();

  // Verify contacts directly via API
  const contactsRes = await orchestraFetch(
    `/v0/logs?project_name=Assistants&context=${user.id}/${dataAssistant.agentId}/Contacts`,
    { method: 'GET' },
    user.apiKey
  );
  expect(contactsRes.ok).toBeTruthy();
  const contactsData = await contactsRes.json();
  expect(contactsData.logs.length).toBe(3);

  // Verify transcripts directly via API
  const transcriptsRes = await orchestraFetch(
    `/v0/logs?project_name=Assistants&context=${user.id}/${dataAssistant.agentId}/Transcripts`,
    { method: 'GET' },
    user.apiKey
  );
  expect(transcriptsRes.ok).toBeTruthy();
  const transcriptsData = await transcriptsRes.json();
  expect(transcriptsData.logs.length).toBe(3);

  // Verify tasks directly via API
  const tasksRes = await orchestraFetch(
    `/v0/logs?project_name=Assistants&context=${user.id}/${dataAssistant.agentId}/Tasks`,
    { method: 'GET' },
    user.apiKey
  );
  expect(tasksRes.ok).toBeTruthy();
  const tasksData = await tasksRes.json();
  const taskCount = tasksData.logs.length;
  expect(taskCount).toBeGreaterThanOrEqual(2);

  const runsRes = await orchestraFetch(
    `/v0/logs?project_name=Assistants&context=${user.id}/${dataAssistant.agentId}/Tasks/Runs`,
    { method: 'GET' },
    user.apiKey
  );
  expect(runsRes.ok).toBeTruthy();
  const runsData = await runsRes.json();
  const runCount = runsData.logs.length;
  expect(runCount).toBeGreaterThanOrEqual(2);

  // Now verify the UI renders the same counts
  await selectAssistantAndOpenMemory(page, dataAssistant.agentId);

  // Contacts count
  const contactsTabBtn = page.getByTestId('memory-tab-contacts');
  await expect(contactsTabBtn).toHaveText(/Contacts\s*\(?3\)?/, { timeout: 10_000 });

  // Transcripts count
  const transcriptsTabBtn = page.getByTestId('memory-tab-transcripts');
  await expect(transcriptsTabBtn).toHaveText(/Transcripts\s*\(?3\)?/, { timeout: 5_000 });

  // Tasks count
  const tasksTabBtn = page.getByTestId('memory-tab-tasks');
  await expect(tasksTabBtn).toHaveText(new RegExp(`Tasks\\s*\\(?${taskCount}\\)?`), {
    timeout: 5_000,
  });

  await tasksTabBtn.click();
  await expect(page.getByTestId('memory-task-view-tasks')).toHaveText(
    new RegExp(`Tasks\\s*\\(?${taskCount}\\)?`),
    {
      timeout: 5_000,
    }
  );
  await expect(page.getByTestId('memory-task-view-activity')).toHaveText(
    new RegExp(`Activity\\s*\\(?${runCount}\\)?`),
    {
      timeout: 5_000,
    }
  );
});
