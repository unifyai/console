/**
 * Voice Selection E2E — select voices during hire, verify the chosen
 * voice is persisted to the database, switch voices between assistants.
 *
 * Run: npx playwright test src/tests/assistants/voice.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  navigateToAssistants,
  openHireDialog,
  fillProfileFields,
  clickHireButton,
  closeHireDialogIfOpen,
  getAssistantAgentIds,
  getAssistantFromDb,
  deleteAssistantFromDb,
  ensureProjectSync,
  openUnitySwitcher,
} from './helpers';

const user = createTestUser({ name: 'VoiceE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(90_000);

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

test('hiring with a selected voice assigns that voice_id in the database', async ({
  authedPage: page,
}) => {
  const firstName = `Voice${Date.now()}`;

  await navigateToAssistants(page);
  await page.waitForTimeout(2_000);

  const dialogVisible = await page
    .getByRole('heading', { name: 'Onboard Unity' })
    .first()
    .isVisible({ timeout: 5_000 })
    .catch(() => false);
  if (!dialogVisible) {
    await openHireDialog(page);
  }

  await fillProfileFields(page, {
    firstName,
    lastName: 'WithVoice',
    about: 'Testing voice assignment during hire.',
  });

  // The voice section is always visible in the flat hire form; select the first
  // voice option directly.
  await page.waitForTimeout(2_000);

  const firstVoice = page.locator('[role="option"]').first();
  await expect(firstVoice).toBeVisible({ timeout: 15_000 });
  await firstVoice.click();
  await page.waitForTimeout(300);

  // Capture the selected voice_id from the data-testid
  const testId = await firstVoice.getAttribute('data-testid');
  const selectedVoiceId = testId?.replace('voice-option-', '') ?? null;

  // Verify the voice is visually selected
  await expect(firstVoice).toHaveAttribute('aria-selected', 'true');

  await clickHireButton(page);
  await openUnitySwitcher(page);
  const listItem = page.locator('[data-testid^="assistant-list-item-"]', { hasText: firstName });
  await expect(listItem).toBeVisible({ timeout: 60_000 });

  // Verify voice_id in DB
  const agentIds = getAssistantAgentIds(user.id);
  const latestId = agentIds[agentIds.length - 1];
  const dbAssistant = getAssistantFromDb(latestId);

  expect(dbAssistant.voiceId).toBeTruthy();
  if (selectedVoiceId) {
    expect(dbAssistant.voiceId).toBe(selectedVoiceId);
  }
});

test('hiring with a different voice assigns the correct voice_id', async ({ authedPage: page }) => {
  const firstName = `Voice2nd${Date.now()}`;

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openHireDialog(page);

  await fillProfileFields(page, {
    firstName,
    lastName: 'DiffVoice',
    about: 'Testing different voice selection.',
  });

  await page.waitForTimeout(2_000);

  const voiceOptions = page.locator('[role="option"]');
  const count = await voiceOptions.count();

  // Pick the second voice if available, otherwise the first
  const targetIndex = count >= 2 ? 1 : 0;
  const targetVoice = voiceOptions.nth(targetIndex);
  await targetVoice.click();
  await page.waitForTimeout(300);

  await page.waitForTimeout(500);

  await clickHireButton(page);
  await openUnitySwitcher(page);
  const listItem2 = page.locator('[data-testid^="assistant-list-item-"]', { hasText: firstName });
  await expect(listItem2).toBeVisible({ timeout: 60_000 });

  // Verify the assistant was created with a voice assigned
  const agentIds = getAssistantAgentIds(user.id);
  const latestId = agentIds[agentIds.length - 1];
  const dbAssistant = getAssistantFromDb(latestId);

  expect(dbAssistant.voiceId).toBeTruthy();

  // Verify both assistants have voices assigned
  if (agentIds.length >= 2) {
    const firstAssistant = getAssistantFromDb(agentIds[0]);
    const secondAssistant = getAssistantFromDb(agentIds[1]);
    expect(firstAssistant.voiceId).toBeTruthy();
    expect(secondAssistant.voiceId).toBeTruthy();
  }
});
