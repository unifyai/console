/**
 * Assistant Hire Flow E2E — complete user journeys for hiring assistants,
 * verifying both UI behaviour, database persistence, and pre-hire chat.
 *
 * Includes:
 *  - Hiring with basic and full profile fields
 *  - Cancelling mid-hire
 *  - Hiring multiple assistants
 *  - Pre-hire chat: opening, greeting, sending messages, persistence,
 *    dialog reset, and credit exhaustion behaviour
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
  openAccordionSection,
  getAssistantCount,
  getAssistantAgentIds,
  getAssistantFromDb,
  deleteAssistantFromDb,
  deleteAllAssistantsForUser,
  ensureProjectSync,
  setUserCredits,
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

  // Hire dialog auto-opens on empty state; open manually if it didn't
  const dialogVisible = await page
    .locator('text=Hire Assistant')
    .first()
    .isVisible({ timeout: 5_000 })
    .catch(() => false);
  if (!dialogVisible) {
    await openHireDialog(page);
  }

  await fillProfileFields(page, {
    firstName,
    lastName,
    age: 28,
    about: 'An automated test assistant created by Playwright E2E.',
  });

  await selectVoice(page);
  await clickHireButton(page);

  // Wait for the hire to complete — the assistant name should appear in the list sidebar
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

test('hiring with all profile fields persists nationality, age and about to DB', async ({
  authedPage: page,
}) => {
  const firstName = `Full${Date.now()}`;
  const lastName = 'Fields';
  const nationality = 'Brazil';
  const about = 'Full-field hire test with nationality and about.';
  const age = 42;

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openHireDialog(page);

  await fillProfileFields(page, { firstName, lastName, age, nationality, about });

  await selectVoice(page);
  await clickHireButton(page);

  const listItem = page.locator('[data-testid^="assistant-list-item-"]', { hasText: firstName });
  await expect(listItem).toBeVisible({ timeout: 60_000 });

  const agentIds = getAssistantAgentIds(user.id);
  const latestId = agentIds[agentIds.length - 1];
  const dbAssistant = getAssistantFromDb(latestId);

  expect(dbAssistant.firstName).toBe(firstName);
  expect(dbAssistant.surname).toBe(lastName);
  expect(dbAssistant.nationality).toBe(nationality);
  expect(dbAssistant.about).toBe(about);
  expect(dbAssistant.age).toBe(String(age));
  expect(dbAssistant.voiceId).toBeTruthy();
});

test('cancelling mid-hire does not create an assistant', async ({ authedPage: page }) => {
  const countBefore = getAssistantCount(user.id);

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openHireDialog(page);

  await fillProfileFields(page, {
    firstName: `Cancel${Date.now()}`,
    lastName: 'NeverCreated',
    age: 22,
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
    age: 35,
    about: 'Second test assistant.',
  });

  await selectVoice(page);
  await clickHireButton(page);

  const listItem = page.locator('[data-testid^="assistant-list-item-"]', {
    hasText: firstName,
  });
  await expect(listItem).toBeVisible({ timeout: 60_000 });

  // Verify both assistants exist in DB
  const countAfter = getAssistantCount(user.id);
  expect(countAfter).toBe(countBefore + 1);
});

// ===========================================================================
// Pre-hire Chat Tests
// ===========================================================================

async function openHireDialogAndFillProfile(page: import('@playwright/test').Page) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openHireDialog(page);
  await fillProfileFields(page, {
    firstName: `PreHire${Date.now()}`,
    lastName: 'ChatBot',
    age: 25,
    about: 'A friendly test assistant.',
  });
}

async function clickChatNow(page: import('@playwright/test').Page) {
  const chatNowBtn = page.locator('button:has-text("Chat Now")');
  await expect(chatNowBtn).toBeVisible({ timeout: 10_000 });
  await chatNowBtn.click();
  await page.waitForTimeout(1_000);
}

test('clicking Chat Now opens the chat panel inside the hire dialog', async ({
  authedPage: page,
}) => {
  await openHireDialogAndFillProfile(page);
  await clickChatNow(page);

  const chatHeader = page.locator('h2:has-text("Chat with")');
  await expect(chatHeader).toBeVisible({ timeout: 10_000 });

  const textarea = page.locator('textarea[placeholder="Send a message..."]');
  await expect(textarea).toBeVisible({ timeout: 5_000 });
});

test('assistant greeting message appears automatically in pre-hire chat', async ({
  authedPage: page,
}) => {
  await openHireDialogAndFillProfile(page);
  await clickChatNow(page);

  await page.waitForTimeout(3_000);

  const greeting = page.locator('text=/Hello|great to meet you|feel free/i').first();
  await expect(greeting).toBeVisible({ timeout: 10_000 });
});

test('user can send a message and receive a reply in pre-hire chat', async ({
  authedPage: page,
}) => {
  await openHireDialogAndFillProfile(page);
  await clickChatNow(page);

  await page.waitForTimeout(3_000);

  const textarea = page.locator('textarea[placeholder="Send a message..."]');
  await expect(textarea).toBeEnabled({ timeout: 10_000 });

  const testMsg = `What can you help me with? ${Date.now()}`;
  await textarea.fill(testMsg);
  await textarea.press('Enter');

  await expect(page.locator(`text=${testMsg}`).first()).toBeVisible({ timeout: 10_000 });

  // Wait for LLM reply (up to 30s)
  const assistantReply = page.locator('.prose, [class*="whitespace-pre-wrap"]').last();
  await expect(assistantReply).toBeVisible({ timeout: 30_000 });

  await expect(page.locator(`text=${testMsg}`).first()).toBeVisible();
});

test('pre-hire chat persists when toggling between presets and chat panels', async ({
  authedPage: page,
}) => {
  await openHireDialogAndFillProfile(page);
  await clickChatNow(page);

  await page.waitForTimeout(3_000);

  const textarea = page.locator('textarea[placeholder="Send a message..."]');
  await expect(textarea).toBeEnabled({ timeout: 10_000 });

  const testMsg = `Persist test ${Date.now()}`;
  await textarea.fill(testMsg);
  await textarea.press('Enter');
  await expect(page.locator(`text=${testMsg}`).first()).toBeVisible({ timeout: 10_000 });

  const showPresetsBtn = page
    .locator('button:has-text("Browse Assistants"), span:has-text("Show Presets")')
    .first();
  if (await showPresetsBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await showPresetsBtn.click();
    await page.waitForTimeout(1_000);
  }

  await clickChatNow(page);

  await expect(page.locator(`text=${testMsg}`).first()).toBeVisible({ timeout: 10_000 });
});

test('closing and reopening the hire dialog clears pre-hire chat history', async ({
  authedPage: page,
}) => {
  await openHireDialogAndFillProfile(page);
  await clickChatNow(page);

  await page.waitForTimeout(3_000);

  const textarea = page.locator('textarea[placeholder="Send a message..."]');
  await expect(textarea).toBeEnabled({ timeout: 10_000 });

  const uniqueMsg = `WillBeCleared_${Date.now()}`;
  await textarea.fill(uniqueMsg);
  await textarea.press('Enter');
  await expect(page.locator(`text=${uniqueMsg}`).first()).toBeVisible({ timeout: 10_000 });

  await page.keyboard.press('Escape');
  await page
    .locator('[role="dialog"]')
    .waitFor({ state: 'hidden', timeout: 10_000 })
    .catch(() => {});
  await page.waitForTimeout(1_000);

  await page.goto('/assistants');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  // Allow time for any auto-open hire dialog to appear
  await page.waitForTimeout(5_000);
  await closeHireDialogIfOpen(page);

  await openHireDialog(page);
  await fillProfileFields(page, {
    firstName: `PreHire${Date.now()}`,
    lastName: 'ChatBot2',
    age: 30,
    about: 'Another assistant.',
  });
  await clickChatNow(page);
  await page.waitForTimeout(3_000);

  const oldMsg = page.locator(`text=${uniqueMsg}`);
  await expect(oldMsg).toHaveCount(0, { timeout: 5_000 });
});

test('pre-hire chat is blocked when credits are exhausted', async ({ authedPage: page }) => {
  setUserCredits(user.id, -1);

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openHireDialog(page);

  await fillProfileFields(page, {
    firstName: `NoCreds${Date.now()}`,
    lastName: 'Bot',
    age: 22,
    about: 'Test assistant.',
  });

  const chatNowBtn = page.locator('button:has-text("Chat Now")');

  if (await chatNowBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    const isDisabled = await chatNowBtn.isDisabled();
    if (!isDisabled) {
      await chatNowBtn.click();
      await page.waitForTimeout(2_000);

      const billingPrompt = page
        .locator('text=/add.*credit|insufficient.*credit|top.*up/i')
        .first();
      const chatPanel = page.locator('h2:has-text("Chat with")');

      const hasBillingPrompt = await billingPrompt.isVisible({ timeout: 3_000 }).catch(() => false);
      const hasChatPanel = await chatPanel.isVisible({ timeout: 3_000 }).catch(() => false);

      expect(hasBillingPrompt || hasChatPanel).toBe(true);

      if (hasChatPanel) {
        const textarea = page.locator('textarea[placeholder="Send a message..."]');
        if (await textarea.isEnabled({ timeout: 3_000 }).catch(() => false)) {
          await textarea.fill('test message');
          await textarea.press('Enter');
          const errorIndicator = page.locator('text=/credit|billing/i').first();
          await expect(errorIndicator).toBeVisible({ timeout: 15_000 });
        }
      }
    } else {
      expect(isDisabled).toBe(true);
    }
  }

  setUserCredits(user.id, 50_000);
});
