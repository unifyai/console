/**
 * Edit Assistant E2E — open the edit dialog from the profile panel,
 * modify fields (name, about, age), save, and verify both the UI
 * updates and the database persistence.
 *
 * Run: npx playwright test src/tests/assistants/edit.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  navigateToAssistants,
  closeHireDialogIfOpen,
  openAccordionSection,
  getAssistantFromDb,
  deleteAllAssistantsForUser,
  ensureProjectSync,
} from './helpers';

const user = createTestUser({ name: 'EditE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'EditBot',
  surname: 'Original',
});

test.afterAll(() => {
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

/**
 * Open the edit dialog for the seeded assistant.
 * Navigates to assistants page → clicks list item → clicks the edit
 * button (pen icon) in the profile panel header.
 */
async function openEditDialog(page: import('@playwright/test').Page) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const listItem = page.getByTestId(`assistant-list-item-${assistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();
  await page.waitForTimeout(1_500);

  // The Profile accordion section is collapsed by default (only Chat is open).
  // Click the heading button labelled "Profile" to expand it.
  const profileHeading = page.getByRole('heading', { name: 'Profile' });
  await expect(profileHeading).toBeVisible({ timeout: 5_000 });
  const profileButton = profileHeading.getByRole('button', { name: 'Profile' });
  await profileButton.click();
  await page.waitForTimeout(1_000);

  // Wait for profile content to render
  await expect(page.locator('text=First Name').first()).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('text=About Me').first()).toBeVisible({ timeout: 5_000 });

  // Click the About Me prose area to trigger the edit dialog
  // The prose div has onClick={canWrite ? onEdit : undefined}
  const aboutContent = page
    .locator('h3:has-text("About Me")')
    .locator('..')
    .locator('div.prose')
    .first();
  await aboutContent.click();
  await page.waitForTimeout(1_500);

  // Verify the edit dialog opened
  await expect(
    page.locator('[role="dialog"]').locator('text=Modify your assistant details.')
  ).toBeVisible({ timeout: 10_000 });
}

test('updating the first name and surname via the edit dialog persists to DB', async ({
  authedPage: page,
}) => {
  await openEditDialog(page);

  const newFirst = `Edited${Date.now()}`;
  const newLast = 'Updated';

  // The edit form reuses the hire form layout with profile accordion
  await openAccordionSection(page, 'profile');

  const firstNameInput = page.locator('#firstName');
  await expect(firstNameInput).toBeVisible({ timeout: 5_000 });
  await firstNameInput.fill(newFirst);

  const surnameInput = page.locator('#surname');
  await surnameInput.fill(newLast);

  // Click "Update Assistant" button and wait for the dialog to close
  const updateBtn = page.getByRole('button', { name: /Update Assistant/i });
  await updateBtn.scrollIntoViewIfNeeded();
  await updateBtn.click();

  // Wait for the edit dialog to close (indicates update completed)
  const editDialog = page
    .locator('[role="dialog"]')
    .filter({ hasText: 'Modify your assistant details.' });
  await expect(editDialog).not.toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1_000);

  // Verify DB was updated
  const dbAfter = getAssistantFromDb(assistant.agentId);
  expect(dbAfter.firstName).toBe(newFirst);
  expect(dbAfter.surname).toBe(newLast);

  // Verify the updated name is visible in the list
  const listItem = page.locator('[data-testid^="assistant-list-item-"]', { hasText: newFirst });
  await expect(listItem).toBeVisible({ timeout: 10_000 });
});

test('updating the about field via the edit dialog persists to DB', async ({
  authedPage: page,
}) => {
  await openEditDialog(page);

  const newAbout = `Updated about text at ${Date.now()}`;

  await openAccordionSection(page, 'profile');

  const aboutInput = page.locator('#about');
  await expect(aboutInput).toBeVisible({ timeout: 5_000 });
  await aboutInput.fill(newAbout);

  const updateBtn = page.getByRole('button', { name: /Update Assistant/i });
  await updateBtn.scrollIntoViewIfNeeded();
  await updateBtn.click();

  const editDialog = page
    .locator('[role="dialog"]')
    .filter({ hasText: 'Modify your assistant details.' });
  await expect(editDialog).not.toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1_000);

  const dbAfter = getAssistantFromDb(assistant.agentId);
  expect(dbAfter.about).toBe(newAbout);
});

test('updating the age via the edit dialog persists to DB', async ({ authedPage: page }) => {
  await openEditDialog(page);

  await openAccordionSection(page, 'profile');

  const ageInput = page.locator('#age');
  await expect(ageInput).toBeVisible({ timeout: 5_000 });
  await ageInput.fill('55');

  const updateBtn = page.getByRole('button', { name: /Update Assistant/i });
  await updateBtn.scrollIntoViewIfNeeded();
  await updateBtn.click();

  const editDialog = page
    .locator('[role="dialog"]')
    .filter({ hasText: 'Modify your assistant details.' });
  await expect(editDialog).not.toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1_000);

  const dbAfter = getAssistantFromDb(assistant.agentId);
  expect(dbAfter.age).toBe('55');
});

test('closing the edit dialog without saving leaves DB unchanged', async ({ authedPage: page }) => {
  const dbBefore = getAssistantFromDb(assistant.agentId);

  await openEditDialog(page);

  await openAccordionSection(page, 'profile');

  const firstNameInput = page.locator('#firstName');
  await expect(firstNameInput).toBeVisible({ timeout: 5_000 });
  await firstNameInput.fill('ShouldNotSave');

  // Close via the X button (has sr-only text "Close Edit Dialog")
  const closeBtn = page.getByRole('button', { name: /Close Edit Dialog/i });
  if (await closeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await closeBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(1_000);

  const dbAfter = getAssistantFromDb(assistant.agentId);
  expect(dbAfter.firstName).toBe(dbBefore.firstName);
});
