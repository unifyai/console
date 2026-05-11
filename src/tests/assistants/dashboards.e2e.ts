/**
 * Dashboards Pane E2E Tests — browser-based user flows verifying the
 * Dashboards tab on the assistant right pane, including tab switching,
 * empty state, dashboard selector, summary card, refresh, and
 * collapse/expand, all driven by real data seeded via the Orchestra API.
 *
 * Replaces: src/tests/_dashboards/behavior/dashboardsPane.browser.test.tsx
 *
 * Run: npx playwright test src/tests/assistants/dashboards.e2e.ts
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

const user = createTestUser({ name: 'DashPaneE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

// Two assistants: one stays empty (no dashboard data), one gets seeded
const emptyAssistant = createAssistant({
  userId: user.id,
  firstName: 'EmptyBot',
  surname: 'NoDash',
});

const dashAssistant = createAssistant({
  userId: user.id,
  firstName: 'DashBot',
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

async function seedDashboardLayout(
  apiKey: string,
  userId: string,
  assistantId: number,
  layout: {
    token: string;
    title: string;
    description?: string | null;
    tile_count: number;
    layout: object[];
  }
) {
  const res = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: `${userId}/${assistantId}/Dashboards/Layouts`,
        entries: [
          {
            token: layout.token,
            title: layout.title,
            description: layout.description ?? null,
            tile_count: layout.tile_count,
            layout: JSON.stringify(layout.layout),
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-05T00:00:00Z',
          },
        ],
      }),
    },
    apiKey
  );
  if (!res.ok) throw new Error(`Failed to seed layout: ${res.status} ${await res.text()}`);
}

async function seedTile(
  apiKey: string,
  userId: string,
  assistantId: number,
  tile: {
    token: string;
    title: string;
    description?: string | null;
    html_content: string;
    has_data_bindings?: boolean;
  }
) {
  const res = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: `${userId}/${assistantId}/Dashboards/Tiles`,
        entries: [
          {
            token: tile.token,
            title: tile.title,
            description: tile.description ?? null,
            html_content: tile.html_content,
            has_data_bindings: tile.has_data_bindings ?? false,
            data_binding_contexts: null,
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-02T00:00:00Z',
          },
        ],
      }),
    },
    apiKey
  );
  if (!res.ok) throw new Error(`Failed to seed tile: ${res.status} ${await res.text()}`);
}

/* eslint-enable @typescript-eslint/naming-convention */

// Seed dashAssistant with a dashboard + tiles once before all tests
const TILE_A_TOKEN = `tile-aaa-${Date.now()}`;
const TILE_B_TOKEN = `tile-bbb-${Date.now()}`;
const STANDALONE_TOKEN = `tile-standalone-${Date.now()}`;
const DASH_TOKEN = `dash-001-${Date.now()}`;

