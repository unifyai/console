/**
 * Assistant Profile E2E — verify that clicking an assistant in the list
 * opens a profile panel with all the correct data fields, and that the
 * deep link via ?profile=<agentId> works.
 *
 * Run: npx playwright test src/tests/assistants/profile.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  navigateToAssistants,
  closeHireDialogIfOpen,
  getAssistantFromDb,
  deleteAllAssistantsForUser,
  ensureProjectSync,
} from './helpers';

const user = createTestUser({ name: 'ProfileE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(90_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'ProfileBot',
  surname: 'TestView',
});

test.afterAll(() => {
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

test('profile panel shows all assistant data fields from the database', async ({
  authedPage: page,
}) => {
  const db = getAssistantFromDb(assistant.agentId);

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const listItem = page.getByTestId(`assistant-list-item-${assistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();
  await page.waitForTimeout(1_500);

  // The Profile accordion is collapsed by default — expand it
  const profileHeading = page.getByRole('heading', { name: 'Profile' });
  await expect(profileHeading).toBeVisible({ timeout: 5_000 });
  const profileButton = profileHeading.getByRole('button', { name: 'Profile' });
  await profileButton.click();
  await page.waitForTimeout(1_000);

  // Now the profile info panel shows fields in a grid
  await expect(page.locator('text=First Name').first()).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(`text=${db.firstName}`).first()).toBeVisible({ timeout: 3_000 });
  await expect(page.locator(`text=${db.surname}`).first()).toBeVisible({ timeout: 3_000 });

  if (db.age) {
    await expect(page.locator(`text=${db.age}`).first()).toBeVisible({ timeout: 3_000 });
  }
  if (db.nationality) {
    await expect(page.locator(`text=${db.nationality}`).first()).toBeVisible({ timeout: 3_000 });
  }

  if (db.about && db.about !== '') {
    await expect(page.locator('text=About Me').first()).toBeVisible({ timeout: 3_000 });
  }
});

test('deep link ?profile=agentId opens the correct assistant profile', async ({
  authedPage: page,
}) => {
  const db = getAssistantFromDb(assistant.agentId);

  await page.goto(`/assistants?profile=${assistant.agentId}`);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
  await closeHireDialogIfOpen(page);

  // The profile panel should already be open with the correct assistant
  await expect(page.locator(`text=${db.firstName}`).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(`text=${db.surname}`).first()).toBeVisible({ timeout: 5_000 });
});

test('profile for an assistant with no about shows fallback text', async ({ authedPage: page }) => {
  // Create an assistant with empty about
  const noAbout = createAssistant({
    userId: user.id,
    firstName: 'NoAbout',
    surname: 'Bot',
  });

  // Clear the about field
  const { dbExec } = await import('../seeds/client');
  dbExec(`UPDATE assistants SET about = NULL WHERE agent_id = ${noAbout.agentId}`);

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const listItem = page.getByTestId(`assistant-list-item-${noAbout.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();
  await page.waitForTimeout(1_500);

  // Expand the Profile accordion
  const profileHeading = page.getByRole('heading', { name: 'Profile' });
  await expect(profileHeading).toBeVisible({ timeout: 5_000 });
  await profileHeading.getByRole('button', { name: 'Profile' }).click();
  await page.waitForTimeout(1_000);

  // Should show "No description provided." fallback
  await expect(page.locator('text=No description provided.').first()).toBeVisible({
    timeout: 5_000,
  });
});
