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

test('switching to another assistant and back keeps each chat working independently', async ({
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
// the count stays cleared across reloads within the Pub/Sub retention
// window.
//
// Requires the local `--chat` harness: the Pub/Sub emulator (localhost:8085)
// has to be up so the test can publish `unify_message_outbound` frames
// directly to the assistant's topic, bypassing the full Communication +
// Unity adapter pipeline.

test('unread message badge appears for an inactive assistant and clears when its chat is opened', async ({
  authedPage: page,
}) => {
  const assistantA = createAssistant({
    userId: user.id,
    firstName: 'Unread',
    surname: 'AlphaA',
  });
  const assistantB = createAssistant({
    userId: user.id,
    firstName: 'Unread',
    surname: 'BravoB',
  });

  await seedContact(user.apiKey, user.id, assistantA.agentId, user.email);
  await seedContact(user.apiKey, user.id, assistantB.agentId, user.email);

  // The page-level chat-stream needs both topics to exist before it can
  // attach its `-chat-{contactId}` subscriptions. Communication normally
  // creates these on hire; in the test harness we do it manually.
  await ensurePubSubTopic(assistantA.agentId);
  await ensurePubSubTopic(assistantB.agentId);

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);

  const itemA = page.getByTestId(`assistant-list-item-${assistantA.agentId}`);
  const itemB = page.getByTestId(`assistant-list-item-${assistantB.agentId}`);
  await expect(itemA).toBeVisible({ timeout: 15_000 });
  await expect(itemB).toBeVisible({ timeout: 15_000 });

  // Open A's chat — A is now the active assistant, so only messages for B
  // will bump the unread counter.
  await itemA.click();
  await expect(page.getByTestId('chat-scroll-area')).toBeVisible({ timeout: 10_000 });
  const textareaA = page.locator('textarea');
  await expect(textareaA).toBeEnabled({ timeout: 20_000 });

  // Give the page-level chat-stream time to subscribe to B's topic.
  // Subscriptions are created lazily on first SSE connect and only
  // buffer messages published AFTER they exist, so publishing before the
  // stream connects would produce zero unread.
  await page.waitForTimeout(3_500);

  // Publish an assistant reply for B via the Pub/Sub emulator.
  const unreadMsg1 = `Unread B msg #1 ${Date.now()}`;
  await publishUnifyMessageOutbound(assistantB.agentId, {
    content: unreadMsg1,
    contactId: assistantB.bossContactId,
  });
  await openUnitySwitcher(page);

  // Badge on B's list item appears.
  const badgeB = page.getByTestId(`assistant-unread-badge-${assistantB.agentId}`);
  await expect(badgeB).toBeVisible({ timeout: 20_000 });
  await expect(badgeB).toHaveText('1');

  // A is the active assistant — no badge should ever appear on A, even if
  // a message arrived on A's topic (which we don't publish here).
  await expect(page.getByTestId(`assistant-unread-badge-${assistantA.agentId}`)).toHaveCount(0);

  // Second message for B — badge increments.
  const unreadMsg2 = `Unread B msg #2 ${Date.now()}`;
  await publishUnifyMessageOutbound(assistantB.agentId, {
    content: unreadMsg2,
    contactId: assistantB.bossContactId,
  });
  await expect(badgeB).toHaveText('2', { timeout: 10_000 });

  // Opening B's chat clears the unread badge (markAsRead persists
  // `lastReadAt` in localStorage).
  await itemB.click();
  await expect(page.getByTestId(`assistant-unread-badge-${assistantB.agentId}`)).toHaveCount(0, {
    timeout: 10_000,
  });

  // B's chat should also contain both previously-unread messages now —
  // proving the page-level chat-stream was merging into chatHistories
  // even while B's panel was closed.
  await expect(page.locator(`[data-role="assistant"]:has-text("${unreadMsg1}")`)).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator(`[data-role="assistant"]:has-text("${unreadMsg2}")`)).toBeVisible({
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
  // the list — rows/badges only mount inside the popover).
  await openUnitySwitcher(page);
  await expect(page.getByTestId(`assistant-unread-badge-${target.agentId}`)).toHaveCount(0);
});

// ===========================================================================
// Stress / Edge-case Chat Stream Tests
// ===========================================================================
//
// These exercise the page-level chat-stream surface from the user's
// perspective: many assistants, rapid bursts, cross-tab tabs, late-arriving
// topics, and chat-during-call. They are intentionally agnostic to internals
// (sharding, BroadcastChannel, ack endpoints, retry timers) and assert only
// on what the user can actually see — list badges, message bubbles, typing
// indicators, the call dialog's chat panel.
//
// All require the local `--chat` harness (Pub/Sub emulator) to be running.

// --- T1: unread cleared after open persists across reload -------------------

test('unread badge stays cleared after the chat is opened, even after a reload', async ({
  authedPage: page,
}) => {
  const active = createAssistant({
    userId: user.id,
    firstName: 'PersistA',
    surname: 'ActiveA',
  });
  const incoming = createAssistant({
    userId: user.id,
    firstName: 'PersistB',
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

  const unreadMsg = `Persist unread ${Date.now()}`;
  await publishUnifyMessageOutbound(incoming.agentId, {
    content: unreadMsg,
    contactId: CONTACT_ID,
  });

  // Rows/badges only mount inside the switcher popover — open it to inspect.
  await openUnitySwitcher(page);
  const incomingBadge = page.getByTestId(`assistant-unread-badge-${incoming.agentId}`);
  await expect(incomingBadge).toBeVisible({ timeout: 45_000 });
  await expect(incomingBadge).toHaveText('1');

  // Open the incoming assistant's chat — badge clears.
  await itemIncoming.click();
  await expect(page.locator(`[data-role="assistant"]:has-text("${unreadMsg}")`)).toBeVisible({
    timeout: 10_000,
  });
  await openUnitySwitcher(page);
  await expect(page.getByTestId(`assistant-unread-badge-${incoming.agentId}`)).toHaveCount(0, {
    timeout: 10_000,
  });

  // Switch to the other assistant so a reload doesn't auto-open the same
  // chat (which would itself clear any badge), then reload.
  await itemActive.click();
  await page.waitForTimeout(500);
  await page.reload();
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);
  await expect(page.getByTestId(`assistant-list-item-${incoming.agentId}`)).toBeVisible({
    timeout: 15_000,
  });

  // Give the stream time to (re)establish; even though the message is still
  // within Pub/Sub's retention window, it should not bump the badge again
  // because the user has already read it.
  await page.waitForTimeout(8_000);
  await expect(page.getByTestId(`assistant-unread-badge-${incoming.agentId}`)).toHaveCount(0);
});

// --- T1c: in-session unread badge survives a reload ------------------------

test('an unread badge accumulated during the session survives a reload', async ({
  authedPage: page,
}) => {
  // The page-level handler in Main.tsx ack's every received message
  // immediately, so on reload Pub/Sub has nothing to redeliver. The badge
  // can only come back if `unreadCounts` itself is persisted to
  // localStorage.
  const active = createAssistant({
    userId: user.id,
    firstName: 'PersistedA',
    surname: 'ActiveA',
  });
  const incoming = createAssistant({
    userId: user.id,
    firstName: 'PersistedB',
    surname: 'IncomingB',
  });

  await Promise.all([
    seedContact(user.apiKey, user.id, active.agentId, user.email),
    seedContact(user.apiKey, user.id, incoming.agentId, user.email),
  ]);
  await Promise.all([ensurePubSubTopic(active.agentId), ensurePubSubTopic(incoming.agentId)]);

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);

  await page.getByTestId(`assistant-list-item-${active.agentId}`).click();
  await expect(page.getByTestId('chat-scroll-area')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('textarea')).toBeEnabled({ timeout: 20_000 });
  await page.waitForTimeout(3_500);

  const persistedMsg = `Persisted unread ${Date.now()}`;
  await publishUnifyMessageOutbound(incoming.agentId, {
    content: persistedMsg,
    contactId: CONTACT_ID,
  });

  // Rows/badges only mount inside the switcher popover — open it to inspect.
  await openUnitySwitcher(page);
  const incomingBadge = page.getByTestId(`assistant-unread-badge-${incoming.agentId}`);
  await expect(incomingBadge).toBeVisible({ timeout: 20_000 });
  await expect(incomingBadge).toHaveText('1');

  // Reload while `incoming` is still unread. The previously-active chat
  // (`active`) will reopen — markAsRead only clears `active`'s count, so
  // the persisted badge for `incoming` should be re-rendered from
  // localStorage on mount.
  await page.reload();
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);

  await expect(page.getByTestId(`assistant-list-item-${incoming.agentId}`)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId(`assistant-unread-badge-${incoming.agentId}`)).toHaveText('1', {
    timeout: 15_000,
  });

  // Opening `incoming` clears the badge and persists the cleared state.
  await page.getByTestId(`assistant-list-item-${incoming.agentId}`).click();
  await openUnitySwitcher(page);
  await expect(page.getByTestId(`assistant-unread-badge-${incoming.agentId}`)).toHaveCount(0, {
    timeout: 10_000,
  });
});

// --- T1a: messages received while away from /assistants surface as unread --

test('messages received while the user is on a different page surface as unread on return', async ({
  authedPage: page,
}) => {
  // The page-level chat-stream only mounts on /assistants. When the user
  // navigates away the SSE detaches but the server-side Pub/Sub
  // subscription is persistent, so on return any messages that arrived
  // in the meantime are redelivered and should bump the badge.
  const active = createAssistant({
    userId: user.id,
    firstName: 'AwayA',
    surname: 'ActiveA',
  });
  const incoming = createAssistant({
    userId: user.id,
    firstName: 'AwayB',
    surname: 'IncomingB',
  });

  await Promise.all([
    seedContact(user.apiKey, user.id, active.agentId, user.email),
    seedContact(user.apiKey, user.id, incoming.agentId, user.email),
  ]);
  await Promise.all([ensurePubSubTopic(active.agentId), ensurePubSubTopic(incoming.agentId)]);

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);

  // Mount the chat-stream once so the persistent server-side subscription
  // for `incoming` actually exists before we publish to it (Pub/Sub only
  // retains messages on subscriptions that have been provisioned). Open
  // `active` so `incoming` is the unread target.
  await page.getByTestId(`assistant-list-item-${active.agentId}`).click();
  await expect(page.getByTestId('chat-scroll-area')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('textarea')).toBeEnabled({ timeout: 20_000 });
  await page.waitForTimeout(3_500);

  // Navigate away from /assistants — Main unmounts, the chat-stream hook
  // tears down its EventSource. The Pub/Sub subscription remains.
  await page.goto('/account');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  // Publish while no client is consuming. The message accumulates in the
  // subscription's backlog.
  const awayMsg = `Arrived while away ${Date.now()}`;
  await publishUnifyMessageOutbound(incoming.agentId, {
    content: awayMsg,
    contactId: CONTACT_ID,
  });

  // Give Pub/Sub a beat to fan-out then return to /assistants.
  await page.waitForTimeout(2_000);
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);

  // The redelivered backlog message should bump the badge — proves the
  // mount-time floor is no longer suppressing it.
  const incomingBadge = page.getByTestId(`assistant-unread-badge-${incoming.agentId}`);
  await expect(incomingBadge).toBeVisible({ timeout: 25_000 });
  await expect(incomingBadge).toHaveText('1');
});

