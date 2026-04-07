/**
 * Assistant Profile E2E — verify that clicking an assistant in the list
 * opens the chat panel with the assistant name header, that the deep link
 * via ?profile=<agentId> works, and that the hover card shows key info.
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

test('clicking an assistant shows the chat panel with assistant name in header', async ({
  authedPage: page,
}) => {
  const db = getAssistantFromDb(assistant.agentId);

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const listItem = page.getByTestId(`assistant-list-item-${assistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();
  await page.waitForTimeout(1_500);

  // The panel header shows the assistant's full name
  await expect(page.locator(`text=${db.firstName}`).first()).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(`text=${db.surname}`).first()).toBeVisible({ timeout: 5_000 });

  // Chat area should be visible (it's now the only content in the panel)
  const chatArea = page.getByTestId('chat-scroll-area');
  await expect(chatArea).toBeVisible({ timeout: 5_000 });

  // Call buttons should be visible in the panel header
  await expect(page.getByTestId('call-audio-button')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('call-video-button')).toBeVisible({ timeout: 5_000 });
});

test('deep link ?profile=agentId opens the correct assistant profile', async ({
  authedPage: page,
}) => {
  const db = getAssistantFromDb(assistant.agentId);

  await page.goto(`/assistants?profile=${assistant.agentId}`);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
  await closeHireDialogIfOpen(page);

  // The panel header should show the assistant name
  await expect(page.locator(`text=${db.firstName}`).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(`text=${db.surname}`).first()).toBeVisible({ timeout: 5_000 });
});

test('assistant list item dropdown menu has edit, contacts, and secrets options', async ({
  authedPage: page,
}) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const listItem = page.getByTestId(`assistant-list-item-${assistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });

  // Open the dropdown menu
  const menuBtn = page.getByTestId(`assistant-menu-${assistant.agentId}`);
  await listItem.hover();
  await expect(menuBtn).toBeVisible({ timeout: 5_000 });
  await menuBtn.click();
  await page.waitForTimeout(500);

  // Verify all three menu items are visible
  await expect(page.getByTestId('menu-edit-profile')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('menu-update-contacts')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('menu-manage-secrets')).toBeVisible({ timeout: 5_000 });
});
