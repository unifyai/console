/**
 * Data pane — create a new empty table under the current Data folder.
 *
 * Run: npx playwright test src/tests/assistants/data-create-table.e2e.ts
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
} from './helpers';

function uniqueEmail(): string {
  return `data-create-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@unify.ai`;
}

const user = createTestUser({
  email: uniqueEmail(),
  name: 'DataCreateE2E',
  lastName: 'Tester',
  credits: 50_000,
});
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(180_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'Create',
  surname: 'Bot',
});

const tableName = `CreatedTable_${Date.now()}`;
const expectedContext = `${user.id}/${assistant.agentId}/Data/${tableName}`;

test.afterAll(async () => {
  await cleanupUser(user.id);
});

test('creates a new empty table under Data root and opens it', async ({ authedPage: page }) => {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await selectAssistantInList(page, assistant.agentId);
  await openRailSection(page, 'data');
  await expect(page.getByTestId('data-pane')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('data-folder-browser')).toBeVisible({ timeout: 30_000 });

  await page.getByTestId('data-new-table').click();
  await expect(page.getByTestId('data-create-table-dialog')).toBeVisible();
  await expect(page.getByTestId('data-create-table-location')).toContainText('Data');
  await page.getByTestId('data-create-table-name').fill(tableName);
  await page.getByTestId('data-create-table-submit').click();

  await expect(page.getByTestId('data-leaf-table')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('log-grid-empty')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(tableName, { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  const listRes = await orchestraFetch(
    `/v0/project/Assistants/contexts`,
    { method: 'GET' },
    user.apiKey
  );
  expect(listRes.ok).toBe(true);
  const contexts = (await listRes.json()) as Array<string | { name?: string }>;
  const names = contexts.map((c) => (typeof c === 'string' ? c : c.name)).filter(Boolean);
  expect(names).toContain(expectedContext);
});
