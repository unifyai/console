/**
 * Assistant Profile E2E — verify that clicking an assistant in the list
 * selects it and shows the Chat tab with the assistant name header, that
 * the deep link via ?profile=<agentId> works, and that the list unfold
 * control opens the assistant info panel.
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
  openAssistantInfoPanelFromList,
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

test('assistant list item unfold control opens the info panel', async ({ authedPage: page }) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  await openUnitySwitcher(page);
  const listItem = page.getByTestId(`assistant-list-item-${assistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });

  await openAssistantInfoPanelFromList(page, assistant.agentId);
  await expect(page.getByTestId('assistant-info-edit-profile')).toBeVisible({ timeout: 5_000 });
  await page.getByTestId('assistant-info-edit-profile').click();
  await expect(page.locator('[role="dialog"]').filter({ hasText: /^Edit / })).toHaveCount(0);
  await expect(page.getByTestId('assistant-info-edit-contact-section')).toBeVisible({
    timeout: 5_000,
  });
});