let seeded = false;
async function ensureSeeded() {
  if (seeded) return;

  await seedTile(user.apiKey, user.id, dashAssistant.agentId, {
    token: TILE_A_TOKEN,
    title: 'Revenue Chart',
    description: 'Monthly revenue',
    html_content: '<html><body><p>Revenue</p></body></html>',
  });

  await seedTile(user.apiKey, user.id, dashAssistant.agentId, {
    token: TILE_B_TOKEN,
    title: 'User Growth',
    description: null,
    html_content: '<html><body><p>Growth</p></body></html>',
    has_data_bindings: true,
  });

  await seedTile(user.apiKey, user.id, dashAssistant.agentId, {
    token: STANDALONE_TOKEN,
    title: 'Standalone Metric',
    description: 'Not in any dashboard',
    html_content: '<html><body><p>Standalone</p></body></html>',
  });

  await seedDashboardLayout(user.apiKey, user.id, dashAssistant.agentId, {
    token: DASH_TOKEN,
    title: 'Main Dashboard',
    description: 'Primary metrics',
    tile_count: 2,
    layout: [
      { tileToken: TILE_A_TOKEN, x: 0, y: 0, w: 6, h: 3 },
      { tileToken: TILE_B_TOKEN, x: 6, y: 0, w: 6, h: 3 },
    ],
  });

  seeded = true;
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

async function selectAssistantAndOpenDashboards(
  page: import('@playwright/test').Page,
  agentId: number
) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const listItem = page.getByTestId(`assistant-list-item-${agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();
  await page.waitForTimeout(1_500);

  const dashTab = page.getByTestId('right-pane-tab-dashboards');
  await expect(dashTab).toBeVisible({ timeout: 5_000 });
  await dashTab.click();
  await page.waitForTimeout(1_000);
}

// ===========================================================================
// Tab Switching
// ===========================================================================

test('defaults to the Chat tab when an assistant is selected', async ({ authedPage: page }) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const listItem = page.getByTestId(`assistant-list-item-${emptyAssistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();
  await page.waitForTimeout(1_500);

  const chatTab = page.getByTestId('right-pane-tab-chat');
  await expect(chatTab).toBeVisible({ timeout: 5_000 });
  await expect(chatTab).toHaveAttribute('data-state', 'active');
});

test('switches between Chat, Actions drawer, Dashboards, and Memory', async ({
  authedPage: page,
}) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const listItem = page.getByTestId(`assistant-list-item-${emptyAssistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();
  await page.waitForTimeout(1_500);

  const chatTab = page.getByTestId('right-pane-tab-chat');
  await expect(chatTab).toHaveAttribute('data-state', 'active');

  // Actions are reachable via their own right-pane tab.
  const actionsTab = page.getByTestId('right-pane-tab-actions');
  await expect(actionsTab).toBeVisible({ timeout: 5_000 });
  await actionsTab.click();
  await expect(actionsTab).toHaveAttribute('data-state', 'active');
  await page.waitForTimeout(300);

  const dashTab = page.getByTestId('right-pane-tab-dashboards');
  await dashTab.click();
  await page.waitForTimeout(500);
  await expect(dashTab).toHaveAttribute('data-state', 'active');

  // Memory is a dropdown trigger — click + pick a sub-tab to switch.
  const memoryTab = page.getByTestId('right-pane-tab-memory');
  await memoryTab.click();
  await page.getByTestId('right-pane-tab-memory-menu-contacts').click();
  await page.waitForTimeout(500);
  await expect(memoryTab).toHaveAttribute('data-state', 'active');

  await chatTab.click();
  await page.waitForTimeout(500);
  await expect(chatTab).toHaveAttribute('data-state', 'active');
});

// ===========================================================================
// Split-pane layout
// ===========================================================================

test('split tabs lets the user view two right-pane tabs side by side and close either side', async ({
  authedPage: page,
}) => {
  // The split affordance turns the right pane into two independent
  // tab strips ("primary" + "secondary"). Closing the *primary* in
  // split mode promotes the secondary into the primary slot, so a
  // user who split off Actions to focus on it can shed the chat side
  // without losing their Actions context. This is non-obvious behavior
  // worth pinning explicitly.
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const listItem = page.getByTestId(`assistant-list-item-${emptyAssistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();
  await page.waitForTimeout(1_500);

  const primaryChatTab = page.getByTestId('right-pane-tab-chat');
  await expect(primaryChatTab).toHaveAttribute('data-state', 'active');

  // Splitter and secondary-side tabs must not exist before the user
  // actually splits — otherwise the single-pane layout would have a
  // dead vertical line.
  await expect(page.getByTestId('right-pane-splitter')).toHaveCount(0);
  await expect(page.getByTestId('right-pane-secondary-tab-chat')).toHaveCount(0);

  await page.getByTestId('right-pane-split-button').click();

  // Now we expect a fully-formed split: a splitter, two tab strips,
  // and a close button on each pane (split mode is the only time the
  // primary becomes closable).
  await expect(page.getByTestId('right-pane-splitter')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('right-pane-secondary-tab-actions')).toBeVisible();
  await expect(page.getByTestId('right-pane-close-primary')).toBeVisible();
  await expect(page.getByTestId('right-pane-close-secondary')).toBeVisible();

  // Confirm both panes can be driven independently — switch the
  // secondary to Memory while leaving the primary on Chat. Memory is
  // a dropdown trigger, so opening it and picking a sub-tab is what
  // actually performs the switch.
  await page.getByTestId('right-pane-secondary-tab-memory').click();
  await page.getByTestId('right-pane-secondary-tab-memory-menu-contacts').click();
  await expect(page.getByTestId('right-pane-secondary-tab-memory')).toHaveAttribute(
    'data-state',
    'active'
  );
  await expect(primaryChatTab).toHaveAttribute('data-state', 'active');

  // Closing the *primary* should promote whatever was in the secondary
  // (Memory) into the primary slot, then collapse out of split mode.
  await page.getByTestId('right-pane-close-primary').click();
  await expect(page.getByTestId('right-pane-splitter')).toHaveCount(0, { timeout: 5_000 });
  await expect(page.getByTestId('right-pane-tab-memory')).toHaveAttribute('data-state', 'active');

  // Re-split, then close the secondary side. Should also collapse,
  // and the primary tab (Memory) should remain active.
  await page.getByTestId('right-pane-split-button').click();
  await expect(page.getByTestId('right-pane-splitter')).toBeVisible({ timeout: 5_000 });
  await page.getByTestId('right-pane-close-secondary').click();
  await expect(page.getByTestId('right-pane-splitter')).toHaveCount(0, { timeout: 5_000 });
  await expect(page.getByTestId('right-pane-tab-memory')).toHaveAttribute('data-state', 'active');
});

// ===========================================================================
// Empty State
// ===========================================================================

test('shows empty state when assistant has no dashboards or tiles', async ({
  authedPage: page,
}) => {
  await selectAssistantAndOpenDashboards(page, emptyAssistant.agentId);

  await expect(page.locator('text=No dashboards found')).toBeVisible({ timeout: 10_000 });
});

test('no tabs visible and shows placeholder when no assistant is selected', async ({
  authedPage: page,
}) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await page.waitForTimeout(1_000);

  await expect(page.getByTestId('right-pane-tab-chat')).not.toBeVisible({ timeout: 3_000 });
  await expect(page.getByTestId('right-pane-tab-dashboards')).not.toBeVisible({ timeout: 3_000 });
  await expect(page.getByTestId('right-pane-tab-memory')).not.toBeVisible({ timeout: 3_000 });
  await expect(page.getByTestId('right-pane-tab-actions')).not.toBeVisible({ timeout: 3_000 });
  await expect(page.locator('text=Select an assistant to watch them work')).toBeVisible({
    timeout: 5_000,
  });
});

// ===========================================================================
// With Seeded Dashboard Data
// ===========================================================================

test('renders searchable combobox selector when dashboards exist', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenDashboards(page, dashAssistant.agentId);

  const selector = page.getByTestId('dashboard-selector');
  await expect(selector).toBeVisible({ timeout: 10_000 });

  await selector.click();
  await page.waitForTimeout(500);

  await expect(page.locator('input[placeholder="Search dashboards & tiles…"]')).toBeVisible({
    timeout: 5_000,
  });
});

