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
  closeUnitySwitcher,
  waitForAssistantListReady,
  openRailSection,
  getCoordinatorAgentId,
  deferCoordinatorOnboarding,
  deleteAllAssistantsForUser,
  ensureProjectSync,
} from './helpers';
import { assistantRail, railSection, railUnitySwitcher } from '../helpers/shell';

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

  const rail = assistantRail(page);
  await expect(rail).toBeVisible({ timeout: 15_000 });
  await expect(rail.getByText('Unify', { exact: true })).toBeVisible();
  await expect(railUnitySwitcher(page)).toBeVisible();
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

  await expect(railSection(page, 'chat')).toContainText('Switchy');
  await closeUnitySwitcher(page);
  // Default section is Chat.
  await expect(railSection(page, 'chat')).toHaveAttribute('aria-current', 'page');
});

test('the switcher face opens the picker once its own surface is already active', async ({
  authedPage: page,
}) => {
  deleteAllAssistantsForUser(user.id);
  createAssistant({ userId: user.id, firstName: 'Facey', surname: 'Fallthrough' });

  await navigateToAssistants(page, shellOpts);
  await closeHireDialogIfOpen(page);

  const face = railSection(page, 'chat');
  const picker = page.getByTestId('rail-unity-switcher-popover');

  // Away from Chat the face is a nav button: it goes home, picker untouched.
  await openRailSection(page, 'tasks');
  await face.click();
  await expect(face).toHaveAttribute('aria-current', 'page');
  await expect(picker).toHaveCount(0);

  // Home already open, so the same click has nowhere to go and opens the picker.
  await face.click();
  await expect(picker).toBeVisible({ timeout: 5_000 });
  await waitForAssistantListReady(page);

  // And reads as a toggle rather than reopening what the click just dismissed.
  await face.click();
  await expect(picker).toHaveCount(0, { timeout: 5_000 });
});

test('Workspace and Brain section nav switches the active view', async ({ authedPage: page }) => {
  deleteAllAssistantsForUser(user.id);
  const unity = createAssistant({ userId: user.id, firstName: 'Navvy', surname: 'Sections' });

  await navigateToAssistants(page, shellOpts);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page, shellOpts);
  await page.getByTestId(`assistant-list-item-${unity.agentId}`).click();
  await expect(railSection(page, 'chat')).toContainText('Navvy');
  await closeUnitySwitcher(page);

  await openRailSection(page, 'tasks');
  await expect(railSection(page, 'tasks')).toHaveAttribute('aria-current', 'page');

  await openRailSection(page, 'data');
  await expect(railSection(page, 'data')).toHaveAttribute('aria-current', 'page');
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

  // A hidden duplicate shell surface can mount its own toggle; assert and
  // click the visible instance only.
  const mobileToggle = page.locator('[data-testid="rail-mobile-toggle"]:visible').first();
  await expect(mobileToggle).toBeVisible({ timeout: 15_000 });
  await expect(assistantRail(page)).toHaveCount(0);

  await mobileToggle.click();
  const rail = assistantRail(page);
  await expect(rail).toBeVisible({ timeout: 5_000 });
  await expect(railSection(page, 'chat')).toBeVisible();
  await expect(page.getByTestId('chat-search-trigger')).toBeVisible();
});
