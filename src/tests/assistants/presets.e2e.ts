/**
 * Preset Selection E2E — verify that clicking a preset in the hire
 * dialog populates the form fields, and that hiring from a preset
 * persists the correct values to the database.
 *
 * Run: npx playwright test src/tests/assistants/presets.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  navigateToAssistants,
  closeHireDialogIfOpen,
  openHireDialog,
  openAccordionSection,
  clickHireButton,
  getAssistantAgentIds,
  getAssistantFromDb,
  deleteAllAssistantsForUser,
  ensureProjectSync,
  openDroidSwitcher,
} from './helpers';

const user = createTestUser({ name: 'PresetE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

test.afterAll(() => {
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

test('selecting a preset populates the form fields with preset data', async ({
  authedPage: page,
}) => {
  await navigateToAssistants(page);

  // The hire dialog may auto-open on empty state
  const dialogVisible = await page
    .locator('text=Hire Assistant')
    .first()
    .isVisible({ timeout: 5_000 })
    .catch(() => false);
  if (!dialogVisible) {
    await openHireDialog(page);
  }

  // The presets panel should be visible on the right side of the hire dialog
  // Each preset is rendered as a role="button" with Name, Age, Nationality fields
  const presetItems = page.locator('[role="button"]').filter({ hasText: 'Name:' });
  await expect(presetItems.first()).toBeVisible({ timeout: 15_000 });

  // Capture the first preset's name from the preset list
  const presetFirstItem = presetItems.first();
  const presetNameText = await presetFirstItem.locator('.text-strong').first().textContent();
  expect(presetNameText).toBeTruthy();
  const [presetFirst, ...presetLastParts] = presetNameText!.trim().split(' ');
  const presetLast = presetLastParts.join(' ');

  // Click the preset to select it
  await presetFirstItem.click();
  await page.waitForTimeout(2_000);

  // Verify the form fields were populated
  await openAccordionSection(page, 'profile');

  const firstNameInput = page.locator('#firstName');
  await expect(firstNameInput).toHaveValue(presetFirst, { timeout: 5_000 });

  const surnameInput = page.locator('#surname');
  await expect(surnameInput).toHaveValue(presetLast, { timeout: 5_000 });

  // Age should be populated
  const ageInput = page.locator('#age');
  const ageValue = await ageInput.inputValue();
  expect(ageValue).toBeTruthy();

  // Nationality should be populated
  const nationalityTrigger = page.locator('#nationality');
  const nationalityText = await nationalityTrigger.textContent();
  expect(nationalityText).toBeTruthy();
  expect(nationalityText).not.toBe('Select a nationality...');
});

test('hiring from a preset saves the preset data to the database', async ({ authedPage: page }) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openHireDialog(page);

  // Select the first available preset
  const presetItems = page.locator('[role="button"]').filter({ hasText: 'Name:' });
  await expect(presetItems.first()).toBeVisible({ timeout: 15_000 });

  const presetFirstItem = presetItems.first();
  const presetNameText = await presetFirstItem.locator('.text-strong').first().textContent();
  const [presetFirst, ...presetLastParts] = presetNameText!.trim().split(' ');
  const presetLast = presetLastParts.join(' ');

  await presetFirstItem.click();
  await page.waitForTimeout(2_000);

  // Capture the populated nationality before hiring
  await openAccordionSection(page, 'profile');
  const nationalityTrigger = page.locator('#nationality');
  const nationalityValue = await nationalityTrigger.textContent();

  await clickHireButton(page);

  await openDroidSwitcher(page);
  const listItem = page.locator('[data-testid^="assistant-list-item-"]', { hasText: presetFirst });
  await expect(listItem).toBeVisible({ timeout: 60_000 });

  // Verify the DB has the preset values
  const agentIds = getAssistantAgentIds(user.id);
  const latestId = agentIds[agentIds.length - 1];
  const dbAssistant = getAssistantFromDb(latestId);

  expect(dbAssistant.firstName).toBe(presetFirst);
  expect(dbAssistant.surname).toBe(presetLast);
  expect(dbAssistant.nationality).toBeTruthy();
  expect(dbAssistant.about).toBeTruthy();
  expect(dbAssistant.voiceId).toBeTruthy();
});

test('customizing preset fields before hiring uses the customized values', async ({
  authedPage: page,
}) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openHireDialog(page);

  // Select a preset first
  const presetItems = page.locator('[role="button"]').filter({ hasText: 'Name:' });
  await expect(presetItems.first()).toBeVisible({ timeout: 15_000 });
  await presetItems.first().click();
  await page.waitForTimeout(2_000);

  // Override the name and about with custom values
  await openAccordionSection(page, 'profile');

  const customFirst = `Custom${Date.now()}`;
  const customAbout = 'This is a customized preset.';

  const firstNameInput = page.locator('#firstName');
  await firstNameInput.fill(customFirst);

  const aboutInput = page.locator('#about');
  await aboutInput.fill(customAbout);

  await clickHireButton(page);

  await openDroidSwitcher(page);
  const listItem = page.locator('[data-testid^="assistant-list-item-"]', { hasText: customFirst });
  await expect(listItem).toBeVisible({ timeout: 60_000 });

  const agentIds = getAssistantAgentIds(user.id);
  const latestId = agentIds[agentIds.length - 1];
  const dbAssistant = getAssistantFromDb(latestId);

  expect(dbAssistant.firstName).toBe(customFirst);
  expect(dbAssistant.about).toBe(customAbout);
  // Nationality should still be from the preset (not cleared)
  expect(dbAssistant.nationality).toBeTruthy();
});
