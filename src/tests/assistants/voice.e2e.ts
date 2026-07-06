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
  openAccordionSection,
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

async function selectedVoiceOptionId(page: import('@playwright/test').Page, index: number) {
  await openAccordionSection(page, 'voice');
  const voiceOption = page.locator('[data-testid^="voice-option-"]').nth(index);
  await expect(voiceOption).toBeVisible({ timeout: 15_000 });
  await voiceOption.scrollIntoViewIfNeeded();
  await voiceOption.click();
  const testId = await voiceOption.getAttribute('data-testid');
  return testId?.replace('voice-option-', '') ?? null;
}

test('hiring with a selected voice assigns that voice_id in the database', async ({
  authedPage: page,
}) => {
  const firstName = `Voice${Date.now()}`;

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openHireDialog(page);

  await fillProfileFields(page, {
    firstName,
    lastName: 'WithVoice',
    about: 'Testing voice assignment during hire.',
  });

  const selectedVoiceId = await selectedVoiceOptionId(page, 0);
  expect(selectedVoiceId).toBeTruthy();

  await clickHireButton(page);
  await openUnitySwitcher(page);
  await expect(
    page.locator('[data-testid^="assistant-list-item-"]', { hasText: firstName })
  ).toBeVisible({ timeout: 60_000 });

  const agentIds = getAssistantAgentIds(user.id);
  const latestId = agentIds[agentIds.length - 1];
  const dbAssistant = getAssistantFromDb(latestId);

  expect(dbAssistant.voiceId).toBe(selectedVoiceId);
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

  await openAccordionSection(page, 'voice');
  const voiceCount = await page.locator('[data-testid^="voice-option-"]').count();
  const targetIndex = voiceCount >= 2 ? 1 : 0;
  const selectedVoiceId = await selectedVoiceOptionId(page, targetIndex);
  expect(selectedVoiceId).toBeTruthy();

  await clickHireButton(page);
  await openUnitySwitcher(page);
  await expect(
    page.locator('[data-testid^="assistant-list-item-"]', { hasText: firstName })
  ).toBeVisible({ timeout: 60_000 });

  const agentIds = getAssistantAgentIds(user.id);
  const latestId = agentIds[agentIds.length - 1];
  const dbAssistant = getAssistantFromDb(latestId);

  expect(dbAssistant.voiceId).toBe(selectedVoiceId);
});
