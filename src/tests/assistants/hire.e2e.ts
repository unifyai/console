/**
 * Assistant Hire Flow E2E — complete user journeys for hiring assistants,
 * verifying both UI behaviour and database persistence.
 *
 * Includes:
 *  - Hiring with basic and full profile fields
 *  - Randomizing the unity profile
 *  - Cancelling mid-hire
 *  - Hiring multiple assistants
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

test('hiring an assistant persists it to the database and shows it in the list', async ({
  authedPage: page,
}) => {
  const firstName = `Hire${Date.now()}`;
  const lastName = 'Bot';

  await navigateToAssistants(page);

  // Hire dialog auto-opens on empty state; open manually if it didn't.
  const dialogVisible = await page
    .getByRole('heading', { name: 'Onboard Teammate' })
    .first()
    .isVisible({ timeout: 5_000 })
    .catch(() => false);
  if (!dialogVisible) {
    await openHireDialog(page);
  }

  await fillProfileFields(page, {
    firstName,
    lastName,
    about: 'An automated test assistant created by Playwright E2E.',
  });

  await selectVoice(page);
  await clickHireButton(page);

  // Wait for the hire to complete — the assistant name should appear in the
  // list (now hosted inside the rail's unity switcher).
  await openUnitySwitcher(page);
  const listItem = page.locator('[data-testid^="assistant-list-item-"]', {
    hasText: firstName,
  });
  await expect(listItem).toBeVisible({ timeout: 60_000 });

  // Verify DB state
  const agentIds = getAssistantAgentIds(user.id);
  const latestId = agentIds[agentIds.length - 1];
  const dbAssistant = getAssistantFromDb(latestId);

  expect(dbAssistant.firstName).toBe(firstName);
  expect(dbAssistant.surname).toBe(lastName);
  expect(dbAssistant.voiceId).toBeTruthy();
});

test('the hired assistant is visible in the DB with correct fields', async ({
  authedPage: page,
}) => {
  // Relies on the assistant created by the previous test
  const agentIds = getAssistantAgentIds(user.id);
  expect(agentIds.length).toBeGreaterThan(0);
  const agentId = agentIds[agentIds.length - 1];

  // Verify DB fields
  const dbAssistant = getAssistantFromDb(agentId);
  expect(dbAssistant.firstName).toBeTruthy();
  expect(dbAssistant.surname).toBeTruthy();
  expect(dbAssistant.voiceId).toBeTruthy();

  // Verify the assistant appears in the list UI
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);

  const listItem = page.getByTestId(`assistant-list-item-${agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });

  // Click the assistant to select it and view the Chat tab
  await listItem.click();
  await page.waitForTimeout(1_000);

  // Profile panel should show the assistant's name
  await expect(page.locator(`text=${dbAssistant.firstName}`).first()).toBeVisible({
    timeout: 5_000,
  });
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

test('hiring without filling Job Title leaves job_title NULL in DB', async ({
  authedPage: page,
}) => {
  const firstName = `NoJob${Date.now()}`;

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openHireDialog(page);

  // The form auto-applies a randomized profile (including a Role), so to
  // exercise the empty → NULL path we must explicitly clear the field.
  await fillProfileFields(page, {
    firstName,
    lastName: 'Untitled',
    jobTitle: '',
    about: 'No job title.',
  });

  await selectVoice(page);
  await clickHireButton(page);

  await openUnitySwitcher(page);
  const listItem = page.locator('[data-testid^="assistant-list-item-"]', { hasText: firstName });
  await expect(listItem).toBeVisible({ timeout: 60_000 });

  const agentIds = getAssistantAgentIds(user.id);
  const latestId = agentIds[agentIds.length - 1];
  const dbAssistant = getAssistantFromDb(latestId);
  expect(dbAssistant.jobTitle).toBeNull();
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

test('hiring a second assistant shows both in the list', async ({ authedPage: page }) => {
  const firstName = `Second${Date.now()}`;
  const countBefore = getAssistantCount(user.id);

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openHireDialog(page);

  await fillProfileFields(page, {
    firstName,
    lastName: 'Assistant',
    about: 'Second test assistant.',
  });

  await selectVoice(page);
  await clickHireButton(page);

  await openUnitySwitcher(page);
  const listItem = page.locator('[data-testid^="assistant-list-item-"]', {
    hasText: firstName,
  });
  await expect(listItem).toBeVisible({ timeout: 60_000 });

  // Verify both assistants exist in DB
  const countAfter = getAssistantCount(user.id);
  expect(countAfter).toBe(countBefore + 1);
});