test('renders dashboard summary card with metadata and action buttons', async ({
  authedPage: page,
}) => {
  await ensureSeeded();
  await selectAssistantAndOpenDashboards(page, dashAssistant.agentId);

  const summarySection = page.getByTestId('dashboard-summary-section');
  await expect(summarySection).toBeVisible({ timeout: 10_000 });

  const summaryCard = page.getByTestId('dashboard-summary-card');
  await expect(summaryCard).toBeVisible({ timeout: 5_000 });

  await expect(summaryCard.locator('text=Primary metrics')).toBeVisible({ timeout: 5_000 });
  await expect(summaryCard.locator('text=2 tiles')).toBeVisible({ timeout: 5_000 });

  await expect(page.getByTestId('dashboard-open-tab')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('dashboard-download-zip')).toBeVisible({ timeout: 5_000 });
});

test('shows refresh button in header that triggers refetch', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenDashboards(page, dashAssistant.agentId);

  const refreshBtn = page.getByTestId('dashboard-header-refresh');
  await expect(refreshBtn).toBeVisible({ timeout: 10_000 });

  // Clicking refresh should not error — the button should remain visible
  await refreshBtn.click();
  await page.waitForTimeout(1_500);
  await expect(refreshBtn).toBeVisible({ timeout: 5_000 });
});

test('shows collapse all / expand all button in header', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenDashboards(page, dashAssistant.agentId);

  const collapseBtn = page.getByTestId('dashboard-collapse-all');
  await expect(collapseBtn).toBeVisible({ timeout: 10_000 });

  // Should say "Collapse All" initially
  await expect(collapseBtn.locator('text=Collapse All')).toBeVisible({ timeout: 3_000 });

  await collapseBtn.click();
  await page.waitForTimeout(500);

  // After clicking, should say "Expand All"
  await expect(collapseBtn.locator('text=Expand All')).toBeVisible({ timeout: 5_000 });

  await collapseBtn.click();
  await page.waitForTimeout(500);

  await expect(collapseBtn.locator('text=Collapse All')).toBeVisible({ timeout: 5_000 });
});

test('selector shows standalone tile when selected', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenDashboards(page, dashAssistant.agentId);

  const selector = page.getByTestId('dashboard-selector');
  await expect(selector).toBeVisible({ timeout: 10_000 });
  await selector.click();
  await page.waitForTimeout(500);

  // The standalone tile should appear under "Tiles" group
  const standaloneTileOption = page.locator('[cmdk-item]').filter({ hasText: 'Standalone Metric' });
  await expect(standaloneTileOption).toBeVisible({ timeout: 5_000 });
  await standaloneTileOption.click();
  await page.waitForTimeout(1_000);

  // Standalone tile section should appear
  const standaloneSection = page.getByTestId('standalone-tile-section');
  await expect(standaloneSection).toBeVisible({ timeout: 10_000 });
  await expect(standaloneSection.locator('text=Standalone Metric')).toBeVisible({ timeout: 5_000 });
});

test('footer shows dashboard and tile counts', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenDashboards(page, dashAssistant.agentId);

  const footer = page.getByTestId('dashboards-footer');
  await expect(footer).toBeVisible({ timeout: 10_000 });

  // Should show "1 dashboard, 3 tiles"
  await expect(footer.locator('text=/1 dashboard/')).toBeVisible({ timeout: 5_000 });
  await expect(footer.locator('text=/3 tiles/')).toBeVisible({ timeout: 5_000 });
});
