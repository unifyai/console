/**
 * Chat search E2E Tests — browser-based user flows for searching a chat's
 * transcript history from the chat header search dialog.
 *
 * Verifies:
 *  - Search dialog opens from the chat header
 *  - Query matching, result navigation, and highlighting
 *  - Medium filters and shared-root (cross-identity) search
 *  - Empty-state when no results match
 *
 * Run: npx playwright test src/tests/assistants/chat-search.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  closeHireDialogIfOpen,
  switchWorkspace,
  deleteAllAssistantsForUser,
  createOrg,
  createTeamForAssistant,
  ensureProjectSync,
} from './helpers';
import {
  createContactSeeder,
  createTranscriptSeeder,
  createOpenAssistantChat,
} from './chat-helpers';

const user = createTestUser({ name: 'ChatSearchE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'ChatBot',
  surname: 'Search',
});
const ASSISTANT_CONTACT_ID = assistant.selfContactId;
const CONTACT_ID = assistant.bossContactId;

const seedContact = createContactSeeder(CONTACT_ID);
const seedTranscript = createTranscriptSeeder({
  selfContactId: ASSISTANT_CONTACT_ID,
  bossContactId: CONTACT_ID,
});
const openAssistantChat = createOpenAssistantChat(assistant);

test.afterAll(() => {
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

// ===========================================================================
// Chat Search Tests
// ===========================================================================

test('search bar in the chat header opens the search dialog', async ({ authedPage: page }) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  await openAssistantChat(page);

  const searchTrigger = page.getByTestId('chat-search-trigger');
  await expect(searchTrigger).toBeVisible({ timeout: 10_000 });
  await searchTrigger.click();

  const dialog = page.getByTestId('chat-search-dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });

  const input = page.getByTestId('chat-search-input');
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();
});

test('searching returns matching messages', async ({ authedPage: page }) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  const ts = Date.now();
  const unique = `SearchTest_${ts}`;

  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: CONTACT_ID,
    content: `Hello ${unique} from the user`,
    timestamp: new Date(ts - 5000).toISOString(),
  });
  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: ASSISTANT_CONTACT_ID,
    content: `Reply to ${unique} from assistant`,
    timestamp: new Date(ts - 3000).toISOString(),
  });
  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: CONTACT_ID,
    content: 'This should not match the search',
    timestamp: new Date(ts - 1000).toISOString(),
  });

  await openAssistantChat(page);

  const searchBtn = page.getByTestId('chat-search-trigger');
  await searchBtn.click();

  const input = page.getByTestId('chat-search-input');
  await input.fill(unique);

  const searchButton = page.getByTestId('chat-search-button');
  await searchButton.click();

  const results = page.getByTestId('chat-search-result-item');
  await expect(results.first()).toBeVisible({ timeout: 15_000 });

  const count = await results.count();
  expect(count).toBe(2);

  const highlights = page.locator('mark');
  const highlightCount = await highlights.count();
  expect(highlightCount).toBeGreaterThanOrEqual(2);
});

test('shared-root search hides foreign-authored rows while keeping null-authored rows', async ({
  authedPage: page,
}) => {
  const chatOrg = createOrg({ name: `ChatSearchOrg_${Date.now()}`, ownerId: user.id });
  ensureProjectSync(chatOrg.ownerOrgApiKey);
  await switchWorkspace(page, chatOrg.id);
  await page.goto('/assistants');
  await closeHireDialogIfOpen(page);

  const sharedAssistant = createAssistant({
    userId: user.id,
    orgId: chatOrg.id,
    firstName: 'SharedSearch',
    surname: `E2E${Date.now()}`,
  });
  await seedContact(
    chatOrg.ownerOrgApiKey,
    user.id,
    sharedAssistant.agentId,
    user.email,
    sharedAssistant.bossContactId
  );

  const sharedSelfContactId = 170;
  const sharedBossContactId = 177;
  const sharedAssistantId = sharedAssistant.agentId;
  const { teamId } = createTeamForAssistant(sharedAssistant, {
    name: `Chat Search Root E2E ${Date.now()}`,
    description: 'Shared chat-search root e2e description for visibility coverage',
    selfContactId: sharedSelfContactId,
    bossContactId: sharedBossContactId,
  });
  const sharedContext = `Teams/${teamId}/Transcripts`;

  const stamp = Date.now();
  const marker = `SharedSearchAuthoring_${stamp}`;
  const visibleOwn = `${marker} own-authored`;
  const visibleNull = `${marker} null-authored`;
  const hiddenForeign = `${marker} foreign-authored`;

  await seedTranscript(chatOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
    senderId: sharedBossContactId,
    content: visibleOwn,
    timestamp: new Date(stamp - 4000).toISOString(),
    receiverIds: [sharedSelfContactId],
    context: sharedContext,
    authoringAssistantId: sharedAssistantId,
  });
  await seedTranscript(chatOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
    senderId: sharedBossContactId,
    content: visibleNull,
    timestamp: new Date(stamp - 3000).toISOString(),
    receiverIds: [sharedSelfContactId],
    context: sharedContext,
    authoringAssistantId: null,
  });
  await seedTranscript(chatOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
    senderId: sharedBossContactId,
    content: hiddenForeign,
    timestamp: new Date(stamp - 2000).toISOString(),
    receiverIds: [sharedSelfContactId],
    context: sharedContext,
    authoringAssistantId: sharedAssistantId + 1,
  });

  await openAssistantChat(page, sharedAssistant);

  const searchBtn = page.getByTestId('chat-search-trigger');
  await searchBtn.click();

  const input = page.getByTestId('chat-search-input');
  await input.fill(marker);

  const searchButton = page.getByTestId('chat-search-button');
  await searchButton.click();

  const results = page.getByTestId('chat-search-result-item');
  await expect(results.first()).toBeVisible({ timeout: 15_000 });

  const resultTexts = await results.allTextContents();
  expect(resultTexts.some((text) => text.includes(visibleOwn))).toBe(true);
  expect(resultTexts.some((text) => text.includes(visibleNull))).toBe(true);
  expect(resultTexts.some((text) => text.includes(hiddenForeign))).toBe(false);
});

test('medium filter narrows results to chat or call', async ({ authedPage: page }) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  const ts = Date.now();
  const marker = `MediumFilter_${ts}`;

  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: CONTACT_ID,
    content: `${marker} chat message`,
    timestamp: new Date(ts - 5000).toISOString(),
    medium: 'unify_message',
  });
  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: CONTACT_ID,
    content: `${marker} call utterance`,
    timestamp: new Date(ts - 3000).toISOString(),
    medium: 'unify_meet',
    exchangeId: 700,
  });

  await openAssistantChat(page);

  const searchBtn = page.getByTestId('chat-search-trigger');
  await searchBtn.click();

  const input = page.getByTestId('chat-search-input');
  await input.fill(marker);

  const mediumFilter = page.getByTestId('search-filter-medium');
  await mediumFilter.click();
  await page.getByRole('option', { name: 'Chat' }).click();

  const searchButton = page.getByTestId('chat-search-button');
  await searchButton.click();

  const results = page.getByTestId('chat-search-result-item');
  await expect(results.first()).toBeVisible({ timeout: 15_000 });

  const chatCount = await results.count();
  expect(chatCount).toBe(1);

  const resultText = await results.first().textContent();
  expect(resultText).toContain('chat message');
});

test('sender filter narrows to assistant or user messages', async ({ authedPage: page }) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  const ts = Date.now();
  const marker = `SenderFilter_${ts}`;

  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: CONTACT_ID,
    content: `${marker} from me`,
    timestamp: new Date(ts - 5000).toISOString(),
  });
  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: ASSISTANT_CONTACT_ID,
    content: `${marker} from assistant`,
    timestamp: new Date(ts - 3000).toISOString(),
  });

  await openAssistantChat(page);

  const searchBtn = page.getByTestId('chat-search-trigger');
  await searchBtn.click();

  const input = page.getByTestId('chat-search-input');
  await input.fill(marker);

  const senderFilter = page.getByTestId('search-filter-sender');
  await senderFilter.click();
  await page.getByRole('option', { name: 'Me' }).click();

  const searchButton = page.getByTestId('chat-search-button');
  await searchButton.click();

  const results = page.getByTestId('chat-search-result-item');
  await expect(results.first()).toBeVisible({ timeout: 15_000 });

  const count = await results.count();
  expect(count).toBe(1);

  const resultText = await results.first().textContent();
  expect(resultText).toContain('from me');
});

test('go-to-message navigates to historical view and jump-to-present returns', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  const ts = Date.now();
  const marker = `GoToMsg_${ts}`;

  for (let i = 0; i < 60; i++) {
    await seedTranscript(user.apiKey, user.id, assistant.agentId, {
      senderId: i % 2 === 0 ? CONTACT_ID : ASSISTANT_CONTACT_ID,
      content: i === 0 ? `${marker} target message` : `Padding message ${i} of ${marker}`,
      timestamp: new Date(ts - (60 - i) * 60000).toISOString(),
    });
  }

  await openAssistantChat(page);

  const searchBtn = page.getByTestId('chat-search-trigger');
  await searchBtn.click();

  const input = page.getByTestId('chat-search-input');
  await input.fill(`${marker} target`);

  const searchButton = page.getByTestId('chat-search-button');
  await searchButton.click();

  const results = page.getByTestId('chat-search-result-item');
  await expect(results.first()).toBeVisible({ timeout: 15_000 });

  await results.first().click();

  const goToBtn = page.getByTestId('chat-search-go-to-message');
  await expect(goToBtn).toBeVisible();
  await goToBtn.click();

  const dialog = page.getByTestId('chat-search-dialog');
  await expect(dialog).not.toBeVisible({ timeout: 5_000 });

  const banner = page.getByTestId('older-messages-banner');
  await expect(banner).toBeVisible({ timeout: 10_000 });

  const jumpBtn = page.getByTestId('jump-to-present-button');
  await jumpBtn.click();

  await expect(banner).not.toBeVisible({ timeout: 5_000 });
});

test('navigate to message, scroll to bottom auto-returns to present, then re-navigate works', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  const ts = Date.now();
  const marker = `AutoPresent_${ts}`;

  for (let i = 0; i < 80; i++) {
    await seedTranscript(user.apiKey, user.id, assistant.agentId, {
      senderId: i % 2 === 0 ? CONTACT_ID : ASSISTANT_CONTACT_ID,
      content: i === 0 ? `${marker} target message` : `Filler msg ${i} for ${marker}`,
      timestamp: new Date(ts - (80 - i) * 60_000).toISOString(),
    });
  }

  await openAssistantChat(page);

  const searchBtn = page.getByTestId('chat-search-trigger');
  await searchBtn.click();

  const input = page.getByTestId('chat-search-input');
  await input.fill(`${marker} target`);

  const searchButton = page.getByTestId('chat-search-button');
  await searchButton.click();

  const results = page.getByTestId('chat-search-result-item');
  await expect(results.first()).toBeVisible({ timeout: 15_000 });
  await results.first().click();

  const goToBtn = page.getByTestId('chat-search-go-to-message');
  await goToBtn.click();

  const banner = page.getByTestId('older-messages-banner');
  await expect(banner).toBeVisible({ timeout: 10_000 });

  const targetMsg = page.locator(`text=${marker} target message`);
  await expect(targetMsg).toBeVisible({ timeout: 10_000 });

  const scrollArea = page.getByTestId('chat-scroll-area');
  const viewport = scrollArea.locator('[data-radix-scroll-area-viewport]');

  for (let attempt = 0; attempt < 30; attempt++) {
    await viewport.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(500);
    if (!(await banner.isVisible())) break;
  }

  await expect(banner).not.toBeVisible({ timeout: 10_000 });

  await searchBtn.click();

  const input2 = page.getByTestId('chat-search-input');
  await input2.fill(`${marker} target`);

  const searchButton2 = page.getByTestId('chat-search-button');
  await searchButton2.click();

  const results2 = page.getByTestId('chat-search-result-item');
  await expect(results2.first()).toBeVisible({ timeout: 15_000 });
  await results2.first().click();

  const goToBtn2 = page.getByTestId('chat-search-go-to-message');
  await goToBtn2.click();

  await expect(banner).toBeVisible({ timeout: 10_000 });

  await expect(targetMsg).toBeVisible({ timeout: 10_000 });
});

test('historical view includes call pills when calls fall within message range', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  const ts = Date.now();
  const marker = `HistCall_${ts}`;
  const exchangeId = 9000 + Math.floor(Math.random() * 10000);

  for (let i = 0; i < 30; i++) {
    await seedTranscript(user.apiKey, user.id, assistant.agentId, {
      senderId: i % 2 === 0 ? CONTACT_ID : ASSISTANT_CONTACT_ID,
      content: i === 0 ? `${marker} anchor message` : `${marker} padding before ${i}`,
      timestamp: new Date(ts - (60 - i) * 60_000).toISOString(),
    });
  }

  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: CONTACT_ID,
    content: 'Hi from the call',
    timestamp: new Date(ts - 45 * 60_000).toISOString(),
    medium: 'unify_meet',
    exchangeId,
  });
  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: ASSISTANT_CONTACT_ID,
    content: 'Hello from assistant on call',
    timestamp: new Date(ts - 44 * 60_000).toISOString(),
    medium: 'unify_meet',
    exchangeId,
  });

  for (let i = 0; i < 30; i++) {
    await seedTranscript(user.apiKey, user.id, assistant.agentId, {
      senderId: i % 2 === 0 ? CONTACT_ID : ASSISTANT_CONTACT_ID,
      content: `${marker} padding after ${i}`,
      timestamp: new Date(ts - (29 - i) * 60_000).toISOString(),
    });
  }

  await openAssistantChat(page);

  const searchBtn = page.getByTestId('chat-search-trigger');
  await searchBtn.click();

  const input = page.getByTestId('chat-search-input');
  await input.fill(`${marker} anchor`);

  const searchButton = page.getByTestId('chat-search-button');
  await searchButton.click();

  const results = page.getByTestId('chat-search-result-item');
  await expect(results.first()).toBeVisible({ timeout: 15_000 });
  await results.first().click();

  const goToBtn = page.getByTestId('chat-search-go-to-message');
  await goToBtn.click();

  const banner = page.getByTestId('older-messages-banner');
  await expect(banner).toBeVisible({ timeout: 10_000 });

  const callPill = page.locator(`[data-exchange-id="${exchangeId}"]`);
  await expect(callPill).toBeVisible({ timeout: 10_000 });
});

test('historical shared-root call pills hide foreign-authored exchanges', async ({
  authedPage: page,
}) => {
  const chatOrg = createOrg({ name: `ChatHistOrg_${Date.now()}`, ownerId: user.id });
  ensureProjectSync(chatOrg.ownerOrgApiKey);
  await switchWorkspace(page, chatOrg.id);
  await page.goto('/assistants');
  await closeHireDialogIfOpen(page);

  const sharedAssistant = createAssistant({
    userId: user.id,
    orgId: chatOrg.id,
    firstName: 'HistCallShared',
    surname: `E2E${Date.now()}`,
  });
  await seedContact(
    chatOrg.ownerOrgApiKey,
    user.id,
    sharedAssistant.agentId,
    user.email,
    sharedAssistant.bossContactId
  );

  const sharedSelfContactId = 270;
  const sharedBossContactId = 277;
  const sharedAssistantId = sharedAssistant.agentId;
  const { teamId } = createTeamForAssistant(sharedAssistant, {
    name: `Chat Hist Root E2E ${Date.now()}`,
    description: 'Shared historical call root e2e description for visibility coverage',
    selfContactId: sharedSelfContactId,
    bossContactId: sharedBossContactId,
  });
  const sharedContext = `Teams/${teamId}/Transcripts`;

  const ts = Date.now();
  const marker = `SharedHistCall_${ts}`;
  const ownExchangeId = 11000 + Math.floor(Math.random() * 10000);
  const nullExchangeId = ownExchangeId + 1;
  const foreignExchangeId = ownExchangeId + 2;
  const foreignTranscript = `${marker} foreign transcript hidden`;

  await seedTranscript(chatOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
    senderId: sharedBossContactId,
    content: `${marker} anchor`,
    timestamp: new Date(ts - 60_000).toISOString(),
    receiverIds: [sharedSelfContactId],
    context: sharedContext,
    authoringAssistantId: sharedAssistantId,
  });
  await seedTranscript(chatOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
    senderId: sharedBossContactId,
    content: foreignTranscript,
    timestamp: new Date(ts - 59_000).toISOString(),
    receiverIds: [sharedSelfContactId],
    context: sharedContext,
    authoringAssistantId: sharedAssistantId + 1,
  });
  await seedTranscript(chatOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
    senderId: sharedBossContactId,
    content: `${marker} own call`,
    timestamp: new Date(ts - 55_000).toISOString(),
    medium: 'unify_meet',
    exchangeId: ownExchangeId,
    receiverIds: [sharedSelfContactId],
    context: sharedContext,
    authoringAssistantId: sharedAssistantId,
  });
  await seedTranscript(chatOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
    senderId: sharedSelfContactId,
    content: `${marker} own reply`,
    timestamp: new Date(ts - 54_000).toISOString(),
    medium: 'unify_meet',
    exchangeId: ownExchangeId,
    receiverIds: [sharedBossContactId],
    context: sharedContext,
    authoringAssistantId: sharedAssistantId,
  });
  await seedTranscript(chatOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
    senderId: sharedBossContactId,
    content: `${marker} null call`,
    timestamp: new Date(ts - 53_000).toISOString(),
    medium: 'unify_meet',
    exchangeId: nullExchangeId,
    receiverIds: [sharedSelfContactId],
    context: sharedContext,
    authoringAssistantId: null,
  });
  await seedTranscript(chatOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
    senderId: sharedSelfContactId,
    content: `${marker} null reply`,
    timestamp: new Date(ts - 52_000).toISOString(),
    medium: 'unify_meet',
    exchangeId: nullExchangeId,
    receiverIds: [sharedBossContactId],
    context: sharedContext,
    authoringAssistantId: null,
  });
  await seedTranscript(chatOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
    senderId: sharedBossContactId,
    content: `${marker} foreign call`,
    timestamp: new Date(ts - 51_000).toISOString(),
    medium: 'unify_meet',
    exchangeId: foreignExchangeId,
    receiverIds: [sharedSelfContactId],
    context: sharedContext,
    authoringAssistantId: sharedAssistantId + 1,
  });
  await seedTranscript(chatOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
    senderId: sharedSelfContactId,
    content: `${marker} foreign reply`,
    timestamp: new Date(ts - 50_000).toISOString(),
    medium: 'unify_meet',
    exchangeId: foreignExchangeId,
    receiverIds: [sharedBossContactId],
    context: sharedContext,
    authoringAssistantId: sharedAssistantId + 1,
  });

  await openAssistantChat(page, sharedAssistant);

  const searchBtn = page.getByTestId('chat-search-trigger');
  await searchBtn.click();

  const input = page.getByTestId('chat-search-input');
  await input.fill(`${marker} anchor`);

  const searchButton = page.getByTestId('chat-search-button');
  await searchButton.click();

  const results = page.getByTestId('chat-search-result-item');
  await expect(results.first()).toBeVisible({ timeout: 15_000 });
  await results.first().click();

  const goToBtn = page.getByTestId('chat-search-go-to-message');
  await goToBtn.click();

  const banner = page.getByTestId('older-messages-banner');
  await expect(banner).toBeVisible({ timeout: 10_000 });

  await expect(page.locator(`[data-exchange-id="${ownExchangeId}"]`)).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator(`[data-exchange-id="${nullExchangeId}"]`)).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator(`[data-exchange-id="${foreignExchangeId}"]`)).toHaveCount(0);
  await expect(page.locator(`text=${foreignTranscript}`)).toHaveCount(0);
});

test('empty search shows no results message', async ({ authedPage: page }) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  await openAssistantChat(page);

  const searchBtn = page.getByTestId('chat-search-trigger');
  await searchBtn.click();

  const input = page.getByTestId('chat-search-input');
  await input.fill('xyznonexistent_query_that_will_never_match_anything_12345');

  const searchButton = page.getByTestId('chat-search-button');
  await searchButton.click();

  await page.waitForTimeout(3_000);

  const noResults = page.locator('text=No messages found');
  await expect(noResults).toBeVisible({ timeout: 10_000 });
});
