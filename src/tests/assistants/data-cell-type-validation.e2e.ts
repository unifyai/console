/**
 * Data pane — invalid typed cell edits show dtype feedback and leave prior values.
 *
 * Run: npx playwright test src/tests/assistants/data-cell-type-validation.e2e.ts
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
  return `data-type-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@unify.ai`;
}

const user = createTestUser({
  email: uniqueEmail(),
  name: 'DataTypeE2E',
  lastName: 'Tester',
  credits: 50_000,
});
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(180_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'Type',
  surname: 'Bot',
});

const contextPath = `${user.id}/${assistant.agentId}/Data/TypeValidation`;

test.beforeAll(async () => {
  const fieldsRes = await orchestraFetch(
    '/v0/logs/fields',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: contextPath,
        fields: {
          label: { type: 'str', mutable: true, ui_editable: true },
          meta: { type: 'dict', mutable: true, ui_editable: true },
          count: { type: 'int', mutable: true, ui_editable: true },
        },
      }),
    },
    user.apiKey
  );
  if (!fieldsRes.ok) {
    throw new Error(
      `Failed to create TypeValidation fields: ${fieldsRes.status} ${await fieldsRes.text()}`
    );
  }

  const seedRes = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: contextPath,
        entries: [{ label: 'Seed', meta: { foo: 'bar' }, count: 7 }],
      }),
    },
    user.apiKey
  );
  if (!seedRes.ok) {
    throw new Error(`Failed to seed TypeValidation: ${seedRes.status} ${await seedRes.text()}`);
  }
});

test.afterAll(async () => {
  await cleanupUser(user.id);
});

async function ensureDataTree(page: Page) {
  const tree = page.getByTestId('data-tree');
  if (await tree.isVisible().catch(() => false)) return;
  const expand = page.getByTestId('data-sidebar-expand');
  if (await expand.isVisible().catch(() => false)) {
    await expand.click();
  }
  const back = page.getByTestId('data-mobile-back');
  if (await back.isVisible().catch(() => false)) {
    await back.click();
  }
  await expect(tree).toBeVisible({ timeout: 30_000 });
}

async function openTypeValidation(page: Page) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await selectAssistantInList(page, assistant.agentId);
  await openRailSection(page, 'data');
  await expect(page.getByTestId('data-pane')).toBeVisible({ timeout: 60_000 });
  await ensureDataTree(page);
  await page.getByTestId('data-refresh').click();
  await ensureDataTree(page);
  const node = page.getByTestId('data-table-node').filter({ hasText: 'TypeValidation' });
  await expect(node).toBeVisible({ timeout: 30_000 });
  await node.click();
  await expect(page.getByTestId('data-leaf-table')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('log-grid-page-status')).toContainText(/of \d+/, {
    timeout: 30_000,
  });
}

async function fetchSeedRow(): Promise<Record<string, unknown>> {
  const listRes = await orchestraFetch(
    `/v0/logs?project_name=Assistants&context=${encodeURIComponent(contextPath)}&limit=10`,
    { method: 'GET' },
    user.apiKey
  );
  expect(listRes.ok).toBe(true);
  const body = (await listRes.json()) as {
    logs?: Array<{ entries?: Record<string, unknown> }>;
  };
  const entries = body.logs?.[0]?.entries;
  if (!entries) throw new Error('Expected seeded TypeValidation row');
  return entries;
}

test('rejects invalid dict and int cell edits with dtype feedback', async ({
  authedPage: page,
}) => {
  await openTypeValidation(page);

  const row = page.locator('tr[data-testid^="log-grid-row-"]').first();
  const metaCell = row.locator('[data-testid^="log-grid-cell-"][data-testid$="_meta"]');
  await expect(metaCell).toBeVisible({ timeout: 10_000 });
  await metaCell.dblclick();

  const editor = page.getByTestId('log-grid-inline-editor').locator('textarea');
  await expect(editor).toBeVisible({ timeout: 10_000 });
  await editor.fill('not-a-dict');
  await editor.press('Enter');

  const errorToast = page.locator('[data-sonner-toast][data-type="error"]').first();
  await expect(errorToast).toBeVisible({ timeout: 5_000 });
  await expect(errorToast).toContainText(/Invalid value\. Please enter data in dict format/i);
  await expect(page.getByTestId('log-grid-inline-editor')).toBeVisible({ timeout: 5_000 });

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('log-grid-inline-editor')).toHaveCount(0, { timeout: 5_000 });

  const afterDict = await fetchSeedRow();
  expect(afterDict.meta).toEqual({ foo: 'bar' });
  expect(afterDict.count).toBe(7);

  const countCell = row.locator('[data-testid^="log-grid-cell-"][data-testid$="_count"]');
  await countCell.dblclick();
  await expect(editor).toBeVisible({ timeout: 10_000 });
  await editor.fill('not-an-int');
  await editor.press('Enter');

  await expect(errorToast).toBeVisible({ timeout: 5_000 });
  await expect(errorToast).toContainText(/Invalid value\. Please enter data in int format/i);
  await expect(page.getByTestId('log-grid-inline-editor')).toBeVisible({ timeout: 5_000 });

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('log-grid-inline-editor')).toHaveCount(0, { timeout: 5_000 });

  const afterInt = await fetchSeedRow();
  expect(afterInt.meta).toEqual({ foo: 'bar' });
  expect(afterInt.count).toBe(7);
});
