/**
 * Data pane — upload a CSV to create a new table under the current Data folder.
 *
 * Run: npx playwright test src/tests/assistants/data-import-file.e2e.ts
 */

import { expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';
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
  return `data-import-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@unify.ai`;
}

const user = createTestUser({
  email: uniqueEmail(),
  name: 'DataImportE2E',
  lastName: 'Tester',
  credits: 50_000,
});
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(180_000);

const assistant = createAssistant({
  userId: user.id,
  firstName: 'Import',
  surname: 'Bot',
});

const tableName = `Imported_${Date.now()}`;
const expectedContext = `${user.id}/${assistant.agentId}/Data/${tableName}`;

test.afterAll(async () => {
  await cleanupUser(user.id);
});

test('uploads a CSV to create a table with rows', async ({ authedPage: page }) => {
  const csvPath = path.join(os.tmpdir(), `${tableName}.csv`);
  fs.writeFileSync(csvPath, 'name,score\nAda,95\nGrace,91\n');

  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await selectAssistantInList(page, assistant.agentId);
  await openRailSection(page, 'data');
  await expect(page.getByTestId('data-pane')).toBeVisible({ timeout: 30_000 });

  await page.getByTestId('data-upload').click();
  await expect(page.getByTestId('data-import-dialog')).toBeVisible();
  await page.getByTestId('data-import-input').setInputFiles(csvPath);
  await expect(page.getByTestId('data-import-summary')).toContainText('2 rows', {
    timeout: 15_000,
  });
  await page.getByTestId('data-import-table-name').fill(tableName);
  await page.getByTestId('data-import-submit').click();

  await expect(page.getByTestId('data-leaf-table')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('log-grid-page-status')).toContainText(/of 2/, {
    timeout: 30_000,
  });
  await expect(page.getByTestId('data-leaf-table').getByText('Ada', { exact: true })).toBeVisible({
    timeout: 15_000,
  });

  const listRes = await orchestraFetch(
    `/v0/logs?project_name=Assistants&context=${encodeURIComponent(expectedContext)}&limit=10`,
    { method: 'GET' },
    user.apiKey
  );
  expect(listRes.ok).toBe(true);
  const body = (await listRes.json()) as { count?: number; logs?: unknown[] };
  expect(body.count ?? body.logs?.length ?? 0).toBe(2);

  fs.unlinkSync(csvPath);
});
