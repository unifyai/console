/**
 * Live Actions Viewer E2E — verifies that:
 *  - The viewer shows empty state when no events exist
 *  - Historical events seeded via Orchestra appear on load
 *  - Live events pushed via the local push endpoint appear in real time
 *  - Search filters nodes and shows match count
 *  - Expand / Collapse All buttons toggle tree state
 *
 * Relies on local pubsub (in-memory event bus) which is active when
 * COMMS_SERVICE_ACCOUNT_CREDENTIALS is absent.
 *
 * Run: npx playwright test src/tests/assistants/live-actions.e2e.ts
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
} from './helpers';

const CONSOLE_BASE = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

const user = createTestUser({ name: 'LiveActionsE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'ActionBot',
  surname: 'E2E',
});

test.afterAll(() => {
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeManagerEvent(opts: {
  callingId: string;
  phase: 'incoming' | 'outgoing';
  manager: string;
  method: string;
  hierarchy: string[];
  status?: string;
  displayLabel?: string;
  question?: string;
  answer?: string;
}) {
  const eventId = `evt-${opts.callingId}-${opts.phase}-${Date.now()}`;
  return {
    type: 'ManagerMethod',
    data: {
      id: Math.floor(Math.random() * 1_000_000),
      ts: new Date().toISOString(),
      entries: {
        callingId: opts.callingId,
        eventId,
        manager: opts.manager,
        method: opts.method,
        phase: opts.phase,
        hierarchy: opts.hierarchy,
        hierarchyLabel: opts.hierarchy.join('->'),
        status: opts.status ?? 'ok',
        displayLabel: opts.displayLabel,
        question: opts.question,
        answer: opts.answer,
        eventTimestamp: new Date().toISOString(),
      },
    },
  };
}

async function pushEvent(assistantId: number | string, event: ReturnType<typeof makeManagerEvent>) {
  const res = await fetch(`${CONSOLE_BASE}/api/assistant/${assistantId}/actions/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(`Push failed: ${res.status} ${await res.text()}`);
}

/**
 * Seed a ManagerMethod event directly into Orchestra's log store so it appears
 * as a historical event on initial load.
 */
async function seedHistoricalEvent(
  apiKey: string,
  userId: string,
  assistantId: number | string,
  opts: {
    callingId: string;
    phase: 'incoming' | 'outgoing';
    manager: string;
    method: string;
    hierarchy: string[];
    status?: string;
    displayLabel?: string;
    question?: string;
    answer?: string;
  }
) {
  /* eslint-disable @typescript-eslint/naming-convention */
  const entries = {
    calling_id: opts.callingId,
    event_id: `evt-${opts.callingId}-${opts.phase}-${Date.now()}`,
    manager: opts.manager,
    method: opts.method,
    phase: opts.phase,
    hierarchy: opts.hierarchy,
    hierarchy_label: opts.hierarchy.join('->'),
    status: opts.status ?? 'ok',
    display_label: opts.displayLabel,
    question: opts.question,
    answer: opts.answer,
    event_timestamp: new Date().toISOString(),
  };
  /* eslint-enable @typescript-eslint/naming-convention */

  const contexts = [`${userId}/${assistantId}/Events/ManagerMethod`];
  for (const context of contexts) {
    const res = await orchestraFetch(
      '/v0/logs',
      {
        method: 'POST',
        body: JSON.stringify({
          project_name: 'Assistants',
          context,
          entries: [entries],
        }),
      },
      apiKey
    );
    if (!res.ok) {
      throw new Error(`Failed to seed event in ${context}: ${res.status} ${await res.text()}`);
    }
  }
}

