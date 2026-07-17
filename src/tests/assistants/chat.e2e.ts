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
  chatComposer,
  waitForChatSendReady,
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

test('sending a message shows it as a user message in the chat @push @critical @area(assistants.chat)', async ({
  authedPage: page,
}) => {
  // Seed contact so chat can resolve contactId
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  await openAssistantChat(page);

  const testMessage = `Hello from E2E test ${Date.now()}`;
  const textarea = chatComposer(page);
  await waitForChatSendReady(page);
  await textarea.fill(testMessage);
  await page.getByRole('button', { name: 'Send message' }).click();

  const chatArea = page.getByTestId('chat-scroll-area');
  await expect(chatArea.getByText(testMessage)).toBeVisible({ timeout: 10_000 });
});

test('historical transcript messages load when navigating to an assistant @critical @area(assistants.chat)', async ({
  authedPage: page,
}) => {
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

  const chatArea = page.getByTestId('chat-scroll-area');

  for (const m of msgs) {
    await expect(chatArea.getByText(m.content)).toBeVisible({ timeout: 20_000 });
  }

  const bubbles = chatArea.locator('[data-testid="message-bubble"]');
  const count = await bubbles.count();
  expect(count).toBeGreaterThanOrEqual(4);
  const indices: number[] = [];
  for (let i = 0; i < count; i++) {
    const idx = await bubbles.nth(i).getAttribute('data-index');
    if (idx !== null) indices.push(parseInt(idx, 10));
  }
  for (let i = 1; i < indices.length; i++) {
    expect(indices[i]).toBeGreaterThan(indices[i - 1]);
  }
});

test('chat input is disabled when credits are exhausted and re-enables after funding @critical @area(assistants.chat)', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);
  setUserCredits(user.id, -100);

  await openAssistantChat(page);

  const textarea = chatComposer(page);
  await expect(textarea).toBeVisible({ timeout: 10_000 });
  await expect(textarea).toBeDisabled({ timeout: 15_000 });

  const placeholder = await textarea.getAttribute('placeholder');
  expect(placeholder).toBeTruthy();
  expect(
    placeholder!.toLowerCase().includes('credit') ||
      placeholder!.toLowerCase().includes('spending') ||
      placeholder!.toLowerCase().includes('limit')
  ).toBe(true);

  setUserCredits(user.id, 50_000);
  await openAssistantChat(page);
  await expect(chatComposer(page)).toBeEnabled({ timeout: 20_000 });
});

test('team room messages never leak into the assistant DM, and DM history paginates', async ({
  authedPage: page,
}) => {
  const chatOrg = createOrg({ name: `ChatSharedOrg_${Date.now()}`, ownerId: user.id });
  ensureProjectSync(chatOrg.ownerOrgApiKey);
  await switchWorkspace(page, chatOrg.id);
  await navigateToAssistants(page);
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

  const { teamId } = createTeamForAssistant(sharedAssistant, {
    name: `Chat Root E2E ${Date.now()}`,
    description: 'Room isolation + pagination coverage',
    selfContactId: 70,
    bossContactId: 77,
  });

  const stamp = Date.now();
  const dmLatest = `DM latest ${stamp}`;
  const dmOldest = `DM oldest page-two ${stamp}`;
  const teamRoomMessage = `Team room message must stay in the room ${stamp}`;
  const teamAssistantReply = `Team assistant reply must stay in the room ${stamp}`;

  // The DM thread: an old boundary message, filler beyond one page, then a
  // fresh latest message.
  await seedTranscript(chatOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
    senderId: sharedAssistant.bossContactId,
    content: dmOldest,
  });
  for (let i = 0; i < 48; i++) {
    await seedTranscript(chatOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
      senderId: sharedAssistant.bossContactId,
      content: `Merged filler ${stamp}-${i}`,
    });
  }
  await seedTranscript(chatOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
    senderId: sharedAssistant.bossContactId,
    content: dmLatest,
  });

  // The team room: one human message and one assistant reply. Neither may
  // appear in the 1-on-1 DM panel — they live in the team's own thread.
  await seedTranscript(chatOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
    senderId: sharedAssistant.bossContactId,
    content: teamRoomMessage,
    teamId,
  });
  await seedTranscript(chatOrg.ownerOrgApiKey, user.id, sharedAssistant.agentId, {
    senderId: sharedAssistant.selfContactId,
    content: teamAssistantReply,
    teamId,
  });

  await openAssistantChat(page, sharedAssistant);

  await expect(page.locator(`text=${dmLatest}`).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(`text=${teamRoomMessage}`)).toHaveCount(0);
  await expect(page.locator(`text=${teamAssistantReply}`)).toHaveCount(0);

  const viewport = page
    .getByTestId('chat-scroll-area')
    .locator('[data-radix-scroll-area-viewport]');
  await viewport.evaluate((el) => {
    el.scrollTop = 0;
    el.dispatchEvent(new Event('scroll'));
  });

  await expect(page.locator(`text=${dmOldest}`).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(`text=${teamRoomMessage}`)).toHaveCount(0);
});
