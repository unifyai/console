/**
 * Provider Integrations E2E — mock-backed smoke test for the unified
 * connected-apps page. This intentionally uses the local mock flag so
 * visual review does not require Orchestra provider APIs, OAuth apps, or real
 * credentials.
 *
 * Run: npx playwright test src/tests/assistants/provider-integrations.e2e.ts
 */

import { expect, type Page } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  closeHireDialogIfOpen,
  deleteAllAssistantsForUser,
  ensureProjectSync,
} from './helpers';

const user = createTestUser({ name: 'ProviderIntegration', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'ProviderBot',
  surname: 'E2E',
});

test.afterAll(() => {
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

async function openMockIntegrationsTab(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('console:integrations:mock', 'true');
  });
  await page.goto(`/assistants?profile=${assistant.agentId}`);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await closeHireDialogIfOpen(page);
  await page.waitForTimeout(1_500);

  const tab = page.getByTestId('right-pane-tab-integrations');
  await expect(tab).toBeVisible({ timeout: 10_000 });
  await tab.click();

  const pane = page.getByTestId('integrations-pane');
  await expect(pane).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('integration-gallery')).toBeVisible({ timeout: 10_000 });
}

test('mock connected-apps page shows dynamic apps, permissions, tools, and connect flow', async ({
  authedPage: page,
}) => {
  await openMockIntegrationsTab(page);

  await expect(page.getByTestId('provider-integration-card-slack')).toBeVisible();
  await expect(page.getByTestId('provider-integration-card-clay')).toBeVisible();
  await expect(page.getByTestId('provider-integration-card-hubspot')).toBeVisible();
  await expect(page.getByTestId('integration-virtual-list')).toBeVisible();
  await page.getByTestId('integration-virtual-list').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event('scroll'));
  });

  await page.getByTestId('integration-card-primary-hubspot').click();
  await expect(page.getByTestId('provider-integration-detail-sheet')).toBeVisible();
  await expect(page.getByTestId('provider-permission-review')).toBeVisible();
  await expect(page.getByText('Available tools')).toBeVisible();
  await expect(page.getByText('HUBSPOT_SEARCH_CONTACTS')).toBeVisible();
  await expect(page.getByText('Static package')).toHaveCount(0);
  await expect(page.getByText('Overlay curated')).toHaveCount(0);
  await expect(page.getByTestId('integration-actor-visibility')).toHaveCount(0);

  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByTestId('provider-integration-detail-sheet')).toBeHidden({
    timeout: 5_000,
  });

  await page.getByTestId('integration-gallery-search').fill('Slack');
  await expect(page.getByTestId('provider-integration-card-slack')).toBeVisible();
  await page.getByTestId('integration-card-primary-slack').click();
  await expect(page.getByTestId('provider-integration-detail-sheet')).toBeVisible();
  await page.getByTestId('provider-integration-primary-action').click();
  await expect(page.getByText('Started Slack connection.')).toBeVisible({ timeout: 5_000 });
});
