/**
 * Dashboard & Embed URL E2E — embed URLs in chat render interactive preview cards.
 *
 * Run: npx playwright test src/tests/assistants/embed.e2e.ts
 */

import { expect } from '@playwright/test';
import { createTranscriptSeeder } from './chat-helpers';
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

const seedTranscript = createTranscriptSeeder({
  selfContactId: ASSISTANT_CONTACT_ID,
  bossContactId: CONTACT_ID,
});

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

const EMBED_URL_CASES = [
  { path: 'table/view', label: 'Interactive Table', prefix: 'tbl' },
  { path: 'plot/view', label: 'Interactive Chart', prefix: 'plt' },
] as const;

test('user messages with table and plot URLs render embed cards @critical @area(assistants.embed)', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  const ts = Date.now();
  for (const embedCase of EMBED_URL_CASES) {
    const token = `${embedCase.prefix}-e2e-${ts}`;
    await seedTranscript(user.apiKey, user.id, assistant.agentId, {
      senderId: CONTACT_ID,
      content: `See https://console.unify.ai/${embedCase.path}/${token}`,
    });
  }

  await openAssistantChat(page);

  for (const embedCase of EMBED_URL_CASES) {
    const token = `${embedCase.prefix}-e2e-${ts}`;
    const bubble = page.locator(`[data-role="user"]:has-text("${token}")`);
    await expect(bubble).toBeVisible({ timeout: 20_000 });
    await expect(bubble.locator(`text=${embedCase.label}`)).toBeVisible({ timeout: 5_000 });
  }
});

test('assistant markdown links render embed cards @area(assistants.embed)', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  const ts = Date.now();
  const tableToken = `tbl-asst-${ts}`;
  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: ASSISTANT_CONTACT_ID,
    content: `Here is your table: https://console.unify.ai/table/view/${tableToken}`,
  });

  await openAssistantChat(page);

  const bubble = page.locator(`[data-role="assistant"]:has-text("${tableToken}")`);
  await expect(bubble).toBeVisible({ timeout: 20_000 });
  await expect(bubble.locator('text=Interactive Table')).toBeVisible({ timeout: 5_000 });
});

test('non-embeddable URLs and plain text do not render embed cards @area(assistants.embed)', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  const ts = Date.now();
  const urlMarker = `nonembed-${ts}`;
  const textMarker = `plaintext-${ts}`;
  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: CONTACT_ID,
    content: `Visit https://example.com/${urlMarker}`,
  });
  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: CONTACT_ID,
    content: `No URLs here ${textMarker}`,
  });

  await openAssistantChat(page);

  for (const marker of [urlMarker, textMarker]) {
    const bubble = page.locator(`[data-role="user"]:has-text("${marker}")`);
    await expect(bubble).toBeVisible({ timeout: 20_000 });
    await expect(bubble.locator('text=/Interactive (Table|Chart|Canvas)/')).toHaveCount(0);
  }
});

test('expand button reveals embedded iframe and collapse hides it @critical @area(assistants.embed)', async ({
  authedPage: page,
}) => {
  await seedContact(user.apiKey, user.id, assistant.agentId, user.email);

  const ts = Date.now();
  const tableToken = `tbl-expand-${ts}`;
  await seedTranscript(user.apiKey, user.id, assistant.agentId, {
    senderId: CONTACT_ID,
    content: `Expand test: https://console.unify.ai/table/view/${tableToken}`,
  });

  await openAssistantChat(page);

  const bubble = page.locator(`[data-role="user"]:has-text("${tableToken}")`);
  await expect(bubble).toBeVisible({ timeout: 20_000 });
  await expect(bubble.locator('text=Interactive Table')).toBeVisible({ timeout: 5_000 });

  const expandBtn = bubble.locator('button[title="Expand inline"]');
  await expandBtn.scrollIntoViewIfNeeded();
  await expandBtn.click({ force: true });
  await page.waitForTimeout(1_000);

  const iframe = page.locator(`iframe[src*="/table/view/${tableToken}"]`);
  await expect(iframe).toBeVisible({ timeout: 10_000 });
  expect(await iframe.getAttribute('src')).toContain('embed=true');

  const collapseBtn = page.locator('button[title="Collapse"]').first();
  await expect(collapseBtn).toBeVisible({ timeout: 5_000 });
  await collapseBtn.click();
  await page.waitForTimeout(500);

  await expect(iframe).not.toBeVisible({ timeout: 5_000 });
  await expect(bubble.locator('button[title="Expand inline"]')).toBeVisible({ timeout: 5_000 });
});
