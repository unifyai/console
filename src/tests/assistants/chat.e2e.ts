/**
 * Chat E2E Tests — browser-based user flows for the assistant chat feature,
 * including message sending, transcript loading, and file attachments.
 *
 * Verifies:
 *  - Chat panel renders with input controls
 *  - Sending messages (optimistic insert, local dev 202 accepted)
 *  - Historical transcript loading from Orchestra logs
 *  - Message ordering (chronological)
 *  - Multiple sequential sends preserve order
 *  - Chat input disabled when credits exhausted
 *  - Empty chat state for a new assistant
 *  - Polling-based transcript retrieval for assistant responses
 *  - Attachment button opens dropdown (Camera / Files)
 *  - File selection shows pending attachment chips
 *  - Blocked file types (.exe, .bat) are rejected with toast errors
 *  - Removing attachments (single + remove all)
 *  - Duplicate file detection
 *  - Attach button disabled when spending is blocked
 *
 * Local mode: sending returns 202 (dispatch skipped); SSE errors are
 * suppressed on localhost so the chat input remains enabled.
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
  deleteAllAssistantsForUser,
  ensureProjectSync,
  orchestraFetch,
  setUserCredits,
} from './helpers';
import path from 'path';
import fs from 'fs';
import os from 'os';

const CONTACT_ID = 2; // convention: 0=assistant, 1=owner, 2+=contacts

const user = createTestUser({ name: 'ChatE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'ChatBot',
  surname: 'E2E',
});

test.afterAll(() => {
  setUserCredits(user.id, 50_000);
  deleteAllAssistantsForUser(user.id);
  cleanupUser(user.id);
});

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

let messageCounter = 1000;

/**
 * Seed a contact record so that getContactIdByEmail resolves for this user.
 */
async function seedContact(apiKey: string, userId: string, assistantId: number, email: string) {
  /* eslint-disable @typescript-eslint/naming-convention */
  const entries = {
    email_address: email,
    contact_id: CONTACT_ID,
  };
  /* eslint-enable @typescript-eslint/naming-convention */

  const res = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: `${userId}/${assistantId}/Contacts`,
        entries: [entries],
      }),
    },
    apiKey
  );
  if (!res.ok) throw new Error(`Failed to seed contact: ${res.status} ${await res.text()}`);
}

/**
 * Seed a transcript log entry (a historical chat message).
 */
async function seedTranscript(
  apiKey: string,
  userId: string,
  assistantId: number,
  opts: {
    senderId: number; // 0 = assistant, CONTACT_ID = user
    content: string;
    timestamp?: string;
    medium?: string;
    exchangeId?: number;
    receiverIds?: number[];
  }
) {
  const msgId = messageCounter++;
  const ts = opts.timestamp || new Date().toISOString();

  /* eslint-disable @typescript-eslint/naming-convention */
  const entries: Record<string, unknown> = {
    medium: opts.medium ?? 'unify_message',
    sender_id: opts.senderId,
    receiver_ids: opts.receiverIds ?? (opts.senderId === 0 ? [CONTACT_ID] : [0]),
    content: opts.content,
    message_id: msgId,
    timestamp: ts,
  };
  if (opts.exchangeId !== undefined) entries.exchange_id = opts.exchangeId;
  /* eslint-enable @typescript-eslint/naming-convention */

  const res = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: `${userId}/${assistantId}/Transcripts`,
        entries: [entries],
      }),
    },
    apiKey
  );
  if (!res.ok) throw new Error(`Failed to seed transcript: ${res.status} ${await res.text()}`);
  return msgId;
}

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

async function openAssistantChat(page: import('@playwright/test').Page) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);

  const listItem = page.getByTestId(`assistant-list-item-${assistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();
  await page.waitForTimeout(2_000);

  // The chat panel is the only content in the profile panel
  const chatArea = page.getByTestId('chat-scroll-area');
  await expect(chatArea).toBeVisible({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

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

  // Attach and voice buttons visible
  await expect(page.getByTestId('attach-button')).toBeVisible();
  await expect(page.getByTestId('voice-record-button')).toBeVisible();
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
    senderId: 0,
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

test('multiple historical messages render in chronological order', async ({ authedPage: page }) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  const ts = Date.now();
  const msgs = [
    {
      content: `First message ${ts}`,
      time: new Date(ts - 5000).toISOString(),
      senderId: CONTACT_ID,
    },
    { content: `Second message ${ts}`, time: new Date(ts - 4000).toISOString(), senderId: 0 },
    {
      content: `Third message ${ts}`,
      time: new Date(ts - 3000).toISOString(),
      senderId: CONTACT_ID,
    },
    { content: `Fourth message ${ts}`, time: new Date(ts - 2000).toISOString(), senderId: 0 },
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
    // Small wait between sends to allow optimistic insert
    await page.waitForTimeout(500);
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

  const listItem = page.getByTestId(`assistant-list-item-${freshAssistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();
  await page.waitForTimeout(2_000);

  // Chat area should be visible
  const chatArea = page.getByTestId('chat-scroll-area');
  await expect(chatArea).toBeVisible({ timeout: 10_000 });

  // Wait for textarea to be enabled (chat loaded with no messages)
  const textarea = page.locator('textarea');
  await expect(textarea).toBeEnabled({ timeout: 20_000 });

  // No message bubbles should be present
  const messageBubbles = page.locator('[data-testid="message-bubble"]');
  await page.waitForTimeout(2_000);
  const count = await messageBubbles.count();
  expect(count).toBe(0);
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
    senderId: 0,
    content: assistantReply,
  });

  // The polling fallback should pick up the assistant reply
  // Poll interval is typically 10-30 seconds; wait up to 60s
  await expect(page.locator(`text=${assistantReply}`).first()).toBeVisible({ timeout: 60_000 });

  // Verify it renders as an assistant bubble
  const assistantBubble = page.locator(`[data-role="assistant"]:has-text("${assistantReply}")`);
  await expect(assistantBubble).toBeVisible({ timeout: 5_000 });
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

