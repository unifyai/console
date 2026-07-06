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
  openUnitySwitcher,
  openEditDialogFromList,
} from './helpers';
import {
  approvedCharacterVoiceMetadata,
  coordinatorDefaultVoiceId,
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
 * Open the edit dialog for the seeded assistant via the list info panel.
 */
async function openEditDialog(
  page: import('@playwright/test').Page,
  targetAssistant: { agentId: number } = assistant
) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);
  await openEditDialogFromList(page, targetAssistant.agentId);
}

test('updating the first name and surname via the edit dialog persists to DB', async ({
  authedPage: page,
}) => {
  await openEditDialog(page);

  const newFirst = `Edited${Date.now()}`;
  const newLast = 'Updated';

  await openAccordionSection(page, 'profile');

  const firstNameInput = page.locator('#firstName');
  await expect(firstNameInput).toBeVisible({ timeout: 5_000 });
  await firstNameInput.fill(newFirst);

  const surnameInput = page.locator('#surname');
  await surnameInput.fill(newLast);

  const updateBtn = page.getByRole('button', { name: /Update Teammate/i });
  await updateBtn.scrollIntoViewIfNeeded();
  await updateBtn.click();

  const editDialog = page.locator('[role="dialog"]').filter({ hasText: EDIT_DIALOG_TITLE });
  await expect(editDialog).not.toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1_000);

  const dbAfter = getAssistantFromDb(assistant.agentId);
  expect(dbAfter.firstName).toBe(newFirst);
  expect(dbAfter.surname).toBe(newLast);

  await openUnitySwitcher(page);
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

  const updateBtn = page.getByRole('button', { name: /Update Teammate/i });
  await updateBtn.scrollIntoViewIfNeeded();
  await updateBtn.click();

  const editDialog = page.locator('[role="dialog"]').filter({ hasText: EDIT_DIALOG_TITLE });
  await expect(editDialog).not.toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1_000);

  const dbAfter = getAssistantFromDb(assistant.agentId);
  expect(dbAfter.about).toBe(newAbout);
});

test('changing T-W1N voice via the edit dialog persists to DB @critical @area(assistants.edit)', async ({
  authedPage: page,
}) => {
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
    if (voiceId && voiceId !== coordinatorDefaultVoiceId) {
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

  const updateBtn = page.getByRole('button', { name: /Update Teammate/i });
  await updateBtn.scrollIntoViewIfNeeded();
  await updateBtn.click();

  const editDialog = page.locator('[role="dialog"]').filter({ hasText: EDIT_DIALOG_TITLE });
  await expect(editDialog).not.toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1_000);

  const dbAfter = getAssistantFromDb(assistant.agentId);
  expect(dbAfter.jobTitle).toBe(newJobTitle);
});

test('closing the edit dialog without saving leaves DB unchanged', async ({ authedPage: page }) => {
  const dbBefore = getAssistantFromDb(assistant.agentId);

  await openEditDialog(page);

  await openAccordionSection(page, 'profile');

  const firstNameInput = page.locator('#firstName');
  await expect(firstNameInput).toBeVisible({ timeout: 5_000 });
  await firstNameInput.fill('ShouldNotSave');

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
