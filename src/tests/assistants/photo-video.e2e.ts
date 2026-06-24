/**
 * AI Photo & Video E2E — generate and edit photos during the hire flow,
 * verifying both the UI updates and database persistence of photo URLs.
 *
 * Uses Orchestra's local-mode dummy responses so no real AI APIs are called.
 *
 * Run: npx playwright test src/tests/assistants/photo-video.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  navigateToAssistants,
  openHireDialog,
  openAccordionSection,
  selectVoice,
  fillProfileFields,
  clickHireButton,
  closeHireDialogIfOpen,
  getAssistantAgentIds,
  getAssistantFromDb,
  deleteAssistantFromDb,
  ensureProjectSync,
  openDroidSwitcher,
} from './helpers';

const user = createTestUser({ name: 'PhotoE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

test.afterAll(() => {
  const ids = getAssistantAgentIds(user.id);
  ids.forEach((id) => {
    try {
      deleteAssistantFromDb(id);
    } catch {
      /* best effort */
    }
  });
  cleanupUser(user.id);
});

test('generating a photo and hiring saves the photo URL to the database', async ({
  authedPage: page,
}) => {
  const firstName = `Photo${Date.now()}`;

  await navigateToAssistants(page);
  await page.waitForTimeout(2_000);

  const dialogVisible = await page
    .locator('text=Hire Assistant')
    .first()
    .isVisible({ timeout: 5_000 })
    .catch(() => false);
  if (!dialogVisible) {
    await openHireDialog(page);
  }

  // Fill profile
  await fillProfileFields(page, {
    firstName,
    lastName: 'WithPhoto',
    about: 'Testing AI photo generation during hire.',
  });

  // Switch to Create tab and generate a photo
  await openAccordionSection(page, 'photo');
  await page.locator('[role="tab"]:has-text("Create")').click();
  await page.waitForTimeout(500);

  await page.locator('#photo-prompt-create').fill('Professional headshot portrait');

  const generateBtn = page.locator('button[aria-label="Generate new photo"]');
  await generateBtn.click();

  // Wait for generation to complete (button re-enables)
  await expect(generateBtn).not.toBeDisabled({ timeout: 60_000 });
  await page.waitForTimeout(2_000);

  // Select voice and hire
  await selectVoice(page);
  await clickHireButton(page);

  // Wait for the assistant to appear in the list (now inside the switcher)
  await openDroidSwitcher(page);
  const listItem = page.locator('[data-testid^="assistant-list-item-"]', { hasText: firstName });
  await expect(listItem).toBeVisible({ timeout: 60_000 });

  // Verify photo URL was persisted
  const agentIds = getAssistantAgentIds(user.id);
  const latestId = agentIds[agentIds.length - 1];
  const dbAssistant = getAssistantFromDb(latestId);

  expect(dbAssistant.firstName).toBe(firstName);
  expect(dbAssistant.profilePhoto).toBeTruthy();
});

test('editing a generated photo updates the photo URL in the database', async ({
  authedPage: page,
}) => {
  const firstName = `PhotoEdit${Date.now()}`;

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openHireDialog(page);

  await fillProfileFields(page, {
    firstName,
    lastName: 'EditTest',
    about: 'Testing photo edit flow.',
  });

  // Generate a base photo first
  await openAccordionSection(page, 'photo');
  await page.locator('[role="tab"]:has-text("Create")').click();
  await page.waitForTimeout(500);

  await page.locator('#photo-prompt-create').fill('Base portrait');
  const generateBtn = page.locator('button[aria-label="Generate new photo"]');
  await generateBtn.click();
  await expect(generateBtn).not.toBeDisabled({ timeout: 60_000 });
  await page.waitForTimeout(1_000);

  // Now switch to Edit tab and edit the photo
  await page.locator('[role="tab"]:has-text("Edit")').click();
  await page.waitForTimeout(500);

  await page.locator('#photo-prompt-edit').fill('Make the background blue');
  const editBtn = page.locator('button[aria-label="Edit photo"]');
  await editBtn.click();
  await expect(editBtn).not.toBeDisabled({ timeout: 60_000 });
  await page.waitForTimeout(1_000);

  // Hire with the edited photo
  await selectVoice(page);
  await clickHireButton(page);
  await openDroidSwitcher(page);
  const listItem2 = page.locator('[data-testid^="assistant-list-item-"]', { hasText: firstName });
  await expect(listItem2).toBeVisible({ timeout: 60_000 });

  // Verify photo URL persisted
  const agentIds = getAssistantAgentIds(user.id);
  const latestId = agentIds[agentIds.length - 1];
  const dbAssistant = getAssistantFromDb(latestId);

  expect(dbAssistant.profilePhoto).toBeTruthy();
});

test('animating a photo with TTS completes without error', async ({ authedPage: page }) => {
  const firstName = `Animate${Date.now()}`;

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openHireDialog(page);

  await fillProfileFields(page, {
    firstName,
    lastName: 'AnimTest',
    about: 'Testing photo animation flow.',
  });

  // Generate a base photo
  await openAccordionSection(page, 'photo');
  await page.locator('[role="tab"]:has-text("Create")').click();
  await page.waitForTimeout(500);

  await page.locator('#photo-prompt-create').fill('Friendly face');
  const generateBtn = page.locator('button[aria-label="Generate new photo"]');
  await generateBtn.click();
  await expect(generateBtn).not.toBeDisabled({ timeout: 60_000 });
  await page.waitForTimeout(1_000);

  // Select a voice first (required for animation TTS)
  await selectVoice(page);

  // Switch to Animate tab
  await openAccordionSection(page, 'photo');
  await page.locator('[role="tab"]:has-text("Animate")').click();
  await page.waitForTimeout(500);

  await page.locator('#tts-prompt').fill('Hello, nice to meet you! How are you doing today?');

  const animateBtn = page.locator('button[aria-label="Animate photo"]');
  await animateBtn.click();

  // Wait for animation to complete
  await expect(animateBtn).not.toBeDisabled({ timeout: 90_000 });

  // Hire the assistant
  await clickHireButton(page);
  await openDroidSwitcher(page);
  const listItem3 = page.locator('[data-testid^="assistant-list-item-"]', { hasText: firstName });
  await expect(listItem3).toBeVisible({ timeout: 60_000 });

  // Verify assistant was created
  const agentIds = getAssistantAgentIds(user.id);
  const latestId = agentIds[agentIds.length - 1];
  const dbAssistant = getAssistantFromDb(latestId);
  expect(dbAssistant.firstName).toBe(firstName);
});
