/**
 * Floating chat E2E — persistent bottom-right chat across app-shell routes.
 *
 * Run: npx playwright test src/tests/assistants/floating-chat.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  navigateToAssistants,
  closeHireDialogIfOpen,
  openUnitySwitcher,
  openRailSection,
  deleteAllAssistantsForUser,
  ensureProjectSync,
} from './helpers';
import { createContactSeeder, createOpenAssistantChat } from './chat-helpers';

const user = createTestUser({ name: 'FloatChatE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'FloatBot',
  surname: 'E2E',
});
const secondAssistant = createAssistant({
  userId: user.id,
  firstName: 'AltBot',
  surname: 'E2E',
});

const CONTACT_ID = assistant.bossContactId;
const seedContact = createContactSeeder(CONTACT_ID);
const openAssistantChat = createOpenAssistantChat(assistant);

test.afterAll(() => {
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

async function expandFloatingChat(page: import('@playwright/test').Page) {
  const launcher = page.getByTestId('floating-chat-launcher');
  await expect(launcher).toBeVisible({ timeout: 15_000 });
  await launcher.click();
  await expect(page.getByTestId('floating-chat-panel')).toBeVisible({ timeout: 10_000 });
}

async function openSettingsFromRail(page: import('@playwright/test').Page) {
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('rail-unity-switcher-popover')).toHaveCount(0, { timeout: 5_000 });
  await page.getByTestId('rail-nav-settings').click();
  await expect(page).toHaveURL(/\/account/, { timeout: 15_000 });
}

test('floating chat persists on settings and sends messages @push @area(assistants.chat)', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);
  await seedContact(
    user.apiKey,
    user.id,
    secondAssistant.agentId,
    user.email,
    secondAssistant.bossContactId
  );

  await openAssistantChat(page);
  await openSettingsFromRail(page);
  await expandFloatingChat(page);

  const textarea = page.getByTestId('floating-chat-panel').locator('textarea');
  await expect(textarea).toBeEnabled({ timeout: 20_000 });

  const testMessage = `Floating chat E2E ${Date.now()}`;
  await textarea.fill(testMessage);
  await textarea.press('Enter');
  await expect(page.getByTestId('floating-chat-panel').getByText(testMessage)).toBeVisible({
    timeout: 10_000,
  });
});

test('floating chat hides on full-page chat and shows on other tabs', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);
  await openAssistantChat(page);

  await expect(page.getByTestId('floating-chat-launcher')).toHaveCount(0, { timeout: 10_000 });

  await openRailSection(page, 'tasks');
  await expect(page.getByTestId('floating-chat-launcher')).toBeVisible({ timeout: 10_000 });

  await openRailSection(page, 'chat');
  await expect(page.getByTestId('floating-chat-launcher')).toHaveCount(0, { timeout: 10_000 });
});

test('back to chat opens full-page chat and hides the floater', async ({ authedPage: page }) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);
  await openAssistantChat(page);
  await openSettingsFromRail(page);
  await expandFloatingChat(page);

  await page.getByTestId('floating-chat-back-to-full').click();
  await expect(page).toHaveURL(/\/assistants/, { timeout: 15_000 });
  await expect(page.getByTestId('floating-chat-launcher')).toHaveCount(0, { timeout: 10_000 });
  await expect(page.locator('textarea').first()).toBeVisible({ timeout: 15_000 });
});

test('global rail switcher changes floating chat assistant on settings', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);
  await seedContact(
    user.apiKey,
    user.id,
    secondAssistant.agentId,
    user.email,
    secondAssistant.bossContactId
  );

  await openAssistantChat(page);
  await openSettingsFromRail(page);
  await expandFloatingChat(page);
  await expect(page.getByTestId('floating-chat-panel')).toContainText('FloatBot');

  await expect(page.getByTestId('rail-unity-switcher-loading')).toHaveCount(0, { timeout: 20_000 });
  await openUnitySwitcher(page);
  await page.getByTestId(`assistant-list-item-${secondAssistant.agentId}`).click();
  await expect(page.getByTestId('floating-chat-panel')).toContainText('AltBot', {
    timeout: 10_000,
  });
});

test('floating chat hides while hire dialog is open', async ({ authedPage: page }) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openRailSection(page, 'tasks');
  await expect(page.getByTestId('floating-chat-launcher')).toBeVisible({ timeout: 10_000 });

  await openUnitySwitcher(page);
  await page.getByTestId('assistant-onboard-button').click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('floating-chat-launcher')).toHaveCount(0, { timeout: 5_000 });
});
