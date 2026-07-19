/**
 * Data pane — add column/row, edit cell, rename column, delete row.
 *
 * Run: npx playwright test src/tests/assistants/data-sheet-crud.e2e.ts
 */

import { expect, type Page } from '@playwright/test';
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
  return `data-crud-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@unify.ai`;
}

const user = createTestUser({
  email: uniqueEmail(),
  name: 'DataCrudE2E',
  lastName: 'Tester',
  credits: 50_000,
});
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(240_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'Crud',
  surname: 'Bot',
});

const contextPath = `${user.id}/${assistant.agentId}/Data/SheetCrud`;

test.beforeAll(async () => {
  const res = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: contextPath,
        entries: [{ name: 'Seed', value: 1 }],
      }),
    },
    user.apiKey
  );
  if (!res.ok) {
    throw new Error(`Failed to seed SheetCrud: ${res.status} ${await res.text()}`);
  }
});

test.afterAll(async () => {
  await cleanupUser(user.id);
});

async function ensureDataFolderBrowser(page: Page) {
  const browser = page.getByTestId('data-folder-browser');
  if (await browser.isVisible().catch(() => false)) return;
  const expand = page.getByTestId('data-sidebar-expand');
  if (await expand.isVisible().catch(() => false)) {
    await expand.click();
  }
  const back = page.getByTestId('data-mobile-back');
  if (await back.isVisible().catch(() => false)) {
    await back.click();
  }
  await expect(browser).toBeVisible({ timeout: 30_000 });
}

async function openSheetCrud(page: Page) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await selectAssistantInList(page, assistant.agentId);
  await openRailSection(page, 'data');
  await expect(page.getByTestId('data-pane')).toBeVisible({ timeout: 60_000 });
  await ensureDataFolderBrowser(page);
  await page.getByTestId('data-refresh').click();
  await ensureDataFolderBrowser(page);
  const node = page.getByTestId('data-table-node').filter({ hasText: 'SheetCrud' });
  await expect(node).toBeVisible({ timeout: 30_000 });
  await node.click();
  await expect(page.getByTestId('data-leaf-table')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('log-grid-page-status')).toContainText(/of \d+/, {
    timeout: 30_000,
  });
}

test('adds a column and a row, edits a cell, renames a column, deletes a row', async ({
  authedPage: page,
}) => {
  await openSheetCrud(page);

  await page.getByTestId('log-grid-add-column').click();
  await expect(page.getByTestId('data-add-column-dialog')).toBeVisible();
  await page.getByTestId('data-add-column-dialog-input').fill('notes');
  await page.getByTestId('data-add-column-dialog-submit').click();
  await expect(page.getByTestId('log-grid-header-notes')).toBeVisible({ timeout: 20_000 });

  await page.getByTestId('log-grid-add-row').click();
  await expect(page.getByTestId('log-grid-page-status')).toContainText(/of 2/, {
    timeout: 20_000,
  });

  const firstRow = page.locator('tr[data-testid^="log-grid-row-"]').first();
  const nameCell = firstRow.locator('[data-testid^="log-grid-cell-"]').first();
  await nameCell.dblclick();
  const textarea = page.getByTestId('log-grid-inline-editor').locator('textarea');
  await expect(textarea).toBeVisible({ timeout: 10_000 });
  await textarea.fill('Seeded');
  await textarea.press('Enter');
  await expect(
    page.getByTestId('data-leaf-table').getByText('Seeded', { exact: true })
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('log-grid-fetching')).toHaveCount(0, { timeout: 15_000 });

  await page.getByTestId('log-grid-column-menu-notes').click();
  const renameItem = page.getByRole('menuitem', { name: 'Rename column' });
  await expect(renameItem).toBeVisible({ timeout: 5_000 });
  await renameItem.click();
  await expect(page.getByTestId('data-rename-column-dialog')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('data-rename-column-dialog-input').fill('memo');
  await page.getByTestId('data-rename-column-dialog-submit').click();
  await expect(page.getByTestId('log-grid-header-memo')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('log-grid-fetching')).toHaveCount(0, { timeout: 15_000 });

  // Re-query after rename refresh; delete requires an active selection.
  const seededRow = page
    .locator('tr[data-testid^="log-grid-row-"]')
    .filter({ hasText: 'Seeded' })
    .first();
  await expect(seededRow).toBeVisible({ timeout: 10_000 });
  await seededRow.locator('[data-testid^="log-grid-row-index-"]').click();
  await expect(page.getByTestId('log-grid-more')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('log-grid-more').click();
  await page.getByTestId('log-grid-delete-row').click();
  await page.getByTestId('log-grid-delete-confirm').click();
  await expect(page.getByTestId('log-grid-page-status')).toContainText(/of 1/, {
    timeout: 20_000,
  });

  const listRes = await orchestraFetch(
    `/v0/logs?project_name=Assistants&context=${encodeURIComponent(contextPath)}&limit=10`,
    { method: 'GET' },
    user.apiKey
  );
  expect(listRes.ok).toBe(true);
  const body = (await listRes.json()) as { count?: number; logs?: unknown[] };
  expect(body.count ?? body.logs?.length ?? 0).toBe(1);
});
