/**
 * Delete Assistant E2E — delete an assistant via the edit dialog's
 * "End contract" button, verify it disappears from the list and is
 * removed from the database.
 *
 * Run: npx playwright test src/tests/assistants/delete.e2e.ts
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
  openEditDialogFromList,
  getAssistantCount,
  assistantExistsInDb,
  deleteAllAssistantsForUser,
  ensureProjectSync,
} from './helpers';

const user = createTestUser({ name: 'DeleteE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

test.afterAll(() => {
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

/**
 * Open the edit dialog for a given assistant via the list item dropdown menu.
 */
async function openEditDialogForAssistant(
  page: import('@playwright/test').Page,
  agentId: number,
  _firstName: string
) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);
  await openEditDialogFromList(page, agentId);
}

test('deleting an assistant removes it from the list and the database @critical @area(assistants.delete)', async ({
  authedPage: page,
}) => {
  const toDelete = createAssistant({
    userId: user.id,
    firstName: 'DeleteMe',
    surname: 'Now',
  });

  const countBefore = getAssistantCount(user.id);

  await openEditDialogForAssistant(page, toDelete.agentId, 'DeleteMe');

  const endContractBtn = page.getByRole('button', { name: /End contract/i });
  await expect(endContractBtn).toBeVisible({ timeout: 5_000 });
  await endContractBtn.click();

  await expect(page.locator('text=Confirm End Contract')).toBeVisible({ timeout: 5_000 });

  const proceedBtn = page.getByRole('button', { name: /Proceed/i });
  await proceedBtn.click();

  await page.waitForTimeout(3_000);

  expect(assistantExistsInDb(toDelete.agentId)).toBe(false);

  const countAfter = getAssistantCount(user.id);
  expect(countAfter).toBe(countBefore - 1);

  await openUnitySwitcher(page);
  await expect(page.getByTestId(`assistant-list-item-${toDelete.agentId}`)).toHaveCount(0);
});

test('cancelling the delete confirmation keeps the assistant @critical @area(assistants.delete)', async ({
  authedPage: page,
}) => {
  const toKeep = createAssistant({
    userId: user.id,
    firstName: 'KeepMe',
    surname: 'CancelDelete',
  });

  await openEditDialogForAssistant(page, toKeep.agentId, 'KeepMe');

  const endContractBtn = page.getByRole('button', { name: /End contract/i });
  await expect(endContractBtn).toBeVisible({ timeout: 5_000 });
  await endContractBtn.click();

  await expect(page.locator('text=Confirm End Contract')).toBeVisible({ timeout: 5_000 });

  const cancelBtn = page.getByRole('button', { name: /Cancel/i });
  await cancelBtn.click();
  await page.waitForTimeout(1_000);

  expect(assistantExistsInDb(toKeep.agentId)).toBe(true);
});