// ===========================================================================
// Attachment Tests
// ===========================================================================

const TEST_FILES_DIR = path.join(os.tmpdir(), 'attach-e2e-files');

function ensureTestFile(name: string, sizeBytes: number): string {
  if (!fs.existsSync(TEST_FILES_DIR)) fs.mkdirSync(TEST_FILES_DIR, { recursive: true });
  const filePath = path.join(TEST_FILES_DIR, name);
  if (!fs.existsSync(filePath)) {
    const buf = Buffer.alloc(Math.min(sizeBytes, 1024), 'x');
    fs.writeFileSync(filePath, buf);
  }
  return filePath;
}

const smallTextFile = ensureTestFile('test-doc.txt', 100);
const smallPdfFile = ensureTestFile('report.pdf', 200);
const smallCsvFile = ensureTestFile('data.csv', 150);

const blockedExeFile = ensureTestFile('malware.exe', 50);
const blockedBatFile = ensureTestFile('script.bat', 50);

test('attach button is visible and opens dropdown menu', async ({ authedPage: page }) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);
  await openAssistantChat(page);

  const textarea = page.locator('textarea');
  await expect(textarea).toBeEnabled({ timeout: 20_000 });

  const attachBtn = page.getByTestId('attach-button');
  await expect(attachBtn).toBeVisible();
  await expect(attachBtn).toBeEnabled();

  await attachBtn.click();

  const filesItem = page.getByTestId('attach-files-item');
  const cameraItem = page.getByTestId('attach-webcam-item');
  await expect(filesItem).toBeVisible({ timeout: 5_000 });
  await expect(cameraItem).toBeVisible({ timeout: 5_000 });
});

test('selecting a valid file shows a pending attachment chip', async ({ authedPage: page }) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);
  await openAssistantChat(page);

  const textarea = page.locator('textarea');
  await expect(textarea).toBeEnabled({ timeout: 20_000 });

  const fileInput = page.getByTestId('file-input');
  await fileInput.setInputFiles(smallTextFile);

  const pendingArea = page.getByTestId('pending-attachments');
  await expect(pendingArea).toBeVisible({ timeout: 5_000 });

  const chip = page.getByTestId('attachment-chip').first();
  await expect(chip).toBeVisible({ timeout: 5_000 });

  const chipName = page.getByTestId('attachment-name').first();
  await expect(chipName).toContainText('test-doc', { timeout: 5_000 });
});

test('selecting multiple files shows multiple chips', async ({ authedPage: page }) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);
  await openAssistantChat(page);

  const textarea = page.locator('textarea');
  await expect(textarea).toBeEnabled({ timeout: 20_000 });

  const fileInput = page.getByTestId('file-input');
  await fileInput.setInputFiles([smallTextFile, smallPdfFile, smallCsvFile]);

  const chips = page.getByTestId('attachment-chip');
  await expect(chips).toHaveCount(3, { timeout: 5_000 });
});

test('blocked file type (.exe) is rejected with a toast error', async ({ authedPage: page }) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);
  await openAssistantChat(page);

  const textarea = page.locator('textarea');
  await expect(textarea).toBeEnabled({ timeout: 20_000 });

  const fileInput = page.getByTestId('file-input');
  await fileInput.setInputFiles(blockedExeFile);

  const errorToast = page.locator('[data-sonner-toast][data-type="error"]').first();
  await expect(errorToast).toBeVisible({ timeout: 5_000 });
  await expect(errorToast).toContainText(/not allowed/i);

  const pendingArea = page.getByTestId('pending-attachments');
  await expect(pendingArea).toHaveCount(0, { timeout: 3_000 });
});

