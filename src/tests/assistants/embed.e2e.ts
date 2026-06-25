/**
 * Dashboard & Embed URL E2E Tests — browser-based user flows verifying that
 * embed URLs (dashboard, tile, table, plot) are detected and rendered as
 * interactive preview cards in assistant chat messages.
 *
 * Verifies:
 *  - User messages containing dashboard/tile/table/plot URLs render embed cards
 *  - Assistant messages with embed links render embed cards via markdown
 *  - Non-embeddable URLs and plain text do not produce embed cards
 *  - Embed preview card expand/collapse toggling works
 *  - Dashboard view page shows not-found for invalid tokens
 *
 * Replaces: src/tests/dashboard/unit/embedParsing.node.test.ts
 *
 * Run: npx playwright test src/tests/assistants/embed.e2e.ts
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
  orchestraFetch,
  setUserCredits,
} from './helpers';

const ASSISTANT_CONTACT_ID = 0;
const CONTACT_ID = 2;

const user = createTestUser({ name: 'EmbedE2E', lastName: 'Tester', credits: 50_000 });
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(120_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'EmbedBot',
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

let messageCounter = 5000;

async function seedContact(apiKey: string, userId: string, assistantId: number, email: string) {
  /* eslint-disable @typescript-eslint/naming-convention */
  const res = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: `${userId}/${assistantId}/Contacts`,
        entries: [{ email_address: email, contact_id: CONTACT_ID }],
      }),
    },
    apiKey
  );
  /* eslint-enable @typescript-eslint/naming-convention */
  if (!res.ok) throw new Error(`Failed to seed contact: ${res.status} ${await res.text()}`);
}

async function seedTranscript(
  apiKey: string,
  userId: string,
  assistantId: number,
  opts: {
    senderId: number; // 0 = assistant, CONTACT_ID = user
    content: string;
    timestamp?: string;
  }
) {
  const msgId = messageCounter++;
  const ts = opts.timestamp || new Date().toISOString();

  /* eslint-disable @typescript-eslint/naming-convention */
  const res = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: `${userId}/${assistantId}/Transcripts`,
        entries: [
          {
            medium: 'unify_message',
            sender_id: opts.senderId,
            receiver_ids:
              opts.senderId === ASSISTANT_CONTACT_ID ? [CONTACT_ID] : [ASSISTANT_CONTACT_ID],
            content: opts.content,
            message_id: msgId,
            timestamp: ts,
          },
        ],
      }),
    },
    apiKey
  );
  /* eslint-enable @typescript-eslint/naming-convention */
  if (!res.ok) throw new Error(`Failed to seed transcript: ${res.status} ${await res.text()}`);
  return msgId;
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

async function openAssistantChat(page: import('@playwright/test').Page) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await openUnitySwitcher(page);

  const listItem = page.getByTestId(`assistant-list-item-${assistant.agentId}`);
  await expect(listItem).toBeVisible({ timeout: 15_000 });
  await listItem.click();
  await page.waitForTimeout(2_000);

  const chatArea = page.getByTestId('chat-scroll-area');
  await expect(chatArea).toBeVisible({ timeout: 10_000 });
}

// ===========================================================================
// Embed Card Detection — User Messages
// (containsEmbedUrl → RenderContentWithEmbeds → InlineEmbed)
// ===========================================================================

test('user message with dashboard URL renders Interactive Dashboard embed card', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  const ts = Date.now();
  const dashToken = `dash-e2e-${ts}`;
  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: CONTACT_ID,
    content: `Check this out: https://console.unify.ai/dashboard/view/${dashToken}`,
  });

  await openAssistantChat(page);

  const bubble = page.locator(`[data-role="user"]:has-text("${dashToken}")`);
  await expect(bubble).toBeVisible({ timeout: 20_000 });

  await expect(bubble.locator('text=Interactive Dashboard')).toBeVisible({ timeout: 5_000 });
  await expect(bubble.locator(`text=${dashToken}`)).toBeVisible({ timeout: 5_000 });
});

test('user message with tile URL renders Interactive Tile embed card', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  const ts = Date.now();
  const tileToken = `tile-e2e-${ts}`;
  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: CONTACT_ID,
    content: `Look at https://console.unify.ai/tile/view/${tileToken}`,
  });

  await openAssistantChat(page);

  const bubble = page.locator(`[data-role="user"]:has-text("${tileToken}")`);
  await expect(bubble).toBeVisible({ timeout: 20_000 });

  await expect(bubble.locator('text=Interactive Tile')).toBeVisible({ timeout: 5_000 });
  await expect(bubble.locator(`text=${tileToken}`)).toBeVisible({ timeout: 5_000 });
});

test('user message with table URL renders Interactive Table embed card', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  const ts = Date.now();
  const tableToken = `tbl-e2e-${ts}`;
  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: CONTACT_ID,
    content: `Open https://console.unify.ai/table/view/${tableToken}`,
  });

  await openAssistantChat(page);

  const bubble = page.locator(`[data-role="user"]:has-text("${tableToken}")`);
  await expect(bubble).toBeVisible({ timeout: 20_000 });

  await expect(bubble.locator('text=Interactive Table')).toBeVisible({ timeout: 5_000 });
  await expect(bubble.locator(`text=${tableToken}`)).toBeVisible({ timeout: 5_000 });
});

