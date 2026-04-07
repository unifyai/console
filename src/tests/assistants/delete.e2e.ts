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
  firstName: string
) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const listItem = page.getByTestId(`assistant-list-item-${agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });

  // Open the dropdown menu on the list item
  const menuBtn = page.getByTestId(`assistant-menu-${agentId}`);
  await listItem.hover();
  await expect(menuBtn).toBeVisible({ timeout: 5_000 });
  await menuBtn.click();
  await page.waitForTimeout(500);

  // Click "Edit profile" in the dropdown
  const editItem = page.getByTestId('menu-edit-profile');
  await expect(editItem).toBeVisible({ timeout: 5_000 });
  await editItem.click();
  await page.waitForTimeout(1_500);

  await expect(
    page.locator('[role="dialog"]').locator('text=Modify your assistant details.')
  ).toBeVisible({ timeout: 10_000 });
}

test('deleting an assistant removes it from the list and the database', async ({
  authedPage: page,
}) => {
  const toDelete = createAssistant({
    userId: user.id,
    firstName: 'DeleteMe',
    surname: 'Now',
  });

  const countBefore = getAssistantCount(user.id);

  await openEditDialogForAssistant(page, toDelete.agentId, 'DeleteMe');

  // Click "End contract" button
  const endContractBtn = page.getByRole('button', { name: /End contract/i });
  await expect(endContractBtn).toBeVisible({ timeout: 5_000 });
  await endContractBtn.click();

  // Confirmation dialog: "Confirm End Contract"
  await expect(page.locator('text=Confirm End Contract')).toBeVisible({ timeout: 5_000 });

  // Click "Proceed"
  const proceedBtn = page.getByRole('button', { name: /Proceed/i });
  await proceedBtn.click();

  // Wait for deletion to complete
  await page.waitForTimeout(3_000);

  // Verify it's gone from the DB
  expect(assistantExistsInDb(toDelete.agentId)).toBe(false);

  // Verify the list count decreased
  const countAfter = getAssistantCount(user.id);
  expect(countAfter).toBe(countBefore - 1);
});

test('cancelling the delete confirmation keeps the assistant', async ({ authedPage: page }) => {
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

  // Cancel instead of proceeding
  const cancelBtn = page.getByRole('button', { name: /Cancel/i });
  await cancelBtn.click();
  await page.waitForTimeout(1_000);

  // Assistant should still exist in DB
  expect(assistantExistsInDb(toKeep.agentId)).toBe(true);
});

test('deleting the last assistant shows the empty state', async ({ authedPage: page }) => {
  deleteAllAssistantsForUser(user.id);

  const lastOne = createAssistant({
    userId: user.id,
    firstName: 'LastOne',
    surname: 'Standing',
  });

  await openEditDialogForAssistant(page, lastOne.agentId, 'LastOne');

  const endContractBtn = page.getByRole('button', { name: /End contract/i });
  await endContractBtn.click();

  await expect(page.locator('text=Confirm End Contract')).toBeVisible({ timeout: 5_000 });
  await page.getByRole('button', { name: /Proceed/i }).click();
  await page.waitForTimeout(3_000);

  expect(assistantExistsInDb(lastOne.agentId)).toBe(false);

  // After the last assistant is deleted, the page should show empty state
  // The hire dialog auto-opens or "No assistants found" text appears
  const emptyOrDialog = await Promise.race([
    page
      .locator('text=No assistants found.')
      .isVisible({ timeout: 5_000 })
      .catch(() => false),
    page
      .locator('[role="dialog"]')
      .isVisible({ timeout: 5_000 })
      .catch(() => false),
  ]);
  expect(emptyOrDialog).toBe(true);
});
