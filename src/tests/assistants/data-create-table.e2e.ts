/**
 * Data pane — create a new empty table via the expandable tree folder + menu.
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

const nestFolder = `Nest_${Date.now()}`;
const nestSeedContext = `${user.id}/${assistant.agentId}/Data/${nestFolder}/Seed`;
const nestTableName = `NestedTable_${Date.now()}`;
const nestExpectedContext = `${user.id}/${assistant.agentId}/Data/${nestFolder}/${nestTableName}`;

const newFolderName = `NewFolder_${Date.now()}`;
const nestedNewFolderTable = `InNewFolder_${Date.now()}`;
const newFolderExpectedContext = `${user.id}/${assistant.agentId}/Data/${newFolderName}/${nestedNewFolderTable}`;

test.beforeAll(async () => {
  const res = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: nestSeedContext,
        entries: [{ marker: 'seed' }],
      }),
    },
    user.apiKey
  );
  if (!res.ok) {
    throw new Error(`Failed to seed nest folder: ${res.status} ${await res.text()}`);
  }
});

test.afterAll(async () => {
  await cleanupUser(user.id);
});

async function openDataTree(page: import('@playwright/test').Page) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await selectAssistantInList(page, assistant.agentId);
  await openRailSection(page, 'data');
  await expect(page.getByTestId('data-pane')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('data-folder-browser')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('data-tree')).toBeVisible({ timeout: 30_000 });
}

test('creates a new empty table under Data root and opens it', async ({ authedPage: page }) => {
  await openDataTree(page);

  await page.getByTestId('data-tree-root-chrome').getByTestId('data-folder-add').click();
  await page.getByTestId('data-folder-add-new-table').click();
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

test('creates a table inside an existing folder via that folder + menu', async ({
  authedPage: page,
}) => {
  await openDataTree(page);
  await page.getByTestId('data-refresh').click();

  const folderAdd = page.locator(
    `[data-testid="data-folder-add"][data-folder-path="${nestFolder}"]`
  );
  await expect(folderAdd).toBeVisible({ timeout: 15_000 });
  await folderAdd.click();
  await page.getByTestId('data-folder-add-new-table').click();
  await expect(page.getByTestId('data-create-table-dialog')).toBeVisible();
  await expect(page.getByTestId('data-create-table-location')).toContainText(nestFolder);
  await page.getByTestId('data-create-table-name').fill(nestTableName);
  await page.getByTestId('data-create-table-submit').click();

  await expect(page.getByTestId('data-leaf-table')).toBeVisible({ timeout: 30_000 });

  const listRes = await orchestraFetch(
    `/v0/project/Assistants/contexts`,
    { method: 'GET' },
    user.apiKey
  );
  expect(listRes.ok).toBe(true);
  const contexts = (await listRes.json()) as Array<string | { name?: string }>;
  const names = contexts.map((c) => (typeof c === 'string' ? c : c.name)).filter(Boolean);
  expect(names).toContain(nestExpectedContext);
});

test('creates a table under a new folder path from Data root', async ({ authedPage: page }) => {
  await openDataTree(page);

  await page.getByTestId('data-tree-root-chrome').getByTestId('data-folder-add').click();
  await page.getByTestId('data-folder-add-new-table').click();
  await expect(page.getByTestId('data-create-table-dialog')).toBeVisible();
  await page.getByTestId('data-create-table-name').fill(`${newFolderName}/${nestedNewFolderTable}`);
  await page.getByTestId('data-create-table-submit').click();

  await expect(page.getByTestId('data-leaf-table')).toBeVisible({ timeout: 30_000 });

  const listRes = await orchestraFetch(
    `/v0/project/Assistants/contexts`,
    { method: 'GET' },
    user.apiKey
  );
  expect(listRes.ok).toBe(true);
  const contexts = (await listRes.json()) as Array<string | { name?: string }>;
  const names = contexts.map((c) => (typeof c === 'string' ? c : c.name)).filter(Boolean);
  expect(names).toContain(newFolderExpectedContext);
});