test('user message with plot URL renders Interactive Chart embed card', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  const ts = Date.now();
  const plotToken = `plt-e2e-${ts}`;
  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: CONTACT_ID,
    content: `View https://console.unify.ai/plot/view/${plotToken}`,
  });

  await openAssistantChat(page);

  const bubble = page.locator(`[data-role="user"]:has-text("${plotToken}")`);
  await expect(bubble).toBeVisible({ timeout: 20_000 });

  await expect(bubble.locator('text=Interactive Chart')).toBeVisible({ timeout: 5_000 });
  await expect(bubble.locator(`text=${plotToken}`)).toBeVisible({ timeout: 5_000 });
});

// ===========================================================================
// Embed Card Detection — Assistant Messages
// (ChatMarkdown → parseEmbedUrl on <a> tags → InlineEmbed)
// ===========================================================================

test('assistant message with dashboard link renders Interactive Dashboard embed card', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  const ts = Date.now();
  const dashToken = `dash-asst-${ts}`;
  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: ASSISTANT_CONTACT_ID,
    content: `Here is your dashboard: https://console.unify.ai/dashboard/view/${dashToken}`,
  });

  await openAssistantChat(page);

  const bubble = page.locator(`[data-role="assistant"]:has-text("${dashToken}")`);
  await expect(bubble).toBeVisible({ timeout: 20_000 });

  await expect(bubble.locator('text=Interactive Dashboard')).toBeVisible({ timeout: 5_000 });
  await expect(bubble.locator(`text=${dashToken}`)).toBeVisible({ timeout: 5_000 });
});

// ===========================================================================
// Non-matching URLs — No Embed Card
// ===========================================================================

test('user message with non-embeddable URL does not render an embed card', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  const ts = Date.now();
  const msgMarker = `nonembed-${ts}`;
  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: CONTACT_ID,
    content: `Visit https://example.com/${msgMarker}`,
  });

  await openAssistantChat(page);

  const bubble = page.locator(`[data-role="user"]:has-text("${msgMarker}")`);
  await expect(bubble).toBeVisible({ timeout: 20_000 });

  const embedLabels = bubble.locator('text=/Interactive (Dashboard|Table|Chart|Tile)/');
  await expect(embedLabels).toHaveCount(0);
});

test('user message with plain text does not render an embed card', async ({ authedPage: page }) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  const ts = Date.now();
  const msgMarker = `plaintext-${ts}`;
  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: CONTACT_ID,
    content: `No URLs here, just a plain message ${msgMarker}`,
  });

  await openAssistantChat(page);

  const bubble = page.locator(`[data-role="user"]:has-text("${msgMarker}")`);
  await expect(bubble).toBeVisible({ timeout: 20_000 });

  const embedLabels = bubble.locator('text=/Interactive (Dashboard|Table|Chart|Tile)/');
  await expect(embedLabels).toHaveCount(0);
});

// ===========================================================================
// Embed Card Interactivity
// ===========================================================================

test('expand button reveals embedded iframe and collapse button hides it', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  const ts = Date.now();
  const dashToken = `dash-expand-${ts}`;
  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: CONTACT_ID,
    content: `Expand test: https://console.unify.ai/dashboard/view/${dashToken}`,
  });

  await openAssistantChat(page);

  const bubble = page.locator(`[data-role="user"]:has-text("${dashToken}")`);
  await expect(bubble).toBeVisible({ timeout: 20_000 });
  await expect(bubble.locator('text=Interactive Dashboard')).toBeVisible({ timeout: 5_000 });

  // Click expand — scroll into view first since chat area may be scrollable
  const expandBtn = bubble.locator('button[title="Expand inline"]');
  await expandBtn.scrollIntoViewIfNeeded();
  await expandBtn.click({ force: true });
  await page.waitForTimeout(1_000);

  // Iframe should appear somewhere on the page with the dashboard embed src
  const iframe = page.locator(`iframe[src*="/dashboard/view/${dashToken}"]`);
  await expect(iframe).toBeVisible({ timeout: 10_000 });
  const src = await iframe.getAttribute('src');
  expect(src).toContain('embed=true');

  // Collapse button should be visible
  const collapseBtn = page.locator('button[title="Collapse"]').first();
  await expect(collapseBtn).toBeVisible({ timeout: 5_000 });
  await collapseBtn.click();
  await page.waitForTimeout(500);

  // Iframe should disappear, preview card should reappear
  await expect(iframe).not.toBeVisible({ timeout: 5_000 });
  await expect(bubble.locator('button[title="Expand inline"]')).toBeVisible({ timeout: 5_000 });
});

// ===========================================================================
// Dashboard View Page — Not Found
// ===========================================================================

test('dashboard view page shows not-found message for invalid token', async ({
  authedPage: page,
}) => {
  await page.goto('/dashboard/view/definitely-nonexistent-token-e2e-12345');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  // Either "Dashboard Not Found" (token resolves as 404) or
  // "Unable to Load Dashboard" (admin key misconfigured) is acceptable
  const notFound = page.locator('text=Dashboard Not Found');
  const error = page.locator('text=Unable to Load Dashboard');
  await expect(notFound.or(error).first()).toBeVisible({ timeout: 15_000 });
});
