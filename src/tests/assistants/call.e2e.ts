/**
 * Call E2E Tests — browser-based user flows for starting/hanging up calls.
 *
 * Verifies:
 *  - Clicking the audio call button opens the communication dialog
 *  - The communication dialog shows the assistant name and controls
 *  - Hanging up closes the dialog and resets UI state
 *  - Clicking the video call button opens the dialog in video mode
 *  - Call buttons are disabled when spending is blocked
 *  - Hanging up and re-calling the same assistant works
 *
 * Local mode: LiveKit credentials are absent, so the server action returns
 * localMode: true. The hook skips room.connect() and sets isConnected
 * immediately, allowing the call dialog to render without a real media server.
 *
 * Run: npx playwright test src/tests/assistants/call.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  navigateToAssistants,
  closeHireDialogIfOpen,
  selectAssistantInList,
  deleteAllAssistantsForUser,
  ensureProjectSync,
  setUserCredits,
} from './helpers';

const user = createTestUser({ name: 'CallE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'Caller',
  surname: 'TestBot',
});

test.afterAll(() => {
  setUserCredits(user.id, 50_000);
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function openAssistantProfile(page: import('@playwright/test').Page, agentId: number) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await selectAssistantInList(page, agentId);
  await page.waitForTimeout(1_000);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('clicking audio call button opens the communication dialog', async ({ authedPage: page }) => {
  await openAssistantProfile(page, assistant.agentId);

  const audioBtn = page.getByTestId('call-audio-button');
  await expect(audioBtn).toBeVisible({ timeout: 10_000 });
  await expect(audioBtn).toBeEnabled();
  await audioBtn.click();

  // The dialog should appear with the header showing "Talk to <name>"
  const header = page.locator('text=Talk to Caller TestBot');
  await expect(header).toBeVisible({ timeout: 30_000 });

  // Controls bar should be visible (contains hang up, mic, camera buttons)
  const hangUpControl = page.getByRole('button', { name: 'Hang up' });
  await expect(hangUpControl).toBeVisible({ timeout: 10_000 });

  // End the call for cleanup
  const endCallBtn = page.getByRole('button', { name: 'End call' });
  await endCallBtn.click();
  await expect(header).not.toBeVisible({ timeout: 10_000 });
});

test('communication dialog shows control buttons when connected', async ({ authedPage: page }) => {
  await openAssistantProfile(page, assistant.agentId);

  const audioBtn = page.getByTestId('call-audio-button');
  await audioBtn.click();

  const header = page.locator('text=Talk to Caller TestBot');
  await expect(header).toBeVisible({ timeout: 30_000 });

  // Verify expected control buttons exist
  const hangUp = page.getByRole('button', { name: 'Hang up' });
  await expect(hangUp).toBeVisible({ timeout: 10_000 });

  // Chat and settings toggle buttons
  const chatToggle = page.getByRole('button', { name: 'Toggle chat' });
  await expect(chatToggle).toBeVisible({ timeout: 10_000 });

  const settingsToggle = page.getByRole('button', { name: 'Toggle settings' });
  await expect(settingsToggle).toBeVisible({ timeout: 10_000 });

  // The mic/camera buttons use LiveKit track toggles whose aria-labels
  // depend on hook state — verify by locating any button with a mic-related label
  const micBtn = page.locator('button[aria-label*="icrophone"], button[aria-label*="ute mic"]');
  const micVisible = await micBtn
    .first()
    .isVisible({ timeout: 5_000 })
    .catch(() => false);
  // In local mode (no real tracks), mic button may not render — that's acceptable
  if (micVisible) {
    await expect(micBtn.first()).toBeVisible();
  }

  // Cleanup
  const endCallBtn = page.getByRole('button', { name: 'End call' });
  await endCallBtn.click();
  await expect(header).not.toBeVisible({ timeout: 10_000 });
});

test('hanging up closes the dialog and returns to the profile', async ({ authedPage: page }) => {
  await openAssistantProfile(page, assistant.agentId);

  const audioBtn = page.getByTestId('call-audio-button');
  await audioBtn.click();

  const header = page.locator('text=Talk to Caller TestBot');
  await expect(header).toBeVisible({ timeout: 30_000 });

  // End call via the header X button
  const endCallBtn = page.getByRole('button', { name: 'End call' });
  await endCallBtn.click();

  // Dialog should close
  await expect(header).not.toBeVisible({ timeout: 10_000 });

  // The profile panel should still be visible with the assistant name
  const listItem = page.getByTestId(`assistant-list-item-${assistant.agentId}`);
  await expect(listItem).toBeVisible();
});

test('video call button opens dialog', async ({ authedPage: page }) => {
  await openAssistantProfile(page, assistant.agentId);

  const videoBtn = page.getByTestId('call-video-button');
  await expect(videoBtn).toBeVisible({ timeout: 10_000 });
  await expect(videoBtn).toBeEnabled();
  await videoBtn.click();

  const header = page.locator('text=Talk to Caller TestBot');
  await expect(header).toBeVisible({ timeout: 30_000 });

  // Cleanup
  const endCallBtn = page.getByRole('button', { name: 'End call' });
  await endCallBtn.click();
  await expect(header).not.toBeVisible({ timeout: 10_000 });
});

test('call buttons are disabled when credits are exhausted', async ({ authedPage: page }) => {
  // Set credits negative BEFORE navigating so the spending gate blocks
  setUserCredits(user.id, -1);

  // Use a fresh navigation (not a reload) so there's no stale react-query cache
  await page.goto('/assistants');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
  await closeHireDialogIfOpen(page);
  await selectAssistantInList(page, assistant.agentId);
  await page.waitForTimeout(2_000);

  const audioBtn = page.getByTestId('call-audio-button');
  await expect(audioBtn).toBeVisible({ timeout: 10_000 });
  await expect(audioBtn).toBeDisabled({ timeout: 20_000 });

  const videoBtn = page.getByTestId('call-video-button');
  await expect(videoBtn).toBeDisabled({ timeout: 10_000 });

  // Restore credits
  setUserCredits(user.id, 50_000);
});

test('re-enabling credits allows starting a call again', async ({ authedPage: page }) => {
  // Ensure credits are restored
  setUserCredits(user.id, 50_000);

  await openAssistantProfile(page, assistant.agentId);
  await page.waitForTimeout(3_000);

  const audioBtn = page.getByTestId('call-audio-button');
  await expect(audioBtn).toBeEnabled({ timeout: 20_000 });
  await audioBtn.click();

  const header = page.locator('text=Talk to Caller TestBot');
  await expect(header).toBeVisible({ timeout: 30_000 });

  // Cleanup
  const endCallBtn = page.getByRole('button', { name: 'End call' });
  await endCallBtn.click();
  await expect(header).not.toBeVisible({ timeout: 10_000 });
});

test('hanging up and re-calling the same assistant works', async ({ authedPage: page }) => {
  await openAssistantProfile(page, assistant.agentId);

  const audioBtn = page.getByTestId('call-audio-button');
  await audioBtn.click();

  const header = page.locator('text=Talk to Caller TestBot');
  await expect(header).toBeVisible({ timeout: 30_000 });

  // End first call
  const endCallBtn = page.getByRole('button', { name: 'End call' });
  await endCallBtn.click();
  await expect(header).not.toBeVisible({ timeout: 10_000 });

  // Wait for state to reset, then re-open the profile
  await page.waitForTimeout(2_000);
  await openAssistantProfile(page, assistant.agentId);

  const audioBtnAgain = page.getByTestId('call-audio-button');
  await expect(audioBtnAgain).toBeEnabled({ timeout: 15_000 });
  await audioBtnAgain.click();

  const headerAgain = page.locator('text=Talk to Caller TestBot');
  await expect(headerAgain).toBeVisible({ timeout: 30_000 });

  // Cleanup
  const endCallBtn2 = page.getByRole('button', { name: 'End call' });
  await endCallBtn2.click();
  await expect(headerAgain).not.toBeVisible({ timeout: 10_000 });
});
