/**
 * Chat E2E Tests (core) — browser-based user flows for sending and reading
 * messages in the assistant chat panel.
 *
 * Verifies:
 *  - Chat panel renders with input controls
 *  - Sending messages (optimistic insert, local dev 202 accepted)
 *  - Historical transcript loading from Orchestra logs
 *  - Shared-root chat history merges root-local identities and paginates
 *  - Message ordering (chronological) + multiple sequential sends
 *  - Chat input disabled / re-enabled around credit exhaustion
 *  - Empty chat state for a new assistant
 *  - Polling-based transcript retrieval for assistant responses
 *
 * Attachments, chat search, and the page-level inbox stream live in sibling
 * specs (chat-attachments / chat-search / chat-stream) so the suite shards.
 *
 * Local mode: sending returns 202 (dispatch skipped). SSE errors disable the
 * chat input (placeholder "Connection failed. Please refresh."), so tests
 * assume SSE connects successfully.
 *
 * Run: npx playwright test src/tests/assistants/chat.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  navigateToAssistants,
  closeHireDialogIfOpen,
  switchWorkspace,
  deleteAllAssistantsForUser,
  createOrg,
  createTeamForAssistant,
  ensureProjectSync,
  setUserCredits,
  openUnitySwitcher,
} from './helpers';
import {
  createContactSeeder,
  createTranscriptSeeder,
  createOpenAssistantChat,
} from './chat-helpers';

const user = createTestUser({ name: 'ChatE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'ChatBot',
  surname: 'E2E',
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
  setUserCredits(user.id, 50_000);
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

test('chat panel renders with input and controls when assistant is selected', async ({
  authedPage: page,
}) => {
  // Seed contact so chat can resolve contactId and enable the input
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  await openAssistantChat(page);

  // Chat scroll area is visible
  await expect(page.getByTestId('chat-scroll-area')).toBeVisible();

  // Textarea is visible and enabled
  const textarea = page.locator('textarea');
  await expect(textarea).toBeVisible({ timeout: 10_000 });
  await expect(textarea).toBeEnabled({ timeout: 20_000 });

  // Attach button is always present. The voice-record button is gated behind
  // the transcription feature (DEEPGRAM_API_KEY) and is intentionally hidden on
  // deployments without it (CI/stub included), so it is not asserted here.
  await expect(page.getByTestId('attach-button')).toBeVisible();
});

test('sending a message shows it as a user message in the chat', async ({ authedPage: page }) => {
  // Seed contact so chat can resolve contactId
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  await openAssistantChat(page);

  // Wait for textarea to be enabled (contact resolution + chat ready)
  const textarea = page.locator('textarea');
  await expect(textarea).toBeEnabled({ timeout: 20_000 });

  const testMessage = `Hello from E2E test ${Date.now()}`;
  await textarea.fill(testMessage);
  await textarea.press('Enter');

  // The message should appear as a user bubble
  await expect(page.locator(`text=${testMessage}`).first()).toBeVisible({ timeout: 10_000 });

  // Verify the message bubble has role="user" via data-role
  const userBubble = page.locator(`[data-role="user"]:has-text("${testMessage}")`);
  await expect(userBubble).toBeVisible({ timeout: 5_000 });

  await expect(page.locator('text=Typing')).toBeVisible({ timeout: 5_000 });
});

test('historical transcript messages load when navigating to an assistant', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  const ts = Date.now();
  const userMsg = `Historical user message ${ts}`;
  const assistantMsg = `Historical assistant reply ${ts}`;

  // Seed a user message and an assistant response
  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: CONTACT_ID,
    content: userMsg,
    timestamp: new Date(ts - 2000).toISOString(),
  });
  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: ASSISTANT_CONTACT_ID,
    content: assistantMsg,
    timestamp: new Date(ts - 1000).toISOString(),
  });

  await openAssistantChat(page);

  // Wait for messages to load (contact resolution + transcript fetch)
  await expect(page.locator(`text=${userMsg}`).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(`text=${assistantMsg}`).first()).toBeVisible({ timeout: 10_000 });

  // User message has correct role
  const userBubble = page.locator(`[data-role="user"]:has-text("${userMsg}")`);
  await expect(userBubble).toBeVisible({ timeout: 5_000 });

  // Assistant message has correct role
  const assistantBubble = page.locator(`[data-role="assistant"]:has-text("${assistantMsg}")`);
  await expect(assistantBubble).toBeVisible({ timeout: 5_000 });
});

test('shared-root chat history merges root-local identities and paginates', async ({
  authedPage: page,
}) => {
  const chatOrg = createOrg({ name: `ChatSharedOrg_${Date.now()}`, ownerId: user.id });
  ensureProjectSync(chatOrg.ownerOrgApiKey);
  await switchWorkspace(page, chatOrg.id);
  await page.goto('/assistants');
  await closeHireDialogIfOpen(page);

  const sharedAssistant = createAssistant({
    userId: user.id,
    orgId: chatOrg.id,
    firstName: 'SharedChat',
    surname: `E2E${Date.now()}`,
  });
  await seedContact(
    chatOrg.ownerOrgApiKey,
    user.id,
    sharedAssistant.agentId,
    user.email,
    sharedAssistant.bossContactId
  );

  const sharedSelfContactId = 70;
  const sharedBossContactId = 77;
  const sharedAssistantId = sharedAssistant.agentId;
  const { teamId } = createTeamForAssistant(sharedAssistant, {
    name: `Chat Root E2E ${Date.now()}`,
    description: 'Shared chat root e2e description for pagination coverage',
    selfContactId: sharedSelfContactId,
    bossContactId: sharedBossContactId,
  });
  const sharedContext = `Teams/${teamId}/Transcripts`;

  const stamp = Date.now();
  const boundaryTimestamp = new Date(stamp - 60_000).toISOString();
  const sharedBoundary = `Shared same timestamp page two ${stamp}`;
  const personalBoundary = `Personal same timestamp boundary ${stamp}`;
  const personalLatest = `Personal root latest ${stamp}`;
  const sharedLatest = `Shared root latest ${stamp}`;
  const sharedAuthored = `Shared authored visible ${stamp}`;
  const sharedLegacyNull = `Shared null-authored visible ${stamp}`;
  const sharedForeign = `Shared foreign-authored hidden ${stamp}`;
  const decoy = `Shared decoy personal contact ${stamp}`;

  for (let i = 0; i < 48; i++) {
    await seedTranscript(chatOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
      senderId: sharedAssistant.bossContactId,
      content: `Merged filler ${stamp}-${i}`,
      timestamp: new Date(stamp - i * 1000).toISOString(),
      receiverIds: [sharedAssistant.selfContactId],
    });
  }
  await seedTranscript(chatOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
    senderId: sharedAssistant.bossContactId,
    content: personalLatest,
    timestamp: new Date(stamp + 1000).toISOString(),
    receiverIds: [sharedAssistant.selfContactId],
  });
  await seedTranscript(chatOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
    senderId: sharedBossContactId,
    content: sharedLatest,
    timestamp: new Date(stamp + 2000).toISOString(),
    receiverIds: [sharedSelfContactId],
    context: sharedContext,
    authoringAssistantId: sharedAssistantId,
  });
  await seedTranscript(chatOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
    senderId: sharedBossContactId,
    content: sharedAuthored,
    timestamp: new Date(stamp + 2500).toISOString(),
    receiverIds: [sharedSelfContactId],
    context: sharedContext,
    authoringAssistantId: sharedAssistantId,
  });
  await seedTranscript(chatOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
    senderId: sharedBossContactId,
    content: sharedLegacyNull,
    timestamp: new Date(stamp + 2600).toISOString(),
    receiverIds: [sharedSelfContactId],
    context: sharedContext,
    authoringAssistantId: null,
  });
  await seedTranscript(chatOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
    senderId: sharedBossContactId,
    content: sharedForeign,
    timestamp: new Date(stamp + 2700).toISOString(),
    receiverIds: [sharedSelfContactId],
    context: sharedContext,
    authoringAssistantId: sharedAssistantId + 1,
  });
  await seedTranscript(chatOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
    senderId: sharedAssistant.bossContactId,
    content: decoy,
    timestamp: new Date(stamp + 3000).toISOString(),
    receiverIds: [sharedSelfContactId],
    context: sharedContext,
  });
  await seedTranscript(chatOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
    senderId: sharedAssistant.bossContactId,
    content: personalBoundary,
    timestamp: boundaryTimestamp,
    receiverIds: [sharedAssistant.selfContactId],
  });
  await seedTranscript(chatOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
    senderId: sharedBossContactId,
    content: sharedBoundary,
    timestamp: boundaryTimestamp,
    receiverIds: [sharedSelfContactId],
    context: sharedContext,
    authoringAssistantId: sharedAssistantId,
  });

  await openAssistantChat(page, sharedAssistant);

  await expect(page.locator(`text=${personalLatest}`).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(`text=${sharedLatest}`).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(`text=${sharedAuthored}`).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(`text=${sharedLegacyNull}`).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(`text=${sharedForeign}`)).toHaveCount(0);
  await expect(page.locator(`text=${decoy}`)).toHaveCount(0);

  const viewport = page
    .getByTestId('chat-scroll-area')
    .locator('[data-radix-scroll-area-viewport]');
  await viewport.evaluate((el) => {
    el.scrollTop = 0;
    el.dispatchEvent(new Event('scroll'));
  });

  await expect(page.locator(`text=${personalBoundary}`).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(`text=${sharedBoundary}`).first()).toBeVisible({ timeout: 20_000 });
});

test('multiple historical messages render in chronological order', async ({ authedPage: page }) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  const ts = Date.now();
  const msgs = [
    {
      content: `First message ${ts}`,
      time: new Date(ts - 5000).toISOString(),
      senderId: CONTACT_ID,
    },
    {
      content: `Second message ${ts}`,
      time: new Date(ts - 4000).toISOString(),
      senderId: ASSISTANT_CONTACT_ID,
    },
    {
      content: `Third message ${ts}`,
      time: new Date(ts - 3000).toISOString(),
      senderId: CONTACT_ID,
    },
    {
      content: `Fourth message ${ts}`,
      time: new Date(ts - 2000).toISOString(),
      senderId: ASSISTANT_CONTACT_ID,
    },
  ];

  for (const m of msgs) {
    await seedTranscript(user.apiKey, user.id, assistant.agentId, {
      senderId: m.senderId,
      content: m.content,
      timestamp: m.time,
    });
  }

  await openAssistantChat(page);

  // Wait for the last message to appear
  await expect(page.locator(`text=Fourth message ${ts}`).first()).toBeVisible({ timeout: 20_000 });

  // All four messages should be visible
  for (const m of msgs) {
    await expect(page.locator(`text=${m.content}`).first()).toBeVisible({ timeout: 5_000 });
  }

  // Verify ordering: collect all message-bubble data-index values and check they're ascending
  const bubbles = page.locator('[data-testid="message-bubble"]');
  const count = await bubbles.count();
  expect(count).toBeGreaterThanOrEqual(4);

  // Get data-index values to verify they're in ascending order
  const indices: number[] = [];
  for (let i = 0; i < count; i++) {
    const idx = await bubbles.nth(i).getAttribute('data-index');
    if (idx !== null) indices.push(parseInt(idx, 10));
  }
  for (let i = 1; i < indices.length; i++) {
    expect(indices[i]).toBeGreaterThan(indices[i - 1]);
  }
});

test('sending multiple messages in succession preserves order', async ({ authedPage: page }) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  await openAssistantChat(page);

  const textarea = page.locator('textarea');
  await expect(textarea).toBeEnabled({ timeout: 20_000 });

  const ts = Date.now();
  const messages = [`Sequential msg A ${ts}`, `Sequential msg B ${ts}`, `Sequential msg C ${ts}`];

  for (const msg of messages) {
    await textarea.fill(msg);
    await textarea.press('Enter');
  }

  // Wait for all three messages to appear
  for (const msg of messages) {
    await expect(page.locator(`text=${msg}`).first()).toBeVisible({ timeout: 10_000 });
  }

  // Verify the order in the DOM: A should appear before B, B before C
  const chatArea = page.getByTestId('chat-scroll-area');
  const allBubbles = chatArea.locator('[data-role="user"]');
  const allTexts: string[] = [];
  const bubbleCount = await allBubbles.count();
  for (let i = 0; i < bubbleCount; i++) {
    const text = await allBubbles.nth(i).textContent();
    if (text) allTexts.push(text);
  }

  // Find positions of our messages in the rendered order
  const posA = allTexts.findIndex((t) => t.includes(`Sequential msg A ${ts}`));
  const posB = allTexts.findIndex((t) => t.includes(`Sequential msg B ${ts}`));
  const posC = allTexts.findIndex((t) => t.includes(`Sequential msg C ${ts}`));

  expect(posA).toBeGreaterThanOrEqual(0);
  expect(posB).toBeGreaterThan(posA);
  expect(posC).toBeGreaterThan(posB);
});

test('chat input is disabled when user credits are exhausted', async ({ authedPage: page }) => {
  // Set credits to negative (exhausted)
  setUserCredits(user.id, -100);

  await openAssistantChat(page);

  // The textarea should be disabled
  const textarea = page.locator('textarea');
  await expect(textarea).toBeVisible({ timeout: 10_000 });
  await expect(textarea).toBeDisabled({ timeout: 15_000 });

  // The placeholder should mention credits/spending
  const placeholder = await textarea.getAttribute('placeholder');
  expect(placeholder).toBeTruthy();
  expect(
    placeholder!.toLowerCase().includes('credit') ||
      placeholder!.toLowerCase().includes('spending') ||
      placeholder!.toLowerCase().includes('limit')
  ).toBe(true);

  // Restore credits for subsequent tests
  setUserCredits(user.id, 50_000);
});

test('chat shows empty area for a new assistant with no history', async ({ authedPage: page }) => {
  // Create a fresh assistant and seed a contact (required for chat to load)
  const freshAssistant = createAssistant({
    userId: user.id,
    firstName: 'FreshBot',
    surname: 'NoHistory',
  });
  await seedContact(user.apiKey, user.id, freshAssistant.agentId, user.email);

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);

  const listItem = page.getByTestId(`assistant-list-item-${freshAssistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();
  await expect(page.getByTestId('chat-scroll-area')).toBeVisible({ timeout: 15_000 });

  // Wait for textarea to be enabled (chat loaded with no messages)
  const textarea = page.locator('textarea');
  await expect(textarea).toBeEnabled({ timeout: 20_000 });

  await expect(page.locator('[data-testid="message-bubble"]')).toHaveCount(0, { timeout: 5_000 });
});

test('assistant response seeded as transcript appears via polling', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  await openAssistantChat(page);

  const textarea = page.locator('textarea');
  await expect(textarea).toBeEnabled({ timeout: 20_000 });

  // Send a user message
  const userMsg = `Poll test user message ${Date.now()}`;
  await textarea.fill(userMsg);
  await textarea.press('Enter');
  await expect(page.locator(`text=${userMsg}`).first()).toBeVisible({ timeout: 10_000 });

  // Seed an assistant reply as a transcript (simulating what adapters would produce)
  const assistantReply = `Poll test assistant reply ${Date.now()}`;
  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: ASSISTANT_CONTACT_ID,
    content: assistantReply,
  });

  // The polling fallback should pick up the assistant reply
  // Poll interval is typically 10-30 seconds; wait up to 60s
  await expect(page.locator(`text=${assistantReply}`).first()).toBeVisible({ timeout: 60_000 });

  // Verify it renders as an assistant bubble
  const assistantBubble = page.locator(`[data-role="assistant"]:has-text("${assistantReply}")`);
  await expect(assistantBubble).toBeVisible({ timeout: 5_000 });
});

test('assistant message exposes a copy button that confirms on click', async ({
  authedPage: page,
}) => {
  // The copy affordance only appears on assistant bubbles (the user
  // already authored their own messages). On click it briefly flips
  // its `data-copied` attribute and updates the aria-label without
  // creating a global toast. Those UI signals are more deterministic
  // than asserting clipboard reads.
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  const ts = Date.now();
  const userMsg = `Copy-test user message ${ts}`;
  const assistantMsg = `Copy-test assistant reply ${ts}`;

  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: CONTACT_ID,
    content: userMsg,
    timestamp: new Date(ts - 2000).toISOString(),
  });
  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: ASSISTANT_CONTACT_ID,
    content: assistantMsg,
    timestamp: new Date(ts - 1000).toISOString(),
  });

  await openAssistantChat(page);

  const assistantBubble = page.locator(`[data-role="assistant"]:has-text("${assistantMsg}")`);
  await expect(assistantBubble).toBeVisible({ timeout: 20_000 });

  // User bubbles deliberately don't render the copy button — guard
  // against accidentally surfacing it for both roles.
  const userBubble = page.locator(`[data-role="user"]:has-text("${userMsg}")`);
  await expect(userBubble.getByTestId('message-copy-button')).toHaveCount(0);

  const copyButton = assistantBubble.getByTestId('message-copy-button');
  await expect(copyButton).toBeVisible({ timeout: 5_000 });
  await expect(copyButton).not.toHaveAttribute('data-copied', 'true');

  await copyButton.click();

  await expect(copyButton).toHaveAttribute('data-copied', 'true', { timeout: 3_000 });
  await expect(copyButton).toHaveAttribute('aria-label', 'Message copied');
  await expect(
    page.locator('[data-sonner-toast]').filter({ hasText: 'Message copied' })
  ).toHaveCount(0);
});

test('re-enabling credits after exhaustion restores chat input', async ({ authedPage: page }) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  // Start with exhausted credits
  setUserCredits(user.id, -100);

  await openAssistantChat(page);

  const textarea = page.locator('textarea');
  await expect(textarea).toBeDisabled({ timeout: 15_000 });

  // Restore credits
  setUserCredits(user.id, 50_000);

  // Navigate away and back to pick up the credit change
  await openAssistantChat(page);

  // Textarea should now be enabled
  const textareaAfter = page.locator('textarea');
  await expect(textareaAfter).toBeEnabled({ timeout: 20_000 });
});