// --- T1b: total unread count surfaces in the browser tab title --------------

test('browser tab title reflects total unread messages across assistants', async ({
  authedPage: page,
}) => {
  const active = createAssistant({
    userId: user.id,
    firstName: 'TitleA',
    surname: 'ActiveA',
  });
  const incomingB = createAssistant({
    userId: user.id,
    firstName: 'TitleB',
    surname: 'IncomingB',
  });
  const incomingC = createAssistant({
    userId: user.id,
    firstName: 'TitleC',
    surname: 'IncomingC',
  });

  await Promise.all([
    seedContact(user.apiKey, user.id, active.agentId, user.email),
    seedContact(user.apiKey, user.id, incomingB.agentId, user.email),
    seedContact(user.apiKey, user.id, incomingC.agentId, user.email),
  ]);
  await Promise.all([
    ensurePubSubTopic(active.agentId),
    ensurePubSubTopic(incomingB.agentId),
    ensurePubSubTopic(incomingC.agentId),
  ]);

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);

  // Open the active assistant so any messages on B and C bump the unread
  // counter and, in turn, the document title.
  await page.getByTestId(`assistant-list-item-${active.agentId}`).click();
  await expect(page.getByTestId('chat-scroll-area')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('textarea')).toBeEnabled({ timeout: 20_000 });

  // Title starts with no `(N) ` prefix.
  const baseTitle = await page.title();
  expect(baseTitle).not.toMatch(/^\(\d+\)\s/);

  await page.waitForTimeout(3_500);

  // One message for B → title should become `(1) <baseTitle>`.
  await publishUnifyMessageOutbound(incomingB.agentId, {
    content: `Title test B ${Date.now()}`,
    contactId: CONTACT_ID,
  });
  await expect.poll(() => page.title(), { timeout: 45_000 }).toBe(`(1) ${baseTitle}`);

  // Two more messages for C → total should be 3.
  await publishUnifyMessageOutbound(incomingC.agentId, {
    content: `Title test C1 ${Date.now()}`,
    contactId: CONTACT_ID,
  });
  await publishUnifyMessageOutbound(incomingC.agentId, {
    content: `Title test C2 ${Date.now()}`,
    contactId: CONTACT_ID,
  });
  await expect.poll(() => page.title(), { timeout: 45_000 }).toBe(`(3) ${baseTitle}`);

  // Opening B clears B's count → total drops to 2.
  await openUnitySwitcher(page);
  await page.getByTestId(`assistant-list-item-${incomingB.agentId}`).click();
  await expect.poll(() => page.title(), { timeout: 10_000 }).toBe(`(2) ${baseTitle}`);

  // Opening C clears the rest → prefix disappears entirely.
  await openUnitySwitcher(page);
  await page.getByTestId(`assistant-list-item-${incomingC.agentId}`).click();
  await expect.poll(() => page.title(), { timeout: 10_000 }).toBe(baseTitle);
});

