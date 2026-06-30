/**
 * Rail shell E2E — verifies the /assistants rail shell: the unity switcher
 * popover, Workspace/Brain section navigation, the net-new Brain placeholders,
 * the account menu, and collapse-to-dock persistence.
 *
 * Run: npx playwright test src/tests/assistants/shell.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  navigateToAssistants,
  closeHireDialogIfOpen,
  openUnitySwitcher,
  openRailSection,
  getCoordinatorAgentId,
  deferCoordinatorOnboarding,
  deleteAllAssistantsForUser,
  ensureProjectSync,
} from './helpers';

const user = createTestUser({ name: 'ShellE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(90_000);

test.beforeAll(async () => {
  const coordinatorId = getCoordinatorAgentId(user.id);
  if (coordinatorId !== null) {
    await deferCoordinatorOnboarding(user.apiKey, coordinatorId);
  }
});

test.afterAll(() => {
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

test('the rail renders with the brand and unity switcher', async ({ authedPage: page }) => {
  deleteAllAssistantsForUser(user.id);
  createAssistant({ userId: user.id, firstName: 'Rail', surname: 'Resident' });

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const rail = page.getByTestId('assistant-rail');
  await expect(rail).toBeVisible({ timeout: 15_000 });
  await expect(rail.getByText('Unify', { exact: true })).toBeVisible();
  await expect(page.getByTestId('rail-unity-switcher')).toBeVisible();
});

test('the unity switcher opens and selecting a unity drives the section host', async ({
  authedPage: page,
}) => {
  deleteAllAssistantsForUser(user.id);
  const unity = createAssistant({ userId: user.id, firstName: 'Switchy', surname: 'Pick' });

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  await openUnitySwitcher(page);
  const row = page.getByTestId(`assistant-list-item-${unity.agentId}`);
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row).toContainText('Switchy');
  await row.click();

  // Popover dismisses on selection; the switcher card now faces the picked unity.
  await expect(page.getByTestId('rail-unity-switcher-popover')).toHaveCount(0, { timeout: 5_000 });
  await expect(page.getByTestId('rail-unity-switcher')).toContainText('Switchy');
  // Default section is Chat.
  await expect(page.getByTestId('rail-section-chat')).toHaveAttribute('aria-current', 'page');
});

test('Workspace and Brain section nav switches the active view', async ({ authedPage: page }) => {
  deleteAllAssistantsForUser(user.id);
  const unity = createAssistant({ userId: user.id, firstName: 'Navvy', surname: 'Sections' });

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);
  await page.getByTestId(`assistant-list-item-${unity.agentId}`).click();
  await expect(page.getByTestId('rail-unity-switcher-popover')).toHaveCount(0, { timeout: 5_000 });

  await openRailSection(page, 'tasks');
  await expect(page.getByTestId('rail-section-tasks')).toHaveAttribute('aria-current', 'page');

  // The Data Brain section is still a placeholder and renders "coming soon".
  await openRailSection(page, 'data');
  await expect(page.getByTestId('rail-section-data')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('Coming soon')).toBeVisible({ timeout: 5_000 });
});

test('the account menu exposes workspace and sign out', async ({ authedPage: page }) => {
  deleteAllAssistantsForUser(user.id);
  createAssistant({ userId: user.id, firstName: 'Acct', surname: 'Menu' });

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  await page.getByTestId('rail-account-trigger').click();
  const menu = page.getByTestId('rail-account-menu');
  await expect(menu).toBeVisible({ timeout: 5_000 });
  await expect(menu.getByText('Sign out')).toBeVisible();
});

test('collapsing the rail persists across reloads', async ({ authedPage: page }) => {
  deleteAllAssistantsForUser(user.id);
  createAssistant({ userId: user.id, firstName: 'Dock', surname: 'Sticky' });

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const rail = page.getByTestId('assistant-rail');
  await expect(rail).toBeVisible({ timeout: 15_000 });
  const expandedWidth = (await rail.boundingBox())?.width ?? 0;
  expect(expandedWidth).toBeGreaterThan(200);

  await page.getByTestId('rail-collapse-toggle').click();
  await expect.poll(async () => (await rail.boundingBox())?.width ?? 0).toBeLessThan(120);

  await page.reload();
  await closeHireDialogIfOpen(page);
  const railAfter = page.getByTestId('assistant-rail');
  await expect(railAfter).toBeVisible({ timeout: 15_000 });
  expect((await railAfter.boundingBox())?.width ?? 999).toBeLessThan(120);
});
