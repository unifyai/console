/**
 * Assistant Profile E2E — verify that clicking an assistant in the list
 * selects it and shows the Chat tab with the assistant name header, that
 * the deep link via ?profile=<agentId> works, and that the dropdown menu
 * shows key options.
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
  openUnitySwitcher,
  selectAssistantInList,
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

test('clicking an assistant shows the Chat tab with assistant name in header', async ({
  authedPage: page,
}) => {
  const db = getAssistantFromDb(assistant.agentId);

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  await selectAssistantInList(page, assistant.agentId);

  // The Chat section is active by default in the rail.
  await expect(page.getByTestId('rail-section-chat')).toHaveAttribute('aria-current', 'page', {
    timeout: 10_000,
  });

  // The chat header shows the assistant's full name
  await expect(page.locator(`text=${db.firstName}`).first()).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(`text=${db.surname}`).first()).toBeVisible({ timeout: 5_000 });

  // Chat area should be visible
  const chatArea = page.getByTestId('chat-scroll-area');
  await expect(chatArea).toBeVisible({ timeout: 5_000 });

  // The audio call button is visible in the chat header (calls are audio-only).
  await expect(page.getByTestId('call-audio-button')).toBeVisible({ timeout: 5_000 });
});

test('deep link ?profile=agentId opens the correct assistant profile', async ({
  authedPage: page,
}) => {
  const db = getAssistantFromDb(assistant.agentId);

  await page.goto(`/assistants?profile=${assistant.agentId}`);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
  await closeHireDialogIfOpen(page);

  // The chat header should show the assistant name
  await expect(page.locator(`text=${db.firstName}`).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(`text=${db.surname}`).first()).toBeVisible({ timeout: 5_000 });
});

test('assistant list item dropdown menu has edit and contacts options', async ({
  authedPage: page,
}) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  // The list (and its per-row kebab menu) lives in the switcher popover now.
  await openUnitySwitcher(page);
  const listItem = page.getByTestId(`assistant-list-item-${assistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });

  // Open the dropdown menu
  const menuBtn = page.getByTestId(`assistant-menu-${assistant.agentId}`);
  await listItem.hover();
  await expect(menuBtn).toBeVisible({ timeout: 5_000 });
  await menuBtn.click();
  await page.waitForTimeout(500);

  // Verify both remaining menu items are visible — secrets has moved to
  // a dedicated tab in the right-hand pane.
  await expect(page.getByTestId('menu-edit-profile')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('menu-update-contacts')).toBeVisible({ timeout: 5_000 });
});
