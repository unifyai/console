/**
 * Assistant List E2E — verifies the assistant list behaves correctly:
 * empty state, list rendering after seeding, clicking to open profile,
 * and list updating after a new hire.
 *
 * Run: npx playwright test src/tests/assistants/list.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  navigateToAssistants,
  closeHireDialogIfOpen,
  openHireDialog,
  fillProfileFields,
  selectVoice,
  clickHireButton,
  getAssistantAgentIds,
  getAssistantFromDb,
  deleteAllAssistantsForUser,
  ensureProjectSync,
} from './helpers';

const user = createTestUser({ name: 'ListE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(90_000);

test.afterAll(() => {
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

test('empty state opens the hire dialog automatically', async ({ authedPage: page }) => {
  deleteAllAssistantsForUser(user.id);

  await navigateToAssistants(page);

  // On an empty list the hire dialog should auto-open
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('text=Hire Assistant').first()).toBeVisible({ timeout: 5_000 });

  // The list pane should show the "No assistants found." text behind the dialog
  await closeHireDialogIfOpen(page);
  await expect(page.locator('text=No assistants found.')).toBeVisible({ timeout: 5_000 });
});

test('seeded assistants appear in the list with correct names', async ({ authedPage: page }) => {
  deleteAllAssistantsForUser(user.id);

  const a1 = createAssistant({ userId: user.id, firstName: 'Alpha', surname: 'ListTest' });
  const a2 = createAssistant({ userId: user.id, firstName: 'Beta', surname: 'ListTest' });

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const item1 = page.getByTestId(`assistant-list-item-${a1.agentId}`);
  const item2 = page.getByTestId(`assistant-list-item-${a2.agentId}`);

  await expect(item1).toBeVisible({ timeout: 15_000 });
  await expect(item2).toBeVisible({ timeout: 5_000 });

  await expect(page.locator('[data-testid^="assistant-list-group-"]')).toHaveCount(0);
  await expect(item1).toContainText('Alpha');
  await expect(item2).toContainText('Beta');
});

test('clicking an assistant in the list selects it and shows the Chat tab', async ({
  authedPage: page,
}) => {
  const agentIds = getAssistantAgentIds(user.id);
  expect(agentIds.length).toBeGreaterThan(0);
  const agentId = agentIds[0];
  const dbAssistant = getAssistantFromDb(agentId);

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const listItem = page.getByTestId(`assistant-list-item-${agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();
  await page.waitForTimeout(1_000);

  // Chat tab should be active and show the assistant's name
  await expect(page.getByTestId('right-pane-tab-chat')).toHaveAttribute('data-state', 'active');
  await expect(page.locator(`text=${dbAssistant.firstName}`).first()).toBeVisible({
    timeout: 5_000,
  });
  await expect(page.locator(`text=${dbAssistant.surname}`).first()).toBeVisible({ timeout: 5_000 });

  await listItem.click();
  await expect(page.getByTestId('right-pane-tab-chat')).not.toBeVisible({ timeout: 3_000 });
  await expect(page.locator('text=Select a droid to watch live actions.')).toBeVisible({
    timeout: 5_000,
  });
});

test('the chat info side panel can be resized down to its minimum width', async ({
  authedPage: page,
}) => {
  deleteAllAssistantsForUser(user.id);

  const titled = createAssistant({
    userId: user.id,
    firstName: 'Titled',
    surname: 'InfoPanel',
    jobTitle: 'QA engineer',
  });

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const listItem = page.getByTestId(`assistant-list-item-${titled.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();

  // Open the inline info side panel from the chat sub-header. We can't
  // rely on the post-hire auto-open path here because this assistant
  // was seeded via `createAssistant` (no `newlyHiredInfo` in memory).
  const infoButton = page.getByTestId('assistant-info-button');
  await expect(infoButton).toBeVisible({ timeout: 10_000 });

  const infoSheet = page.getByTestId('assistant-info-sheet');
  if (!(await infoSheet.isVisible({ timeout: 1_000 }).catch(() => false))) {
    await infoButton.click();
  }
  await expect(infoSheet).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('assistant-info-name')).toContainText('Titled InfoPanel');

  const resizeHandle = page.getByTestId('assistant-info-panel-resize-handle');
  const beforeBox = await infoSheet.boundingBox();
  const handleBox = await resizeHandle.boundingBox();
  if (!beforeBox || !handleBox) throw new Error('Info panel resize target was not measurable');

  const dragY = handleBox.y + handleBox.height / 2;
  await page.mouse.move(handleBox.x + handleBox.width / 2, dragY);
  await page.mouse.down();
  await page.mouse.move(beforeBox.x + beforeBox.width + 200, dragY, { steps: 12 });
  await page.mouse.up();

  const afterBox = await infoSheet.boundingBox();
  if (!afterBox) throw new Error('Info panel was not measurable after resize');
  expect(afterBox.width).toBeLessThan(beforeBox.width - 40);
  expect(afterBox.width).toBeGreaterThanOrEqual(318);
  expect(afterBox.width).toBeLessThanOrEqual(324);
});

test('list updates after hiring a new assistant without page reload', async ({
  authedPage: page,
}) => {
  const firstName = `Fresh${Date.now()}`;

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  // Count visible list items before hire
  const itemsBefore = await page.locator('[data-testid^="assistant-list-item-"]').count();

  await openHireDialog(page);
  await fillProfileFields(page, {
    firstName,
    lastName: 'ListNew',
    age: 29,
    about: 'Testing list update after hire.',
  });
  await selectVoice(page);
  await clickHireButton(page);

  const newItem = page.locator('[data-testid^="assistant-list-item-"]', { hasText: firstName });
  await expect(newItem).toBeVisible({ timeout: 60_000 });

  const itemsAfter = await page.locator('[data-testid^="assistant-list-item-"]').count();
  expect(itemsAfter).toBe(itemsBefore + 1);
});
