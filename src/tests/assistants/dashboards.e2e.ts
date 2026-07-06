/**
 * Dashboards Pane E2E Tests — browser-based user flows verifying the
 * Dashboards tab on the assistant right pane, including empty state,
 * dashboard selector, summary card, and standalone tile selection,
 * all driven by real data seeded via the Orchestra API.
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
  selectAssistantInList,
  openRailSection,
} from './helpers';
import { tabSearchPlaceholder } from '@/constants/assistants/tabSearchPlaceholders';

const user = createTestUser({ name: 'DashPaneE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

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

async function selectAssistantAndOpenDashboards(
  page: import('@playwright/test').Page,
  agentId: number
) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  await selectAssistantInList(page, agentId);
  await page.waitForTimeout(1_500);

  await openRailSection(page, 'dashboards');
  await page.waitForTimeout(1_000);
}

test('shows empty state when assistant has no dashboards or tiles', async ({
  authedPage: page,
}) => {
  await selectAssistantAndOpenDashboards(page, emptyAssistant.agentId);

  await expect(page.getByText('No dashboards yet')).toBeVisible({ timeout: 10_000 });
});

test('renders searchable combobox selector when dashboards exist', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenDashboards(page, dashAssistant.agentId);

  const selector = page.getByTestId('dashboard-selector');
  await expect(selector).toBeVisible({ timeout: 10_000 });

  await expect(page.getByTestId('dashboards-search')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('dashboards-search')).toHaveAttribute(
    'placeholder',
    tabSearchPlaceholder('dashboards')
  );
});

test('renders dashboard summary card with metadata, actions, and footer counts', async ({
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
  await expect(page.getByTestId('dashboard-download')).toBeVisible({ timeout: 5_000 });

  const footer = page.getByTestId('dashboards-footer');
  await expect(footer).toBeVisible({ timeout: 10_000 });
  await expect(footer.locator('text=/1 dashboard/')).toBeVisible({ timeout: 5_000 });
  await expect(footer.locator('text=/3 tiles/')).toBeVisible({ timeout: 5_000 });
});

test('selector shows standalone tile when selected', async ({ authedPage: page }) => {
  await ensureSeeded();
  await selectAssistantAndOpenDashboards(page, dashAssistant.agentId);

  const selector = page.getByTestId('dashboard-selector');
  await expect(selector).toBeVisible({ timeout: 10_000 });
  await selector.click();
  await page.waitForTimeout(500);

  const standaloneTileOption = page.locator('[cmdk-item]').filter({ hasText: 'Standalone Metric' });
  await expect(standaloneTileOption).toBeVisible({ timeout: 5_000 });
  await standaloneTileOption.click();
  await page.waitForTimeout(1_000);

  const standaloneSection = page.getByTestId('standalone-tile-section');
  await expect(standaloneSection).toBeVisible({ timeout: 10_000 });
  await expect(standaloneSection.locator('text=Standalone Metric')).toBeVisible({ timeout: 5_000 });
});