// --- T2: unread badge accumulates and bubbles render in order ---------------

test('multiple unread messages all appear in chronological order when the chat is opened', async ({
  authedPage: page,
}) => {
  const active = createAssistant({
    userId: user.id,
    firstName: 'OrderA',
    surname: 'ActiveA',
  });
  const target = createAssistant({
    userId: user.id,
    firstName: 'OrderB',
    surname: 'TargetB',
  });

  await seedContact(user.apiKey, user.id, active.agentId, user.email);
  await seedContact(user.apiKey, user.id, target.agentId, user.email);
  await ensurePubSubTopic(active.agentId);
  await ensurePubSubTopic(target.agentId);

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);

  const itemActive = page.getByTestId(`assistant-list-item-${active.agentId}`);
  const itemTarget = page.getByTestId(`assistant-list-item-${target.agentId}`);
  await expect(itemActive).toBeVisible({ timeout: 15_000 });
  await expect(itemTarget).toBeVisible({ timeout: 15_000 });

  await itemActive.click();
  await expect(page.getByTestId('chat-scroll-area')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('textarea')).toBeEnabled({ timeout: 20_000 });
  await page.waitForTimeout(3_500);

  const stamp = Date.now();
  const messages = [`Order msg #1 ${stamp}`, `Order msg #2 ${stamp}`, `Order msg #3 ${stamp}`];
  // Small spacings so Pub/Sub publish-ordering is deterministic.
  for (const msg of messages) {
    await publishUnifyMessageOutbound(target.agentId, {
      content: msg,
      contactId: CONTACT_ID,
    });
    await page.waitForTimeout(150);
  }

  // Rows/badges only mount inside the switcher popover — open it to inspect.
  await openUnitySwitcher(page);
  const targetBadge = page.getByTestId(`assistant-unread-badge-${target.agentId}`);
  await expect(targetBadge).toBeVisible({ timeout: 20_000 });
  await expect(targetBadge).toHaveText('3', { timeout: 10_000 });

  await itemTarget.click();
  await expect(targetBadge).toHaveCount(0, { timeout: 10_000 });

  for (const msg of messages) {
    await expect(page.locator(`[data-role="assistant"]:has-text("${msg}")`)).toHaveCount(1, {
      timeout: 15_000,
    });
  }

  // Verify chronological order: the data-index attribute on each bubble is
  // monotonically increasing in render order, so msg #1 < #2 < #3.
  const indices: number[] = [];
  for (const msg of messages) {
    const bubble = page.locator(`[data-role="assistant"]:has-text("${msg}")`).first();
    const idxStr = await bubble.getAttribute('data-index');
    indices.push(idxStr ? parseInt(idxStr, 10) : -1);
  }
  expect(indices[0]).toBeLessThan(indices[1]);
  expect(indices[1]).toBeLessThan(indices[2]);
});

