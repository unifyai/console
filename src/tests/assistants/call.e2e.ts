/**
 * Call E2E Tests — browser-based user flows for starting/hanging up calls
 * and for unify_meet call pills in the assistant chat timeline.
 *
 * Verifies:
 *  - Clicking the audio call button opens the communication dialog with controls
 *  - Hanging up closes the dialog and resets UI state
 *  - Call buttons are disabled when spending is blocked, re-enable after funding
 *  - Hanging up and re-calling the same assistant works
 *  - Historical call pills render in the chat timeline
 *  - Clicking a call pill opens the transcript dialog with utterances
 *  - Call pills interleave correctly with text messages by timestamp
 *
 * Local mode: LiveKit credentials are absent, so the server action returns
 * localMode: true. The hook skips room.connect() and sets isConnected
 * immediately, allowing the call dialog to render without a real media server.
 *
 * Run: npx playwright test src/tests/assistants/call.e2e.ts
 */

import { expect } from '@playwright/test';
import { createContactSeeder, createTranscriptSeeder } from './chat-helpers';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  createOrg,
  createTeamForAssistant,
  navigateToAssistants,
  closeHireDialogIfOpen,
  switchWorkspace,
  selectAssistantInList,
  deleteAllAssistantsForUser,
  ensureProjectSync,
  setUserCredits,
  openUnitySwitcher,
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
const ASSISTANT_CONTACT_ID = assistant.selfContactId;
const CONTACT_ID = assistant.bossContactId;

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
  await expect(page.getByTestId('chat-scroll-area')).toBeVisible({ timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Call pill seed helpers (unified chat/call store)
// ---------------------------------------------------------------------------

const seedContact = createContactSeeder(CONTACT_ID);
const seedTranscript = createTranscriptSeeder({
  selfContactId: ASSISTANT_CONTACT_ID,
  bossContactId: CONTACT_ID,
});

async function openAssistantChat(
  page: import('@playwright/test').Page,
  targetAssistant: { agentId: number } = assistant
) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);

  const listItem = page.getByTestId(`assistant-list-item-${targetAssistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();
  await page.waitForTimeout(2_000);

  const chatArea = page.getByTestId('chat-scroll-area');
  await expect(chatArea).toBeVisible({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Call dialog tests
// ---------------------------------------------------------------------------

test('clicking audio call button opens the communication dialog @critical @area(assistants.call)', async ({
  authedPage: page,
}) => {
  await openAssistantProfile(page, assistant.agentId);

  const audioBtn = page.getByTestId('call-audio-button');
  await expect(audioBtn).toBeVisible({ timeout: 10_000 });
  await expect(audioBtn).toBeEnabled();
  await audioBtn.click();

  const header = page.locator('text=Talk to Caller TestBot');
  const hangUp = page.getByRole('button', { name: 'Hang up' });
  const failureToast = page.getByText('Failed to start call. Please try again.');
  await expect
    .poll(
      async () => {
        if (await hangUp.isVisible().catch(() => false)) return 'ready';
        if (await failureToast.isVisible().catch(() => false)) return 'failed';
        return 'pending';
      },
      { timeout: 45_000 }
    )
    .toBe('ready');

  await expect(hangUp).toBeVisible({ timeout: 10_000 });

  const chatToggle = page.getByRole('button', { name: 'Toggle chat' });
  await expect(chatToggle).toBeVisible({ timeout: 10_000 });

  const settingsToggle = page.getByRole('button', { name: 'Toggle settings' });
  await expect(settingsToggle).toBeVisible({ timeout: 10_000 });

  const micBtn = page.locator('button[aria-label*="icrophone"], button[aria-label*="ute mic"]');
  const micVisible = await micBtn
    .first()
    .isVisible({ timeout: 5_000 })
    .catch(() => false);
  if (micVisible) {
    await expect(micBtn.first()).toBeVisible();
  }

  await expect(page.getByTestId('assistant-call-docked-region')).toBeVisible();
  await expect(page.getByTestId('assistant-chat-during-call-region')).toBeVisible();
  await expect(page.getByTestId('chat-scroll-area')).toBeVisible();
  await expect(page.getByTestId('assistant-call-self-view')).toHaveCount(0);

  const endCallBtn = page.getByRole('button', { name: 'End call' });
  await endCallBtn.click();
  await expect(header).not.toBeVisible({ timeout: 10_000 });
});

test('hanging up closes the dialog and returns to the chat view @critical @area(assistants.call)', async ({
  authedPage: page,
}) => {
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

  // The assistant should still be selected in the list (inside the switcher)
  await openUnitySwitcher(page);
  const listItem = page.getByTestId(`assistant-list-item-${assistant.agentId}`);
  await expect(listItem).toBeVisible();
});

test('unsent chat draft survives hanging up a docked call', async ({ authedPage: page }) => {
  await openAssistantProfile(page, assistant.agentId);

  const audioBtn = page.getByTestId('call-audio-button');
  await audioBtn.click();

  const header = page.locator('text=Talk to Caller TestBot');
  await expect(header).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('assistant-chat-during-call-region')).toBeVisible();

  const draftText = 'Follow up after the call';
  const composer = page
    .getByTestId('assistant-chat-during-call-region')
    .getByPlaceholder('Send a message...');
  await composer.fill(draftText);

  const endCallBtn = page.getByRole('button', { name: 'End call' });
  await endCallBtn.click();
  await expect(header).not.toBeVisible({ timeout: 10_000 });

  await expect(composer).toHaveValue(draftText);
});

test('call button is disabled when credits are exhausted and re-enables after funding', async ({
  authedPage: page,
}) => {
  setUserCredits(user.id, -1);

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await selectAssistantInList(page, assistant.agentId);
  await page.waitForTimeout(2_000);

  const audioBtn = page.getByTestId('call-audio-button');
  await expect(audioBtn).toBeVisible({ timeout: 10_000 });
  await expect(audioBtn).toBeDisabled({ timeout: 20_000 });

  setUserCredits(user.id, 50_000);
  await page.waitForTimeout(3_000);

  await expect(audioBtn).toBeEnabled({ timeout: 20_000 });
  await audioBtn.click();

  const header = page.locator('text=Talk to Caller TestBot');
  await expect(header).toBeVisible({ timeout: 30_000 });

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

test('call persists with mini chat across page navigation and redocks on return', async ({
  authedPage: page,
}) => {
  await openAssistantProfile(page, assistant.agentId);

  // Start a call — it docks into the chat slot on /assistants.
  const audioBtn = page.getByTestId('call-audio-button');
  await expect(audioBtn).toBeEnabled({ timeout: 15_000 });
  await audioBtn.click();

  const header = page.locator('text=Talk to Caller TestBot');
  await expect(header).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('assistant-call-docked')).toBeVisible({ timeout: 10_000 });

  // Navigate to /account via client-side nav. A full page load would tear down
  // the (home) layout and kill the call, so the test must exercise real SPA
  // navigation.
  await page.keyboard.press('Escape');
  await page.getByTestId('rail-nav-settings').click();
  await expect(page).toHaveURL(/\/account/, { timeout: 15_000 });

  // Off /assistants the call UI is suppressed; audio continues and the floating
  // chat launcher carries the visible surface.
  await expect(header).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Hang up' })).toHaveCount(0);
  await expect(page.getByTestId('assistant-call-docked')).toHaveCount(0);
  await expect
    .poll(async () => page.evaluate(() => sessionStorage.getItem('console:call-active')), {
      timeout: 15_000,
    })
    .toBe('1');

  const launcher = page.getByTestId('floating-chat-launcher');
  await expect(launcher).toBeVisible({ timeout: 10_000 });
  await launcher.click();
  await page.getByTestId('floating-chat-back-to-full').click();

  await expect(page).toHaveURL(/\/assistants/, { timeout: 15_000 });
  await expect(page.getByTestId('assistant-call-docked')).toBeVisible({ timeout: 30_000 });
  await expect(header).toBeVisible({ timeout: 10_000 });

  // Cleanup.
  await page.getByTestId('assistant-call-docked').getByRole('button', { name: 'End call' }).click();
  await expect(header).not.toBeVisible({ timeout: 15_000 });
});

// ---------------------------------------------------------------------------
// Call pill tests
// ---------------------------------------------------------------------------

test('historical call pill renders from the unified call store', async ({ authedPage: page }) => {
  const callOrg = createOrg({ name: `CallSharedOrg_${Date.now()}`, ownerId: user.id });
  ensureProjectSync(callOrg.ownerOrgApiKey);
  await switchWorkspace(page, callOrg.id);
  await page.goto('/assistants');
  await closeHireDialogIfOpen(page);

  const sharedAssistant = createAssistant({
    userId: user.id,
    orgId: callOrg.id,
    firstName: 'SharedCall',
    surname: `E2E${Date.now()}`,
  });
  await seedContact(
    callOrg.ownerOrgApiKey,
    user.id,
    sharedAssistant.agentId,
    user.email,
    sharedAssistant.bossContactId
  );
  createTeamForAssistant(sharedAssistant, {
    name: `Call Root E2E ${Date.now()}`,
    description: 'Unified call store pill coverage',
    selfContactId: 370,
    bossContactId: 377,
  });

  const exchangeId = 12000 + Math.floor(Math.random() * 10000);
  const callId = `e2e-call-${sharedAssistant.agentId}-${exchangeId}`;

  await seedTranscript(callOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
    senderId: sharedAssistant.bossContactId,
    content: 'Visible call message',
    medium: 'unify_meet',
    exchangeId,
    selfContactId: sharedAssistant.selfContactId,
    metadata: { call_utterance_timestamp: '00.00' },
  });
  await seedTranscript(callOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
    senderId: sharedAssistant.selfContactId,
    content: 'Visible call reply',
    medium: 'unify_meet',
    exchangeId,
    selfContactId: sharedAssistant.selfContactId,
    metadata: { call_utterance_timestamp: '00.25' },
  });

  await openAssistantChat(page, sharedAssistant);

  await expect(page.locator(`[data-call-id="${callId}"]`)).toBeVisible({
    timeout: 20_000,
  });

  const pillButton = page.getByTestId('call-pill-button').first();
  await expect(pillButton).toBeVisible();
  const pillText = await pillButton.textContent();
  expect(pillText).toContain('Call');
});

test('clicking a call pill opens transcript dialog with utterances', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  const ts = Date.now();
  const exchangeId = 101;

  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: CONTACT_ID,
    content: `E2E pill click test user ${ts}`,
    medium: 'unify_meet',
    exchangeId,
  });
  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: ASSISTANT_CONTACT_ID,
    content: `E2E pill click test assistant ${ts}`,
    medium: 'unify_meet',
    exchangeId,
  });

  await openAssistantChat(page);

  const pillButton = page.getByTestId('call-pill-button').first();
  await expect(pillButton).toBeVisible({ timeout: 20_000 });
  await pillButton.click();

  const dialog = page.getByTestId('call-transcript-dialog');
  await expect(dialog).toBeVisible({ timeout: 10_000 });

  const content = page.getByTestId('call-transcript-content');
  await expect(content).toBeVisible({ timeout: 15_000 });

  const utterances = page.getByTestId('call-transcript-utterance');
  const count = await utterances.count();
  expect(count).toBeGreaterThanOrEqual(2);
});

test('call pills interleave correctly with text messages by timestamp', async ({
  authedPage: page,
}) => {
  const interleaveAssistant = createAssistant({
    userId: user.id,
    firstName: 'Interleave',
    surname: `E2E${Date.now()}`,
  });
  const interleaveContactId = interleaveAssistant.bossContactId;
  const interleaveSelfContactId = interleaveAssistant.selfContactId;
  await seedContact(
    user.apiKey,
    user.id,
    interleaveAssistant.agentId,
    user.email,
    interleaveContactId
  );

  const ts = Date.now();
  const exchangeId = 30000 + Math.floor(Math.random() * 10000);

  // Sequential seeding gives monotonically increasing server timestamps, so
  // the timeline interleaves text → call → text.
  await seedTranscript(user.apiKey, user.id, interleaveAssistant.agentId, {
    senderId: interleaveContactId,
    content: `Text before call ${ts}`,
    medium: 'unify_message',
    selfContactId: interleaveSelfContactId,
  });

  await seedTranscript(user.apiKey, user.id, interleaveAssistant.agentId, {
    senderId: interleaveContactId,
    content: 'Call utterance',
    medium: 'unify_meet',
    exchangeId,
    selfContactId: interleaveSelfContactId,
  });
  await seedTranscript(user.apiKey, user.id, interleaveAssistant.agentId, {
    senderId: interleaveSelfContactId,
    content: 'Call reply',
    medium: 'unify_meet',
    exchangeId,
    selfContactId: interleaveSelfContactId,
  });

  await seedTranscript(user.apiKey, user.id, interleaveAssistant.agentId, {
    senderId: interleaveSelfContactId,
    content: `Text after call ${ts}`,
    medium: 'unify_message',
    selfContactId: interleaveSelfContactId,
  });

  await openAssistantChat(page, interleaveAssistant);

  await expect(page.locator(`text=Text before call ${ts}`).first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator(`text=Text after call ${ts}`).first()).toBeVisible({ timeout: 10_000 });
  const callPill = page.getByTestId('call-pill').first();
  await expect(callPill).toBeVisible({ timeout: 10_000 });

  const chatArea = page.getByTestId('chat-scroll-area');
  const allElements = chatArea.locator('[data-testid="message-bubble"], [data-testid="call-pill"]');
  const sequence = await allElements.evaluateAll((nodes) =>
    nodes.map((node) => ({
      testId: node.getAttribute('data-testid'),
      text: node.textContent ?? '',
    }))
  );

  const beforeIdx = sequence.findIndex((item) => item.text.includes(`Text before call ${ts}`));
  const pillIdx = sequence.findIndex((item) => item.testId === 'call-pill');
  const afterIdx = sequence.findIndex((item) => item.text.includes(`Text after call ${ts}`));

  expect(beforeIdx).toBeGreaterThanOrEqual(0);
  expect(pillIdx).toBeGreaterThan(beforeIdx);
  expect(afterIdx).toBeGreaterThan(pillIdx);
});
