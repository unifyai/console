/**
 * Assistant Hire Flow E2E — complete user journeys for hiring assistants,
 * verifying both UI behaviour and database persistence.
 *
 * Includes:
 *  - Randomizing the unity profile
 *  - Hiring with job title and full profile fields
 *  - Cancelling mid-hire
 *
 * Run: npx playwright test src/tests/assistants/hire.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  navigateToAssistants,
  closeHireDialogIfOpen,
  openHireDialog,
  fillProfileFields,
  selectVoice,
  clickHireButton,
  getAssistantCount,
  getAssistantAgentIds,
  getAssistantFromDb,
  deleteAllAssistantsForUser,
  ensureProjectSync,
  setUserCredits,
  openUnitySwitcher,
} from './helpers';

const user = createTestUser({ name: 'HireFlow', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

test.afterAll(() => {
  setUserCredits(user.id, 50_000);
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

test('hiring persists name, about and voice to DB and leaves age/nationality null', async ({
  authedPage: page,
}) => {
  const firstName = `Full${Date.now()}`;
  const lastName = 'Fields';
  const about = 'Full-field hire test with about.';

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openHireDialog(page);

  await fillProfileFields(page, { firstName, lastName, about });

  await selectVoice(page);
  await clickHireButton(page);

  await openUnitySwitcher(page);
  const listItem = page.locator('[data-testid^="assistant-list-item-"]', { hasText: firstName });
  await expect(listItem).toBeVisible({ timeout: 60_000 });

  const agentIds = getAssistantAgentIds(user.id);
  const latestId = agentIds[agentIds.length - 1];
  const dbAssistant = getAssistantFromDb(latestId);

  expect(dbAssistant.firstName).toBe(firstName);
  expect(dbAssistant.surname).toBe(lastName);
  expect(dbAssistant.about).toBe(about);
  expect(dbAssistant.voiceId).toBeTruthy();
  // The redesigned form no longer collects age/nationality, so they persist as
  // NULL (psql renders NULL as an empty string through our pipe-split reader).
  expect(dbAssistant.age).toBe('');
  expect(dbAssistant.nationality).toBe('');
});

test('Randomize replaces the profile fields with a fresh unity profile', async ({
  authedPage: page,
}) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openHireDialog(page);

  // The form auto-randomizes a profile on open; wait for the name to settle,
  // then overwrite it with a sentinel so we can prove Randomize replaced it.
  const firstNameInput = page.locator('#firstName');
  await expect(firstNameInput).not.toHaveValue('', { timeout: 15_000 });
  await firstNameInput.fill('ZzzSentinelName');

  await page.getByRole('button', { name: 'Randomize unity profile' }).click();

  await expect(firstNameInput).not.toHaveValue('ZzzSentinelName', { timeout: 5_000 });
  await expect(firstNameInput).not.toHaveValue('', { timeout: 5_000 });
  await expect(page.locator('#about')).not.toHaveValue('', { timeout: 5_000 });
});

test('hiring with a job title persists job_title to DB and shows it in the hover card', async ({
  authedPage: page,
}) => {
  const firstName = `Job${Date.now()}`;
  const lastName = 'Titled';
  const jobTitle = 'Growth marketing';

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openHireDialog(page);

  await fillProfileFields(page, {
    firstName,
    lastName,
    jobTitle,
    about: 'Hire with job title.',
  });

  await selectVoice(page);
  await clickHireButton(page);

  await openUnitySwitcher(page);
  const listItem = page.locator('[data-testid^="assistant-list-item-"]', { hasText: firstName });
  await expect(listItem).toBeVisible({ timeout: 60_000 });

  const agentIds = getAssistantAgentIds(user.id);
  const latestId = agentIds[agentIds.length - 1];
  const dbAssistant = getAssistantFromDb(latestId);
  expect(dbAssistant.firstName).toBe(firstName);
  expect(dbAssistant.jobTitle).toBe(jobTitle);

  // The list row renders the job title as a subtitle beneath the unity name.
  await expect(listItem).toContainText(jobTitle);
});

test('cancelling mid-hire does not create an assistant', async ({ authedPage: page }) => {
  const countBefore = getAssistantCount(user.id);

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openHireDialog(page);

  await fillProfileFields(page, {
    firstName: `Cancel${Date.now()}`,
    lastName: 'NeverCreated',
    about: 'This should not be saved.',
  });

  // Close the dialog without hiring (Escape key)
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1_000);

  const countAfter = getAssistantCount(user.id);
  expect(countAfter).toBe(countBefore);
});