// --- T3: typing indicator scoped to the active chat -------------------------

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

  // Rows/badges only mount inside the switcher popover — open it to inspect.
  await openUnitySwitcher(page);
  for (const t of targets) {
    const badge = page.getByTestId(`assistant-unread-badge-${t.agentId}`);
    await expect(badge).toBeVisible({ timeout: 30_000 });
    await expect(badge).toHaveText('1');
  }

  // The active assistant must never get a badge.
  await expect(page.getByTestId(`assistant-unread-badge-${many[0].agentId}`)).toHaveCount(0);
});

// --- T5: rapid inbound burst preserves order in the active chat -------------

test('a rapid burst of inbound messages renders in chronological order in the open chat', async ({
  authedPage: page,
}) => {
  const target = createAssistant({
    userId: user.id,
    firstName: 'Burst',
    surname: 'TargetB',
  });

  await seedContact(user.apiKey, user.id, target.agentId, user.email);
  await ensurePubSubTopic(target.agentId);

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);

  const item = page.getByTestId(`assistant-list-item-${target.agentId}`);
  await expect(item).toBeVisible({ timeout: 15_000 });
  await item.click();
  await expect(page.getByTestId('chat-scroll-area')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('textarea')).toBeEnabled({ timeout: 20_000 });
  await page.waitForTimeout(3_500);

  const stamp = Date.now();
  const burst = Array.from({ length: 6 }, (_, i) => `Burst msg #${i + 1} ${stamp}`);

  for (const msg of burst) {
    await publishUnifyMessageOutbound(target.agentId, {
      content: msg,
      contactId: CONTACT_ID,
    });
    await page.waitForTimeout(80); // small spacing for deterministic publish order
  }

  for (const msg of burst) {
    await expect(page.locator(`[data-role="assistant"]:has-text("${msg}")`)).toHaveCount(1, {
      timeout: 25_000,
    });
  }

  const indices: number[] = [];
  for (const msg of burst) {
    const bubble = page.locator(`[data-role="assistant"]:has-text("${msg}")`).first();
    const idxStr = await bubble.getAttribute('data-index');
    indices.push(idxStr ? parseInt(idxStr, 10) : -1);
  }
  for (let i = 1; i < indices.length; i++) {
    expect(indices[i - 1]).toBeLessThan(indices[i]);
  }

  // The active assistant has no unread badge while its chat is open.
  await openUnitySwitcher(page);
  await expect(page.getByTestId(`assistant-unread-badge-${target.agentId}`)).toHaveCount(0);
});

// --- T6: cross-tab — a send in one tab renders in a sibling tab -------------

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
  // Rows/badges only mount inside the switcher popover — open it to inspect.
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

test('messages received during an active call appear in the call dialog chat panel', async ({
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
