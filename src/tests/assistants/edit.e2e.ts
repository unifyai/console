/**
 * Edit Assistant E2E — open the edit dialog from the list item dropdown
 * menu, modify fields (name, about, age), save, and verify both the UI
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
import {
  approvedCharacterVoiceMetadata,
  coordinatorFixedVoiceId,
} from '../../constants/assistants/approved_character_voices';

const user = createTestUser({ name: 'EditE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);
test.describe.configure({ mode: 'serial' });

const assistant = createAssistant({
  userId: user.id,
  firstName: 'EditBot',
  surname: 'Original',
});
const EDIT_DIALOG_TITLE = /^Edit /;

test.afterAll(() => {
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

/**
 * Open the edit dialog for the seeded assistant via the list item dropdown menu.
 */
async function openEditDialog(
  page: import('@playwright/test').Page,
  targetAssistant: { agentId: number } = assistant
) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const listItem = page.getByTestId(`assistant-list-item-${targetAssistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });

  // Open the dropdown menu on the list item
  const menuBtn = page.getByTestId(`assistant-menu-${targetAssistant.agentId}`);
  await listItem.hover();
  await expect(menuBtn).toBeVisible({ timeout: 5_000 });
  await menuBtn.click();
  await page.waitForTimeout(500);

  // Click "Profile" in the dropdown
  const editItem = page.getByTestId('menu-edit-profile');
  await expect(editItem).toBeVisible({ timeout: 5_000 });
  await editItem.click();
  await page.waitForTimeout(1_500);

  // Verify the edit dialog opened
  await expect(page.locator('[role="dialog"]').filter({ hasText: EDIT_DIALOG_TITLE })).toBeVisible({
    timeout: 10_000,
  });
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

  // Click "Update Droid" button and wait for the dialog to close
  const updateBtn = page.getByRole('button', { name: /Update Droid/i });
  await updateBtn.scrollIntoViewIfNeeded();
  await updateBtn.click();

  // Wait for the edit dialog to close (indicates update completed)
  const editDialog = page.locator('[role="dialog"]').filter({ hasText: EDIT_DIALOG_TITLE });
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

test('clearing the surname via the edit dialog persists an empty string', async ({
  authedPage: page,
}) => {
  await openEditDialog(page);
  await openAccordionSection(page, 'profile');

  const firstNameInput = page.locator('#firstName');
  await expect(firstNameInput).toBeVisible({ timeout: 5_000 });
  await firstNameInput.fill(`SingleName${Date.now()}`);

  const surnameInput = page.locator('#surname');
  await expect(surnameInput).toBeVisible({ timeout: 5_000 });
  await surnameInput.fill('   ');

  const updateBtn = page.getByRole('button', { name: /Update Droid/i });
  await updateBtn.scrollIntoViewIfNeeded();
  await updateBtn.click();

  const editDialog = page.locator('[role="dialog"]').filter({ hasText: EDIT_DIALOG_TITLE });
  await expect(editDialog).not.toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1_000);

  const dbAfter = getAssistantFromDb(assistant.agentId);
  expect(dbAfter.surname).toBe('');
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

  const updateBtn = page.getByRole('button', { name: /Update Droid/i });
  await updateBtn.scrollIntoViewIfNeeded();
  await updateBtn.click();

  const editDialog = page.locator('[role="dialog"]').filter({ hasText: EDIT_DIALOG_TITLE });
  await expect(editDialog).not.toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1_000);

  const dbAfter = getAssistantFromDb(assistant.agentId);
  expect(dbAfter.about).toBe(newAbout);
});

test('changing T-W1N voice via the edit dialog persists to DB', async ({ authedPage: page }) => {
  const coordinator = user.coordinator;
  if (!coordinator) throw new Error('Expected seeded user to have a personal coordinator.');

  await openEditDialog(page, coordinator);

  const editDialog = page.locator('[role="dialog"]').filter({ hasText: EDIT_DIALOG_TITLE });
  await expect(editDialog.getByTestId('assistant-voice-section')).toBeVisible();

  const voiceOptions = editDialog.locator('[data-testid^="voice-option-"]');
  await expect(voiceOptions.first()).toBeVisible({ timeout: 15_000 });

  let selectedVoiceId: string | null = null;
  const optionCount = await voiceOptions.count();
  for (let index = 0; index < optionCount; index += 1) {
    const option = voiceOptions.nth(index);
    const testId = await option.getAttribute('data-testid');
    const voiceId = testId?.replace('voice-option-', '') ?? null;
    if (voiceId && voiceId !== coordinatorFixedVoiceId) {
      selectedVoiceId = voiceId;
      await option.click();
      await expect(option).toHaveAttribute('aria-selected', 'true');
      break;
    }
  }

  if (!selectedVoiceId) throw new Error('Expected at least one configurable T-W1N voice option.');

  const updateBtn = page.getByRole('button', { name: /Update T-W1N/i });
  await updateBtn.scrollIntoViewIfNeeded();
  await updateBtn.click();

  await expect(editDialog).not.toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1_000);

  const dbAfter = getAssistantFromDb(coordinator.agentId);
  expect(dbAfter.voiceId).toBe(selectedVoiceId);
  expect(dbAfter.voiceProvider).toBe(approvedCharacterVoiceMetadata[selectedVoiceId].provider);
});

test('setting a job title via the edit dialog persists job_title to DB', async ({
  authedPage: page,
}) => {
  await openEditDialog(page);
  await openAccordionSection(page, 'profile');

  const newJobTitle = `Specialist ${Date.now()}`;

  const jobTitleInput = page.locator('#jobTitle');
  await expect(jobTitleInput).toBeVisible({ timeout: 5_000 });
  await jobTitleInput.fill(newJobTitle);

  const updateBtn = page.getByRole('button', { name: /Update Droid/i });
  await updateBtn.scrollIntoViewIfNeeded();
  await updateBtn.click();

  const editDialog = page.locator('[role="dialog"]').filter({ hasText: EDIT_DIALOG_TITLE });
  await expect(editDialog).not.toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1_000);

  const dbAfter = getAssistantFromDb(assistant.agentId);
  expect(dbAfter.jobTitle).toBe(newJobTitle);
});

test('clearing the job title via the edit dialog sets job_title to NULL', async ({
  authedPage: page,
}) => {
  // Pre-condition: previous test set a job title; if not, set one directly so
  // this test is independent.
  const before = getAssistantFromDb(assistant.agentId);
  if (!before.jobTitle) {
    await openEditDialog(page);
    await openAccordionSection(page, 'profile');
    await page.locator('#jobTitle').fill('Temporary Title');
    await page.getByRole('button', { name: /Update Droid/i }).click();
    await expect(
      page.locator('[role="dialog"]').filter({ hasText: EDIT_DIALOG_TITLE })
    ).not.toBeVisible({
      timeout: 30_000,
    });
    await page.waitForTimeout(1_000);
  }

  await openEditDialog(page);
  await openAccordionSection(page, 'profile');

  const jobTitleInput = page.locator('#jobTitle');
  await expect(jobTitleInput).toBeVisible({ timeout: 5_000 });
  // Clear the field — backend should normalize empty / whitespace to NULL.
  await jobTitleInput.fill('   ');

  const updateBtn = page.getByRole('button', { name: /Update Droid/i });
  await updateBtn.scrollIntoViewIfNeeded();
  await updateBtn.click();

  const editDialog = page.locator('[role="dialog"]').filter({ hasText: EDIT_DIALOG_TITLE });
  await expect(editDialog).not.toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1_000);

  const dbAfter = getAssistantFromDb(assistant.agentId);
  expect(dbAfter.jobTitle).toBeNull();
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
