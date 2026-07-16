/**
 * Data browser modes — Data segment + per–state-manager segments; Meta hidden.
 *
 * Run: npx playwright test src/tests/assistants/data-browser-modes.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAssistantTest,
  createAssistant,
  navigateToAssistants,
  closeHireDialogIfOpen,
  selectAssistantInList,
  ensureProjectSync,
  orchestraFetch,
  openRailSection,
  seedChatInfrastructure,
} from './helpers';

function uniqueEmail(): string {
  return `data-modes-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@unify.ai`;
}

const user = createTestUser({
  email: uniqueEmail(),
  name: 'DataModesE2E',
  lastName: 'Tester',
  credits: 50_000,
});
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(180_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'Modes',
  surname: 'Bot',
});

const peopleContext = `${user.id}/${assistant.agentId}/Data/Demo/People`;
const contactsContext = `${user.id}/${assistant.agentId}/Contacts`;

test.beforeAll(async () => {
  await seedChatInfrastructure({
    apiKey: user.apiKey,
    userId: user.id,
    assistantId: assistant.agentId,
    email: user.email,
  });

  // Runtime always creates */Meta bookkeeping contexts; the Data browser must hide them.
  const metaRes = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: `${contactsContext}/Meta`,
        entries: [{ custom_contacts_hash: 'e2e-placeholder' }],
      }),
    },
    user.apiKey
  );
  if (!metaRes.ok) {
    throw new Error(`Failed to seed Contacts/Meta: ${metaRes.status} ${await metaRes.text()}`);
  }

  const res = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: peopleContext,
        entries: [
          { name: 'Ada Lovelace', city: 'London', score: 95 },
          { name: 'Alan Turing', city: 'Manchester', score: 88 },
        ],
      }),
    },
    user.apiKey
  );
  if (!res.ok) {
    throw new Error(`Failed to seed People table: ${res.status} ${await res.text()}`);
  }
});

test.afterAll(async () => {
  await cleanupUser(user.id);
});

async function openDataPane(page: import('@playwright/test').Page) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await selectAssistantInList(page, assistant.agentId);
  await openRailSection(page, 'data');
  await expect(page.getByTestId('data-pane')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('data-browser-mode')).toBeVisible({ timeout: 30_000 });
}

test('Data is default; Contacts segment opens the table and hides Meta', async ({
  authedPage: page,
}) => {
  await openDataPane(page);

  await expect(page.getByTestId('data-pane')).toHaveAttribute('data-mode', 'data');
  await expect(page.getByTestId('data-mode-data')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('data-state-banner')).toHaveCount(0);
  await expect(page.getByTestId('data-tree')).toBeVisible();

  const peopleNode = page.getByTestId('data-table-node').filter({ hasText: 'People' });
  if (!(await peopleNode.isVisible({ timeout: 3_000 }).catch(() => false))) {
    const demoFolder = page.getByTestId('data-folder-node').filter({ hasText: /^Demo$/ });
    await expect(demoFolder).toBeVisible({ timeout: 15_000 });
    await demoFolder.click();
  }
  await expect(peopleNode).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('data-table-node').filter({ hasText: 'Contacts' })).toHaveCount(0);

  await peopleNode.click();
  await expect(page.getByTestId('data-leaf-table')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('log-grid-page-status')).toContainText(/of 2/, {
    timeout: 30_000,
  });

  await page.getByTestId('data-mode-Contacts').click();
  await expect(page.getByTestId('data-pane')).toHaveAttribute('data-mode', 'Contacts');
  await expect(page.getByTestId('data-state-banner')).toBeVisible();
  // Single-table manager: no directory list of Meta; table opens directly
  await expect(page.getByTestId('data-table-node').filter({ hasText: /^Meta$/ })).toHaveCount(0);
  await expect(page.getByTestId('data-leaf-table')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('log-grid-page-status')).toContainText(/of [1-9]/, {
    timeout: 30_000,
  });
  await expect(page.getByRole('heading', { name: 'Contacts' })).toBeVisible();

  const listRes = await orchestraFetch(
    `/v0/logs?project_name=Assistants&context=${encodeURIComponent(contactsContext)}&limit=5`,
    { method: 'GET' },
    user.apiKey
  );
  expect(listRes.ok).toBe(true);
  const body = (await listRes.json()) as { count?: number; logs?: unknown[] };
  expect((body.count ?? body.logs?.length ?? 0) > 0).toBe(true);

  await page.getByTestId('data-mode-data').click();
  await expect(page.getByTestId('data-pane')).toHaveAttribute('data-mode', 'data');
  await expect(page.getByTestId('data-state-banner')).toHaveCount(0);
});