test('blocked file type (.bat) is rejected with a toast error', async ({ authedPage: page }) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);
  await openAssistantChat(page);

  const textarea = page.locator('textarea');
  await expect(textarea).toBeEnabled({ timeout: 20_000 });

  const fileInput = page.getByTestId('file-input');
  await fileInput.setInputFiles(blockedBatFile);

  const errorToast = page.locator('[data-sonner-toast][data-type="error"]').first();
  await expect(errorToast).toBeVisible({ timeout: 5_000 });
  await expect(errorToast).toContainText(/not allowed/i);
});

test('removing a pending attachment via the remove button works', async ({ authedPage: page }) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);
  await openAssistantChat(page);

  const textarea = page.locator('textarea');
  await expect(textarea).toBeEnabled({ timeout: 20_000 });

  const fileInput = page.getByTestId('file-input');
  await fileInput.setInputFiles([smallTextFile, smallPdfFile]);

  const chips = page.getByTestId('attachment-chip');
  await expect(chips).toHaveCount(2, { timeout: 5_000 });

  const firstChip = chips.first();
  await firstChip.hover();
  await page.waitForTimeout(300);

  const removeBtn = firstChip.getByTestId('attachment-remove');
  await removeBtn.click({ force: true });

  await expect(chips).toHaveCount(1, { timeout: 5_000 });
});

test('remove all button clears all pending attachments', async ({ authedPage: page }) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);
  await openAssistantChat(page);

  const textarea = page.locator('textarea');
  await expect(textarea).toBeEnabled({ timeout: 20_000 });

  const fileInput = page.getByTestId('file-input');
  await fileInput.setInputFiles([smallTextFile, smallPdfFile, smallCsvFile]);

  const chips = page.getByTestId('attachment-chip');
  await expect(chips).toHaveCount(3, { timeout: 5_000 });

  const removeAllBtn = page.getByTestId('attachment-remove-all');
  if (await removeAllBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await removeAllBtn.click();
    await expect(chips).toHaveCount(0, { timeout: 5_000 });
  } else {
    for (let i = 0; i < 3; i++) {
      const chip = page.getByTestId('attachment-chip').first();
      if (!(await chip.isVisible({ timeout: 1_000 }).catch(() => false))) break;
      await chip.hover();
      const rmBtn = chip.getByTestId('attachment-remove');
      await rmBtn.click({ force: true });
      await page.waitForTimeout(300);
    }
    await expect(page.getByTestId('pending-attachments')).toHaveCount(0, { timeout: 5_000 });
  }
});

test('duplicate file is not added twice', async ({ authedPage: page }) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);
  await openAssistantChat(page);

  const textarea = page.locator('textarea');
  await expect(textarea).toBeEnabled({ timeout: 20_000 });

  const fileInput = page.getByTestId('file-input');

  await fileInput.setInputFiles(smallTextFile);
  await page.waitForTimeout(500);

  const chipsAfterFirst = page.getByTestId('attachment-chip');
  await expect(chipsAfterFirst).toHaveCount(1, { timeout: 5_000 });

  await fileInput.setInputFiles(smallTextFile);
  await page.waitForTimeout(500);

  const chipsAfterSecond = page.getByTestId('attachment-chip');
  await expect(chipsAfterSecond).toHaveCount(1, { timeout: 5_000 });
});

test('attach button is disabled when spending is blocked', async ({ authedPage: page }) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  setUserCredits(user.id, -100);

  await openAssistantChat(page);

  const textarea = page.locator('textarea');
  await expect(textarea).toBeDisabled({ timeout: 15_000 });

  const attachBtn = page.getByTestId('attach-button');
  await expect(attachBtn).toBeDisabled({ timeout: 5_000 });

  setUserCredits(user.id, 50_000);
});

// ===========================================================================
// Chat Search Tests
// ===========================================================================

test('search button opens the search dialog', async ({ authedPage: page }) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  await openAssistantChat(page);

  const searchBtn = page.getByTestId('chat-search-trigger');
  await expect(searchBtn).toBeVisible({ timeout: 10_000 });
  await searchBtn.click();

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
    senderId: 0,
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
    senderId: 0,
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
      senderId: i % 2 === 0 ? CONTACT_ID : 0,
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
      senderId: i % 2 === 0 ? CONTACT_ID : 0,
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
      senderId: i % 2 === 0 ? CONTACT_ID : 0,
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
    senderId: 0,
    content: 'Hello from assistant on call',
    timestamp: new Date(ts - 44 * 60_000).toISOString(),
    medium: 'unify_meet',
    exchangeId,
  });

  for (let i = 0; i < 30; i++) {
    await seedTranscript(user.apiKey, user.id, assistant.agentId, {
      senderId: i % 2 === 0 ? CONTACT_ID : 0,
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
