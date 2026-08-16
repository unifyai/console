/**
 * Chat inbox-stream E2E Tests — page-level user flows that exercise the chat
 * inbox stream's teardown + rebuild lifecycle and live assistant replies.
 *
 * Verifies:
 *  - Switching between assistants closes one stream and opens another
 *  - Returning to a previously-viewed assistant rebuilds a working stream
 *  - Unread indicators and live replies via the Pub/Sub emulator
 *  - Stream resilience under rapid navigation / stress
 *
 * Requires the Pub/Sub emulator from `./scripts/local.sh --chat`; topics are
 * pre-created via `ensurePubSubTopic` and replies injected with
 * `publishUnifyMessageOutbound`.
 *
 * Run: npx playwright test src/tests/assistants/chat-stream.e2e.ts
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
  deleteAllAssistantsForUser,
  ensureProjectSync,
} from './helpers';
import {
  createContactSeeder,
  createTranscriptSeeder,
  ensurePubSubTopic,
  publishUnifyMessageOutbound,
} from './chat-helpers';

const user = createTestUser({ name: 'ChatStreamE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'ChatBot',
  surname: 'Stream',
});
const ASSISTANT_CONTACT_ID = assistant.selfContactId;
const CONTACT_ID = assistant.bossContactId;

const seedContact = createContactSeeder(CONTACT_ID);
const seedTranscript = createTranscriptSeeder({
  selfContactId: ASSISTANT_CONTACT_ID,
  bossContactId: CONTACT_ID,
});

test.afterAll(() => {
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

// ===========================================================================
// Inbox Stream Lifecycle Tests
// ===========================================================================
//
// These cover the user flows that exercise the chat inbox stream's
// teardown + rebuild lifecycle: switching between assistants closes one
// stream and opens another, and returning to a previously-viewed assistant
// must re-establish a working stream against its existing transcript history.
// Regressions here historically manifested as "I switched away and now my
// chat is broken / shows the wrong assistant's messages".

test('switching to another assistant and back keeps each chat working independently @critical @area(assistants.chat.stream)', async ({
  authedPage: page,
}) => {
  // Two assistants, each with their own seeded contact + a distinct
  // historical message so we can prove transcripts didn't bleed across.
  const assistantA = createAssistant({
    userId: user.id,
    firstName: 'Switcher',
    surname: 'AlphaA',
  });
  const assistantB = createAssistant({
    userId: user.id,
    firstName: 'Switcher',
    surname: 'BravoB',
  });

  await seedContact(user.apiKey, user.id, assistantA.agentId, user.email, assistantA.bossContactId);
  await seedContact(user.apiKey, user.id, assistantB.agentId, user.email, assistantB.bossContactId);

  const ts = Date.now();
  const histA = `Alpha history msg ${ts}`;
  const histB = `Bravo history msg ${ts}`;
  await seedTranscript(user.apiKey, user.id, assistantA.agentId, {
    senderId: CONTACT_ID,
    content: histA,
    timestamp: new Date(ts - 5_000).toISOString(),
  });
  await seedTranscript(user.apiKey, user.id, assistantB.agentId, {
    senderId: CONTACT_ID,
    content: histB,
    timestamp: new Date(ts - 5_000).toISOString(),
  });

  // ---- Open assistant A ---------------------------------------------------
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);

  const itemA = page.getByTestId(`assistant-list-item-${assistantA.agentId}`);
  await expect(itemA).toBeVisible({ timeout: 15_000 });
  await itemA.click();
  await expect(page.getByTestId('chat-scroll-area')).toBeVisible({ timeout: 10_000 });

  const textareaA = page.locator('textarea');
  await expect(textareaA).toBeEnabled({ timeout: 20_000 });
  await expect(page.locator(`text=${histA}`).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(`text=${histB}`)).toHaveCount(0);

  const sendA = `Alpha send ${ts}`;
  await textareaA.fill(sendA);
  await textareaA.press('Enter');
  await expect(page.locator(`[data-role="user"]:has-text("${sendA}")`)).toBeVisible({
    timeout: 10_000,
  });

  // ---- Switch to assistant B (tears down A's inbox stream) ----------------
  await openUnitySwitcher(page);
  const itemB = page.getByTestId(`assistant-list-item-${assistantB.agentId}`);
  await itemB.click();
  await page.waitForTimeout(1_000);

  // B's chat must show B's history and NOT carry A's messages.
  const textareaB = page.locator('textarea');
  await expect(textareaB).toBeEnabled({ timeout: 20_000 });
  await expect(page.locator(`text=${histB}`).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(`text=${histA}`)).toHaveCount(0);
  await expect(page.locator(`text=${sendA}`)).toHaveCount(0);

  const sendB = `Bravo send ${ts}`;
  await textareaB.fill(sendB);
  await textareaB.press('Enter');
  await expect(page.locator(`[data-role="user"]:has-text("${sendB}")`)).toBeVisible({
    timeout: 10_000,
  });

  // ---- Switch back to A (rebuilds A's inbox stream from scratch) ----------
  await openUnitySwitcher(page);
  await itemA.click();
  await page.waitForTimeout(1_000);

  const textareaABack = page.locator('textarea');
  await expect(textareaABack).toBeEnabled({ timeout: 20_000 });
  await expect(page.locator(`text=${histA}`).first()).toBeVisible({ timeout: 20_000 });
  // The optimistic send from earlier should still be in the in-memory
  // chatHistories map (it's stored at the page level, not in the panel).
  await expect(page.locator(`[data-role="user"]:has-text("${sendA}")`)).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator(`text=${histB}`)).toHaveCount(0);
  await expect(page.locator(`text=${sendB}`)).toHaveCount(0);

  // Seed a new assistant reply for A and verify the rebuilt stream's polling
  // fallback picks it up — proves the post-switch inbox stream is live.
  const replyA = `Alpha late reply ${ts}`;
  await seedTranscript(user.apiKey, user.id, assistantA.agentId, {
    senderId: ASSISTANT_CONTACT_ID,
    content: replyA,
  });

  await expect(page.locator(`[data-role="assistant"]:has-text("${replyA}")`)).toBeVisible({
    timeout: 60_000,
  });
});

// ===========================================================================
// Page-level Chat Stream / Unread Badge Tests
// ===========================================================================
//
// These cover the user flow behind the assistants-page unread badges: a
// single page-level SSE connection (`/api/assistant/events/chat-stream`,
// sharded client-side over `useAssistantChatStream`) listens on every
// workspace assistant's Pub/Sub chat topic, and incoming messages for a
// non-active assistant bump that assistant's unread counter. Opening the
// chat clears the counter and persists `lastReadAt` in localStorage so
// the count stays cleared across reloads via the persisted unread map.
//
// Requires the local `--chat` harness: the Pub/Sub emulator (localhost:8085)
// has to be up so the test can publish `unify_message_outbound` frames
// directly to the assistant's topic, bypassing the full Communication +
// Unity adapter pipeline.

test('unread badge increments, clears on open, and stays cleared after reload @area(assistants.chat.stream)', async ({
  authedPage: page,
}) => {
  const active = createAssistant({
    userId: user.id,
    firstName: 'Unread',
    surname: 'ActiveA',
  });
  const incoming = createAssistant({
    userId: user.id,
    firstName: 'Unread',
    surname: 'IncomingB',
  });

  await seedContact(user.apiKey, user.id, active.agentId, user.email);
  await seedContact(user.apiKey, user.id, incoming.agentId, user.email);
  await ensurePubSubTopic(active.agentId);
  await ensurePubSubTopic(incoming.agentId);

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);

  const itemActive = page.getByTestId(`assistant-list-item-${active.agentId}`);
  const itemIncoming = page.getByTestId(`assistant-list-item-${incoming.agentId}`);
  await expect(itemActive).toBeVisible({ timeout: 15_000 });
  await expect(itemIncoming).toBeVisible({ timeout: 15_000 });

  await itemActive.click();
  await expect(page.getByTestId('chat-scroll-area')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('textarea')).toBeEnabled({ timeout: 20_000 });
  await page.waitForTimeout(3_500);

  const stamp = Date.now();
  const messages = [`Unread msg #1 ${stamp}`, `Unread msg #2 ${stamp}`, `Unread msg #3 ${stamp}`];
  for (const msg of messages) {
    await publishUnifyMessageOutbound(incoming.agentId, {
      content: msg,
      contactId: incoming.bossContactId,
    });
    await page.waitForTimeout(150);
  }

  await openUnitySwitcher(page);
  const incomingBadge = page.getByTestId(`assistant-unread-badge-${incoming.agentId}`);
  await expect(incomingBadge).toBeVisible({ timeout: 20_000 });
  await expect(incomingBadge).toHaveText('3', { timeout: 10_000 });
  await expect(page.getByTestId(`assistant-unread-badge-${active.agentId}`)).toHaveCount(0);

  await itemIncoming.click();
  await expect(incomingBadge).toHaveCount(0, { timeout: 10_000 });

  for (const msg of messages) {
    await expect(page.locator(`[data-role="assistant"]:has-text("${msg}")`)).toHaveCount(1, {
      timeout: 15_000,
    });
  }

  const indices: number[] = [];
  for (const msg of messages) {
    const bubble = page.locator(`[data-role="assistant"]:has-text("${msg}")`).first();
    const idxStr = await bubble.getAttribute('data-index');
    indices.push(idxStr ? parseInt(idxStr, 10) : -1);
  }
  expect(indices[0]).toBeLessThan(indices[1]);
  expect(indices[1]).toBeLessThan(indices[2]);

  await itemActive.click();
  await page.waitForTimeout(500);
  await page.reload();
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);
  await expect(page.getByTestId(`assistant-list-item-${incoming.agentId}`)).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForTimeout(8_000);
  await expect(page.getByTestId(`assistant-unread-badge-${incoming.agentId}`)).toHaveCount(0);

  const persistedMsg = `Persisted unread ${Date.now()}`;
  await publishUnifyMessageOutbound(incoming.agentId, {
    content: persistedMsg,
    contactId: incoming.bossContactId,
  });
  await openUnitySwitcher(page);
  await expect(incomingBadge).toBeVisible({ timeout: 20_000 });
  await expect(incomingBadge).toHaveText('1');

  await page.reload();
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);
  await expect(page.getByTestId(`assistant-list-item-${incoming.agentId}`)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId(`assistant-unread-badge-${incoming.agentId}`)).toHaveText('1', {
    timeout: 15_000,
  });

  await itemIncoming.click();
  await openUnitySwitcher(page);
  await expect(page.getByTestId(`assistant-unread-badge-${incoming.agentId}`)).toHaveCount(0, {
    timeout: 10_000,
  });
});

test('messages arriving while a chat is open do not leak an unread badge for that assistant', async ({
  authedPage: page,
}) => {
  // Single assistant — publish a message for its topic while its chat is
  // the active one. Unread logic should suppress the bump (the user is
  // already looking at the chat).
  const target = createAssistant({
    userId: user.id,
    firstName: 'Active',
    surname: 'LookingA',
  });

  await seedContact(user.apiKey, user.id, target.agentId, user.email);
  await ensurePubSubTopic(target.agentId);

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);

  const listItem = page.getByTestId(`assistant-list-item-${target.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();
  await expect(page.getByTestId('chat-scroll-area')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('textarea')).toBeEnabled({ timeout: 20_000 });

  await page.waitForTimeout(3_500);

  const liveMsg = `Live assistant reply ${Date.now()}`;
  await publishUnifyMessageOutbound(target.agentId, {
    content: liveMsg,
    contactId: CONTACT_ID,
  });

  // The message renders in the chat via the page-level chat-stream,
  // deduped against the `chatHistories` map so it appears exactly once.
  const bubble = page.locator(`[data-role="assistant"]:has-text("${liveMsg}")`);
  await expect(bubble).toBeVisible({ timeout: 20_000 });
  await expect(bubble).toHaveCount(1);

  // No unread badge for the active assistant (open the switcher to inspect
  // the list — rows/badges only mount inside the switcher).
  await openUnitySwitcher(page);
  await expect(page.getByTestId(`assistant-unread-badge-${target.agentId}`)).toHaveCount(0);
});

// ===========================================================================
// Stress / Edge-case Chat Stream Tests
// ===========================================================================
//
// These exercise the page-level chat-stream surface from the user's
// perspective: many assistants, cross-tab sync, late-arriving topics, and
// chat-during-call. They are intentionally agnostic to internals (sharding,
// BroadcastChannel, ack endpoints, retry timers) and assert only on what the
// user can actually see — list badges, message bubbles, typing indicators,
// the call dialog's chat panel.
//
// All require the local `--chat` harness (Pub/Sub emulator) to be running.

test('typing indicator from a recent send only shows in the chat where the message was sent', async ({
  authedPage: page,
}) => {
  const sender = createAssistant({
    userId: user.id,
    firstName: 'TypingA',
    surname: 'SenderA',
  });
  const other = createAssistant({
    userId: user.id,
    firstName: 'TypingB',
    surname: 'OtherB',
  });

  await seedContact(user.apiKey, user.id, sender.agentId, user.email);
  await seedContact(user.apiKey, user.id, other.agentId, user.email);
  await ensurePubSubTopic(sender.agentId);
  await ensurePubSubTopic(other.agentId);

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);

  const itemSender = page.getByTestId(`assistant-list-item-${sender.agentId}`);
  const itemOther = page.getByTestId(`assistant-list-item-${other.agentId}`);
  await expect(itemSender).toBeVisible({ timeout: 15_000 });
  await expect(itemOther).toBeVisible({ timeout: 15_000 });

  await itemSender.click();
  const chatArea = page.getByTestId('chat-scroll-area');
  await expect(chatArea).toBeVisible({ timeout: 10_000 });
  const textarea = page.locator('textarea');
  await expect(textarea).toBeEnabled({ timeout: 20_000 });

  // Send a user message; the panel schedules a typing indicator a few
  // seconds later (the assistant hasn't replied yet in the test harness).
  const sentMsg = `Trigger typing ${Date.now()}`;
  await textarea.fill(sentMsg);
  await textarea.press('Enter');
  await expect(page.locator(`[data-role="user"]:has-text("${sentMsg}")`)).toBeVisible({
    timeout: 10_000,
  });

  // Wait long enough for the typing indicator to appear in the sender's chat.
  const typingInSender = chatArea.getByText('Typing', { exact: true });
  await expect(typingInSender).toBeVisible({ timeout: 15_000 });

  // Switch to the other assistant — its chat must not show "Typing".
  await openUnitySwitcher(page);
  await itemOther.click();
  await expect(page.getByTestId('chat-scroll-area')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('textarea')).toBeEnabled({ timeout: 20_000 });

  // Give the panel a beat to settle into the new assistant's state.
  await page.waitForTimeout(1_500);
  await expect(
    page.getByTestId('chat-scroll-area').getByText('Typing', { exact: true })
  ).toHaveCount(0);
});

// --- T4: many assistants, messages for any get badges (sharding stress) -----

test('unread badges fire correctly when there are many assistants in the workspace', async ({
  authedPage: page,
}) => {
  // Significantly more than the page-level shard size, exercising delivery
  // across multiple stream connections from the user's POV.
  const ASSISTANT_COUNT = 27;
  const many = Array.from({ length: ASSISTANT_COUNT }, (_, i) =>
    createAssistant({
      userId: user.id,
      firstName: 'Shard',
      surname: `Bot${String(i).padStart(2, '0')}`,
    })
  );

  // Seed contacts and topics in parallel — with 27 assistants the serial
  // path is prohibitively slow.
  await Promise.all(many.map((a) => seedContact(user.apiKey, user.id, a.agentId, user.email)));
  await Promise.all(many.map((a) => ensurePubSubTopic(a.agentId)));

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);

  // Wait for the full list to populate.
  for (const a of [many[0], many[Math.floor(many.length / 2)], many[many.length - 1]]) {
    await expect(page.getByTestId(`assistant-list-item-${a.agentId}`)).toBeVisible({
      timeout: 20_000,
    });
  }

  // Open the first assistant — it becomes the active one and is excluded
  // from unread bumps. Badges from messages to other assistants should
  // still appear regardless of where they land in the list.
  await page.getByTestId(`assistant-list-item-${many[0].agentId}`).click();
  await expect(page.getByTestId('chat-scroll-area')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('textarea')).toBeEnabled({ timeout: 20_000 });

  // Generous wait: creating 27 Pub/Sub subscriptions across multiple
  // client shards on the emulator is not cheap.
  await page.waitForTimeout(12_000);

  // Pick two distinct targets that are far apart in the list — at least
  // one of them is guaranteed to fall outside the first batch of
  // subscriptions, exercising the cross-batch delivery path.
  const targets = [many[Math.floor(many.length / 2)], many[many.length - 1]];
  const stamp = Date.now();

  for (const t of targets) {
    await publishUnifyMessageOutbound(t.agentId, {
      content: `Shard fan-out for ${t.agentId} ${stamp}`,
      contactId: CONTACT_ID,
    });
  }

  // Rows/badges only mount inside the switcher — open it to inspect.
  await openUnitySwitcher(page);
  for (const t of targets) {
    const badge = page.getByTestId(`assistant-unread-badge-${t.agentId}`);
    await expect(badge).toBeVisible({ timeout: 30_000 });
    await expect(badge).toHaveText('1');
  }

  // The active assistant must never get a badge.
  await expect(page.getByTestId(`assistant-unread-badge-${many[0].agentId}`)).toHaveCount(0);
});

test('a user message sent in one tab appears in a second tab viewing the same chat', async ({
  authedPage: page,
}) => {
  const target = createAssistant({
    userId: user.id,
    firstName: 'CrossTab',
    surname: 'TargetX',
  });

  await seedContact(user.apiKey, user.id, target.agentId, user.email);
  await ensurePubSubTopic(target.agentId);

  // Open the assistant's chat in the original tab.
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);
  const item = page.getByTestId(`assistant-list-item-${target.agentId}`);
  await expect(item).toBeVisible({ timeout: 15_000 });
  await item.click();
  await expect(page.getByTestId('chat-scroll-area')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('textarea')).toBeEnabled({ timeout: 20_000 });

  // Spawn a second tab in the SAME browser context so the cross-tab
  // sync channel is shared.
  const page2 = await page.context().newPage();
  try {
    await page2.goto('/assistants');
    await closeHireDialogIfOpen(page2);
    await openUnitySwitcher(page2);
    const item2 = page2.getByTestId(`assistant-list-item-${target.agentId}`);
    await expect(item2).toBeVisible({ timeout: 15_000 });
    await item2.click();
    await expect(page2.getByTestId('chat-scroll-area')).toBeVisible({ timeout: 10_000 });
    await expect(page2.locator('textarea')).toBeEnabled({ timeout: 20_000 });

    // Give both panels a moment to mount their cross-tab sync listeners.
    await page.waitForTimeout(1_500);

    const sendMsg = `Cross-tab send ${Date.now()}`;
    await page.locator('textarea').fill(sendMsg);
    await page.locator('textarea').press('Enter');

    // The message renders as a user bubble in the originating tab
    // (optimistic insert) and in the sibling tab via the cross-tab sync
    // channel. Each tab dedups by id so it appears exactly once.
    await expect(page.locator(`[data-role="user"]:has-text("${sendMsg}")`)).toHaveCount(1, {
      timeout: 10_000,
    });
    await expect(page2.locator(`[data-role="user"]:has-text("${sendMsg}")`)).toHaveCount(1, {
      timeout: 30_000,
    });
  } finally {
    await page2.close();
  }
});

// --- T7: late-arriving topic eventually delivers ----------------------------

test('messages eventually arrive when the assistant topic comes online after page load', async ({
  authedPage: page,
}) => {
  test.setTimeout(180_000);

  const active = createAssistant({
    userId: user.id,
    firstName: 'LateA',
    surname: 'ActiveA',
  });
  const late = createAssistant({
    userId: user.id,
    firstName: 'LateB',
    surname: 'TopicB',
  });

  await seedContact(user.apiKey, user.id, active.agentId, user.email);
  await seedContact(user.apiKey, user.id, late.agentId, user.email);
  // Only pre-create active's topic. Late assistant's topic is created
  // mid-test to simulate a hire whose Communication topic provisioning
  // lagged behind the page load.
  await ensurePubSubTopic(active.agentId);

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);

  const itemActive = page.getByTestId(`assistant-list-item-${active.agentId}`);
  const itemLate = page.getByTestId(`assistant-list-item-${late.agentId}`);
  await expect(itemActive).toBeVisible({ timeout: 15_000 });
  await expect(itemLate).toBeVisible({ timeout: 15_000 });

  await itemActive.click();
  await expect(page.getByTestId('chat-scroll-area')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('textarea')).toBeEnabled({ timeout: 20_000 });

  // No badge yet on the late assistant — it has no topic to publish to.
  // Rows/badges only mount inside the switcher — open it to inspect.
  await page.waitForTimeout(3_500);
  await openUnitySwitcher(page);
  await expect(page.getByTestId(`assistant-unread-badge-${late.agentId}`)).toHaveCount(0);

  // Now provision the topic and keep publishing periodically. The page
  // retries skipped subscriptions on a backoff, so the badge should appear
  // within ~1 minute even though we never reload.
  await ensurePubSubTopic(late.agentId);

  const lateBadge = page.getByTestId(`assistant-unread-badge-${late.agentId}`);
  let appeared = false;
  const deadline = Date.now() + 90_000;
  let counter = 0;
  while (Date.now() < deadline) {
    counter += 1;
    await publishUnifyMessageOutbound(late.agentId, {
      content: `Late topic delivery ${counter} @ ${Date.now()}`,
      contactId: CONTACT_ID,
    });
    appeared = await lateBadge.isVisible({ timeout: 5_000 }).catch(() => false);
    if (appeared) break;
    await page.waitForTimeout(5_000);
  }
  expect(appeared).toBe(true);
});

// --- T8: chat received during an active call shows in the call panel --------

test('messages received during an active call appear in the call dialog chat panel @critical @area(assistants.chat.stream)', async ({
  authedPage: page,
}) => {
  const callee = createAssistant({
    userId: user.id,
    firstName: 'CallChat',
    surname: 'CalleeC',
  });

  await seedContact(user.apiKey, user.id, callee.agentId, user.email);
  await ensurePubSubTopic(callee.agentId);

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);

  const item = page.getByTestId(`assistant-list-item-${callee.agentId}`);
  await expect(item).toBeVisible({ timeout: 15_000 });
  await item.click();
  await expect(page.getByTestId('chat-scroll-area')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('textarea')).toBeEnabled({ timeout: 20_000 });
  await page.waitForTimeout(2_000);

  // Start an audio call.
  const audioBtn = page.getByTestId('call-audio-button');
  await expect(audioBtn).toBeVisible({ timeout: 10_000 });
  await audioBtn.click();

  const callHeader = page.locator(`text=Talk to CallChat CalleeC`);
  await expect(callHeader).toBeVisible({ timeout: 30_000 });

  // Reveal the call dialog's chat side panel.
  const chatToggle = page.getByRole('button', { name: 'Toggle chat' });
  await expect(chatToggle).toBeVisible({ timeout: 10_000 });
  await chatToggle.click();
  await page.waitForTimeout(2_000);

  const inCallMsg = `Message during call ${Date.now()}`;
  await publishUnifyMessageOutbound(callee.agentId, {
    content: inCallMsg,
    contactId: CONTACT_ID,
  });

  // The message must appear in the call dialog's chat side panel, scoped
  // to avoid the identical bubble also rendered in the main page panel.
  const callChat = page.getByTestId('call-side-panel-chat');
  await expect(callChat).toBeVisible({ timeout: 5_000 });
  const bubble = callChat.locator(`[data-role="assistant"]:has-text("${inCallMsg}")`);
  await expect(bubble).toHaveCount(1, { timeout: 25_000 });

  // The active-call assistant must not show an unread badge in the list.
  await expect(page.getByTestId(`assistant-unread-badge-${callee.agentId}`)).toHaveCount(0);

  // Cleanup — end the call so subsequent tests start clean.
  const endCallBtn = page.getByRole('button', { name: 'End call' });
  await endCallBtn.click();
  await expect(callHeader).not.toBeVisible({ timeout: 10_000 });
});
