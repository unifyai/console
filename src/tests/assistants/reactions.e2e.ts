/**
 * Emoji reaction E2E — display and toggle reactions in unify chat.
 *
 * Run: npx playwright test src/tests/assistants/reactions.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  deleteAllAssistantsForUser,
  ensureProjectSync,
} from './helpers';
import {
  createContactSeeder,
  createTranscriptSeeder,
  createOpenAssistantChat,
} from './chat-helpers';

const user = createTestUser({ name: 'ReactionsE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'ReactBot',
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
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

test('seeded reactions render from transcript metadata @push @area(assistants.chat)', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);
  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: ASSISTANT_CONTACT_ID,
    content: 'Message with a saved reaction',
    medium: 'unify_message',
    receiverIds: [CONTACT_ID],
    metadata: {
      reactions: [{ contact_id: CONTACT_ID, emoji: '👍', updated_at: new Date().toISOString() }],
    },
  });

  await openAssistantChat(page);
  await page.waitForSelector('[data-testid="message-bubble"][data-role="assistant"]', {
    timeout: 30_000,
  });
  await expect(page.getByTestId('chat-message-reactions').first()).toContainText('👍');

  await page.reload();
  await page.waitForSelector('[data-testid="message-bubble"][data-role="assistant"]', {
    timeout: 30_000,
  });
  await expect(page.getByTestId('chat-message-reactions').first()).toContainText('👍');
});

test('user can add and remove a reaction optimistically in the chat UI @push @area(assistants.chat)', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);
  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: ASSISTANT_CONTACT_ID,
    content: 'React to me!',
    medium: 'unify_message',
    receiverIds: [CONTACT_ID],
  });

  await openAssistantChat(page);
  await page.waitForSelector('[data-testid="message-bubble"][data-role="assistant"]', {
    timeout: 30_000,
  });

  // The unified shell can keep a hidden duplicate chat surface mounted, so
  // scope the hover/click/assert chain to the visible bubble only — page-wide
  // locators can hit the hidden copy, whose state never updates.
  const assistantBubble = page
    .locator('[data-testid="message-bubble"][data-role="assistant"]:visible')
    .first();
  await assistantBubble.hover();
  await assistantBubble.getByTestId('chat-reaction-picker').click();
  await page.getByTestId('chat-reaction-👍').click();
  await expect(assistantBubble.getByTestId('chat-message-reactions')).toContainText('👍', {
    timeout: 15_000,
  });

  await assistantBubble.getByTestId('chat-reaction-chip-👍').click();
  await expect(assistantBubble.getByTestId('chat-message-reactions')).toHaveCount(0);
});

test('user can pick a custom emoji from the expanded reaction picker @push @area(assistants.chat)', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);
  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: ASSISTANT_CONTACT_ID,
    content: 'Pick a party emoji!',
    medium: 'unify_message',
    receiverIds: [CONTACT_ID],
  });

  await openAssistantChat(page);
  await page.waitForSelector('[data-testid="message-bubble"][data-role="assistant"]', {
    timeout: 30_000,
  });

  const assistantBubble = page
    .locator('[data-testid="message-bubble"][data-role="assistant"]:visible')
    .first();
  await assistantBubble.hover();
  await assistantBubble.getByTestId('chat-reaction-picker').click();
  await page.getByTestId('chat-reaction-expand').click();
  // Multiple Search inputs exist across mounted shell surfaces; scope to the
  // emoji picker portal.
  const emojiSearch = page.locator('.EmojiPickerReact').getByPlaceholder('Search');
  await expect(emojiSearch).toBeVisible();

  await emojiSearch.fill('tada');
  await page.locator('.EmojiPickerReact button').filter({ hasText: '🎉' }).first().click();
  await expect(assistantBubble.getByTestId('chat-message-reactions')).toContainText('🎉', {
    timeout: 15_000,
  });
});
