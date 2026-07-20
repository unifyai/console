/**
 * Assistant info-panel chat E2E.
 *
 * The assistant chat previously rendered as a persistent bottom-right floater.
 * It now lives beside Profile and Onboarding in the assistant info panel.
 */

import { expect } from '@playwright/test';
import {
  createAssistant,
  createAssistantTest,
  createTestUser,
  deleteAllAssistantsForUser,
  ensureProjectSync,
  cleanupUser,
  navigateToAssistants,
  openRailSection,
} from './helpers';
import { createContactSeeder, createOpenAssistantChat } from './chat-helpers';

const user = createTestUser({ name: 'InfoChatE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'InfoBot',
  surname: 'E2E',
});
const seedContact = createContactSeeder(assistant.bossContactId);
const openAssistantChat = createOpenAssistantChat(assistant);

test.afterAll(() => {
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

test('assistant chat is available from the info panel without a floating launcher', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);
  await openAssistantChat(page);
  await openRailSection(page, 'tasks');

  await expect(page.getByTestId('floating-chat-launcher')).toHaveCount(0);
  await expect(page.getByTestId('assistant-info-tab-chat')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('assistant-info-tab-chat').click();

  const textarea = page.getByTestId('assistant-info-sheet').locator('textarea');
  await expect(textarea).toBeEnabled({ timeout: 20_000 });

  const testMessage = `Info panel chat E2E ${Date.now()}`;
  await textarea.fill(testMessage);
  await textarea.press('Enter');
  await expect(page.getByTestId('assistant-info-sheet').getByText(testMessage)).toBeVisible({
    timeout: 10_000,
  });
});

test('chat tab remains available after returning to the assistants page', async ({
  authedPage: page,
}) => {
  await navigateToAssistants(page);
  await openRailSection(page, 'tasks');

  await expect(page.getByTestId('floating-chat-launcher')).toHaveCount(0);
  await expect(page.getByTestId('assistant-info-tab-chat')).toBeVisible({ timeout: 15_000 });
});
