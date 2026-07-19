/**
 * Data pane — rename and delete tables from the expandable tree … menu.
 *
 * Run: npx playwright test src/tests/assistants/data-table-rename-delete.e2e.ts
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
  return `data-table-crud-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@unify.ai`;
}

const user = createTestUser({
  email: uniqueEmail(),
  name: 'DataTableCrudE2E',
  lastName: 'Tester',
  credits: 50_000,
});
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(180_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'TableCrud',
  surname: 'Bot',
});

const originalName = `RenameMe_${Date.now()}`;
const renamedName = `Renamed_${Date.now()}`;
const deleteName = `DeleteMe_${Date.now()}`;
const originalContext = `${user.id}/${assistant.agentId}/Data/${originalName}`;
const renamedContext = `${user.id}/${assistant.agentId}/Data/${renamedName}`;
const deleteContext = `${user.id}/${assistant.agentId}/Data/${deleteName}`;

test.beforeAll(async () => {
  for (const context of [originalContext, deleteContext]) {
    const res = await orchestraFetch(
      '/v0/logs',
      {
        method: 'POST',
        body: JSON.stringify({
          project_name: 'Assistants',
          context,
          entries: [{ marker: 'seed' }],
        }),
      },
      user.apiKey
    );
    if (!res.ok) {
      throw new Error(`Failed to seed ${context}: ${res.status} ${await res.text()}`);
    }
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
  await expect(page.getByTestId('data-tree')).toBeVisible({ timeout: 30_000 });
}

async function openTableMenu(page: import('@playwright/test').Page, tableName: string) {
  const node = page.getByTestId('data-table-node').filter({ hasText: tableName });
  await expect(node).toBeVisible({ timeout: 15_000 });
  const row = node.locator('xpath=ancestor::div[contains(@class,"group")][1]');
  await row.hover();
  const menu = row.getByTestId('data-table-menu');
  await expect(menu).toBeVisible({ timeout: 5_000 });
  await menu.click();
}

async function listContexts(): Promise<string[]> {
  const listRes = await orchestraFetch(
    `/v0/project/Assistants/contexts`,
    { method: 'GET' },
    user.apiKey
  );
  expect(listRes.ok).toBe(true);
  const contexts = (await listRes.json()) as Array<string | { name?: string }>;
  return contexts.map((c) => (typeof c === 'string' ? c : c.name)).filter(Boolean) as string[];
}

test('renames a table in place from the tree … menu', async ({ authedPage: page }) => {
  await openDataTree(page);
  await page.getByTestId('data-refresh').click();

  await openTableMenu(page, originalName);
  await page.getByTestId('data-table-menu-rename').click();
  const input = page.getByTestId('data-table-rename-input');
  await expect(input).toBeVisible();
  await input.fill(renamedName);
  await input.press('Enter');

  await expect(page.getByTestId('data-table-node').filter({ hasText: renamedName })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByTestId('data-table-node').filter({ hasText: originalName })).toHaveCount(
    0
  );

  const names = await listContexts();
  expect(names).toContain(renamedContext);
  expect(names).not.toContain(originalContext);
});

test('deletes a table after confirmation from the tree … menu', async ({ authedPage: page }) => {
  await openDataTree(page);
  await page.getByTestId('data-refresh').click();

  await openTableMenu(page, deleteName);
  await page.getByTestId('data-table-menu-delete').click();
  await expect(page.getByTestId('data-delete-table-dialog')).toBeVisible();
  await page.getByTestId('data-delete-table-confirm').click();

  await expect(page.getByTestId('data-table-node').filter({ hasText: deleteName })).toHaveCount(0, {
    timeout: 15_000,
  });

  const names = await listContexts();
  expect(names).not.toContain(deleteContext);
});