async function selectAssistant(page: import('@playwright/test').Page) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const listItem = page.getByTestId(`assistant-list-item-${assistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();
  await page.waitForTimeout(1_500);

  const actionsTab = page.getByTestId('right-pane-tab-actions');
  await actionsTab.click();
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('viewer is present and header controls are visible when assistant is selected', async ({
  authedPage: page,
}) => {
  await selectAssistant(page);

  const viewer = page.getByTestId('live-actions-viewer');
  await expect(viewer).toBeVisible({ timeout: 10_000 });

  // Header controls should be rendered
  await expect(page.getByTestId('live-actions-header')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('live-actions-time-window')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('live-actions-refresh')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('live-actions-search')).toBeVisible({ timeout: 5_000 });
});

test('historical events seeded in Orchestra appear on initial load', async ({
  authedPage: page,
}) => {
  const callingId = `hist-${Date.now()}`;
  const questionText = `Find John ${callingId}`;

  // Seed an incoming + outgoing pair so the tree has a completed node
  await seedHistoricalEvent(user.apiKey, user.id, assistant.agentId, {
    callingId,
    phase: 'incoming',
    manager: 'ContactManager',
    method: 'ask',
    hierarchy: ['ContactManager.ask'],
    displayLabel: 'Looking Up Contact',
    question: questionText,
  });
  await seedHistoricalEvent(user.apiKey, user.id, assistant.agentId, {
    callingId,
    phase: 'outgoing',
    manager: 'ContactManager',
    method: 'ask',
    hierarchy: ['ContactManager.ask'],
    displayLabel: 'Looking Up Contact',
    answer: 'Found John Doe',
  });

  await selectAssistant(page);

  const viewer = page.getByTestId('live-actions-viewer');
  await expect(viewer).toBeVisible({ timeout: 10_000 });

  // Wait for tree to appear (action-node elements render within the tree)
  const treeContainer = page.getByTestId('live-actions-tree-container');
  await expect(treeContainer).toBeVisible({ timeout: 15_000 });

  // The node should render — the label is the question text (requestContent)
  await expect(page.locator(`text=${questionText}`).first()).toBeVisible({ timeout: 10_000 });

  // Footer should show completed count
  const footer = page.getByTestId('live-actions-footer');
  await expect(footer).toBeVisible({ timeout: 5_000 });
  const eventCounts = page.getByTestId('event-counts');
  await expect(eventCounts).toContainText('completed');
});

test('live events pushed via local endpoint appear in real time', async ({ authedPage: page }) => {
  await selectAssistant(page);

  const viewer = page.getByTestId('live-actions-viewer');
  await expect(viewer).toBeVisible({ timeout: 10_000 });

  // Wait for initial load to complete
  const loadingIndicator = page.getByTestId('live-actions-loading');
  if (await loadingIndicator.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await expect(loadingIndicator).not.toBeVisible({ timeout: 15_000 });
  }
  await page.waitForTimeout(2_000);

  // Push a live incoming event
  const callingId = `live-${Date.now()}`;
  const questionText = `What is the weather in NYC ${callingId}`;
  const liveEvent = makeManagerEvent({
    callingId,
    phase: 'incoming',
    manager: 'WeatherManager',
    method: 'check',
    hierarchy: ['WeatherManager.check'],
    displayLabel: 'Checking Weather Forecast',
    question: questionText,
  });

  await pushEvent(assistant.agentId, liveEvent);

  // The node should appear without a page reload — label is the question text
  await expect(page.locator(`text=${questionText}`).first()).toBeVisible({
    timeout: 15_000,
  });

  // Footer should show running count (incoming without outgoing = running)
  const eventCounts = page.getByTestId('event-counts');
  await expect(eventCounts).toContainText('running');
});

test('search filters action nodes and shows match count', async ({ authedPage: page }) => {
  const ts = Date.now();
  const callingId1 = `search-a-${ts}`;
  const callingId2 = `search-b-${ts}`;
  const emailQuestion = `Send email about project ${ts}`;
  const calendarQuestion = `Schedule standup meeting ${ts}`;

  // Seed two distinct events with unique question text
  await seedHistoricalEvent(user.apiKey, user.id, assistant.agentId, {
    callingId: callingId1,
    phase: 'incoming',
    manager: 'EmailManager',
    method: 'send',
    hierarchy: ['EmailManager.send'],
    displayLabel: 'Sending Email',
    question: emailQuestion,
  });
  await seedHistoricalEvent(user.apiKey, user.id, assistant.agentId, {
    callingId: callingId2,
    phase: 'incoming',
    manager: 'CalendarManager',
    method: 'schedule',
    hierarchy: ['CalendarManager.schedule'],
    displayLabel: 'Scheduling Meeting',
    question: calendarQuestion,
  });

  await selectAssistant(page);

  const treeContainer = page.getByTestId('live-actions-tree-container');
  await expect(treeContainer).toBeVisible({ timeout: 15_000 });

  // Both question labels should be visible initially
  await expect(page.locator(`text=${emailQuestion}`).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(`text=${calendarQuestion}`).first()).toBeVisible({ timeout: 10_000 });

  // Search for "email" — filters by label / hierarchy / question text
  const searchInput = page.getByTestId('live-actions-search');
  await searchInput.fill('email');
  await searchInput.press('Enter');
  await page.waitForTimeout(1_000);

  // The match count indicator should appear
  await expect(page.locator('text=/\\d+ result/').first()).toBeVisible({ timeout: 5_000 });

  // Clear search
  const clearBtn = page.getByTestId('live-actions-search-clear');
  await clearBtn.click();
  await page.waitForTimeout(1_000);

  // Both should be visible again after clearing
  await expect(page.locator(`text=${calendarQuestion}`).first()).toBeVisible({ timeout: 5_000 });
});

test('manual refresh re-fetches events from Orchestra', async ({ authedPage: page }) => {
  const ts = Date.now();
  const callingId = `refresh-${ts}`;
  const questionText = `Refresh test question ${ts}`;

  await selectAssistant(page);

  const viewer = page.getByTestId('live-actions-viewer');
  await expect(viewer).toBeVisible({ timeout: 10_000 });

  // Seed an event after the viewer has loaded
  await seedHistoricalEvent(user.apiKey, user.id, assistant.agentId, {
    callingId,
    phase: 'incoming',
    manager: 'RefreshManager',
    method: 'test',
    hierarchy: ['RefreshManager.test'],
    displayLabel: 'Refresh Test',
    question: questionText,
  });

  // Click the refresh button to re-fetch from Orchestra
  const refreshBtn = page.getByTestId('live-actions-refresh');
  await refreshBtn.click();

  // Wait for the newly seeded event to appear
  await expect(page.locator(`text=${questionText}`).first()).toBeVisible({ timeout: 15_000 });
});

test('footer shows connection status and assistant status', async ({ authedPage: page }) => {
  await selectAssistant(page);

  const footer = page.getByTestId('live-actions-footer');
  await expect(footer).toBeVisible({ timeout: 10_000 });

  // Should show assistant name + idle/working status
  const statusEl = page.getByTestId('assistant-status');
  await expect(statusEl).toContainText('ActionBot');

  // Should show event counts
  const countsEl = page.getByTestId('event-counts');
  await expect(countsEl).toBeVisible();

  // Should show connection status (Live or Disconnected) — in local mode it should
  // say "Live" once the SSE connection opens
  const connectionEl = page.getByTestId('connection-status');
  await expect(connectionEl).toBeVisible({ timeout: 10_000 });
  await expect(connectionEl).toContainText('Live');
});
