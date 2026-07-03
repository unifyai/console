/**
 * Rail shell E2E — verifies the /assistants rail shell: the unity switcher
 * popover, Workspace/Brain section navigation, the account menu, and
 * collapse-to-dock persistence.
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

const shellOpts = { userId: user.id, apiKey: user.apiKey };

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

test('the unity switcher opens and selecting a unity drives the section host @push @critical @area(assistants.core)', async ({
  authedPage: page,
}) => {
  deleteAllAssistantsForUser(user.id);
  const unity = createAssistant({ userId: user.id, firstName: 'Switchy', surname: 'Pick' });

  await navigateToAssistants(page, shellOpts);
  await closeHireDialogIfOpen(page);

  await openUnitySwitcher(page, shellOpts);
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

  await navigateToAssistants(page, shellOpts);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page, shellOpts);
  await page.getByTestId(`assistant-list-item-${unity.agentId}`).click();
  await expect(page.getByTestId('rail-unity-switcher-popover')).toHaveCount(0, { timeout: 5_000 });

  await openRailSection(page, 'tasks');
  await expect(page.getByTestId('rail-section-tasks')).toHaveAttribute('aria-current', 'page');

  await openRailSection(page, 'data');
  await expect(page.getByTestId('rail-section-data')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('data-pane')).toBeVisible({ timeout: 5_000 });
});

test('mobile viewport exposes rail navigation via the menu toggle', async ({
  authedPage: page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });

  deleteAllAssistantsForUser(user.id);
  createAssistant({ userId: user.id, firstName: 'Mobile', surname: 'Shell' });

  await navigateToAssistants(page, { ...shellOpts, skipRailCheck: true });
  await closeHireDialogIfOpen(page);

  await expect(page.getByTestId('rail-mobile-toggle')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('assistant-rail')).toHaveCount(0);

  await page.getByTestId('rail-mobile-toggle').click();
  const rail = page.getByTestId('assistant-rail');
  await expect(rail).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('rail-section-chat')).toBeVisible();
  await expect(page.getByTestId('chat-search-trigger')).toBeVisible();
});
