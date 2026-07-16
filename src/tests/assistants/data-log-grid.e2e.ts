/**
 * Data LogGrid E2E — column visibility, server filters/sort, derived columns,
 * cell view panel, metrics chrome, and row mutations on the Assistants Data tab.
 *
 * Run: npx playwright test src/tests/assistants/data-log-grid.e2e.ts
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
  return `data-grid-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@unify.ai`;
}

const user = createTestUser({
  email: uniqueEmail(),
  name: 'DataGridE2E',
  lastName: 'Tester',
  credits: 50_000,
});
ensureProjectSync(user.apiKey);
const test = createAssistantTest(user);
test.setTimeout(180_000);
test.describe.configure({ mode: 'serial' });

const assistant = createAssistant({
  userId: user.id,
  firstName: 'Grid',
  surname: 'Bot',
});

const PEOPLE = [
  { name: 'Ada Lovelace', city: 'London', score: 95 },
  { name: 'Alan Turing', city: 'Manchester', score: 88 },
  { name: 'Grace Hopper', city: 'New York', score: 91 },
  { name: 'Katherine Johnson', city: 'Hampton', score: 97 },
  { name: 'Donald Knuth', city: 'Stanford', score: 84 },
];

const contextPath = `${user.id}/${assistant.agentId}/Data/Demo/People`;

test.beforeAll(async () => {
  const res = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: contextPath,
        entries: PEOPLE,
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

/** Click a toolbar control; open More first when it lives in the overflow menu. */
async function clickToolbarControl(page: Page, testId: string) {
  const control = page.getByTestId(testId);
  if (await control.isVisible().catch(() => false)) {
    await control.click();
    return;
  }
  await page.getByTestId('log-grid-more').click();
  await expect(page.getByTestId(testId)).toBeVisible({ timeout: 5_000 });
  await page.getByTestId(testId).click();
}

async function openPeopleTable(page: Page) {
  await navigateToAssistants(page);
  await closeHireDialogIfOpen(page);
  await selectAssistantInList(page, assistant.agentId);
  await openRailSection(page, 'data');
  await expect(page.getByTestId('data-pane')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('data-tree')).toBeVisible({ timeout: 30_000 });

  const peopleNode = page.getByTestId('data-table-node').filter({ hasText: 'People' });
  if (!(await peopleNode.isVisible({ timeout: 3_000 }).catch(() => false))) {
    const demoFolder = page.getByTestId('data-folder-node').filter({ hasText: /^Demo$/ });
    await expect(demoFolder).toBeVisible({ timeout: 15_000 });
    await demoFolder.click();
  }
  await expect(peopleNode).toBeVisible({ timeout: 15_000 });
  await peopleNode.click();
  await expect(page.getByTestId('data-leaf-table')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('log-grid-page-status')).toContainText(/of \d+/, {
    timeout: 30_000,
  });
}

test('hides a column, filters, sorts, creates a derived column, and opens row detail via cell panel', async ({
  authedPage: page,
}) => {
  await openPeopleTable(page);

  // Selection panel is absent until a cell is selected
  await expect(page.getByTestId('log-cell-view-panel')).toHaveCount(0);
  await expect(page.getByTestId('log-cell-view-panel-empty')).toHaveCount(0);
  await expect(page.getByTestId('log-grid-more')).toBeVisible();

  // Column visibility: hide city
  await page.getByTestId('log-grid-columns').click();
  await page.getByTestId('log-grid-column-toggle-city').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('log-grid-sort-city')).toHaveCount(0);
  await expect(page.getByTestId('log-grid-sort-name')).toBeVisible();

  // Server filter: name contains Ada (Enter applies without fighting popover remounts)
  await page.getByTestId('log-grid-filter-name').click();
  const filterValue = page.getByTestId('log-grid-filter-value');
  await expect(filterValue).toBeVisible();
  await filterValue.fill('Ada');
  await filterValue.press('Enter');
  await expect(page.getByTestId('log-grid-page-status')).toContainText(/of 1/, {
    timeout: 30_000,
  });
  await expect(page.getByText('Ada Lovelace')).toBeVisible();
  await expect(page.getByText('Alan Turing')).toHaveCount(0);

  // Clear column filter
  await page.getByTestId('log-grid-filter-name').click();
  await page.getByTestId('log-grid-filter-clear').click({ force: true });
  await expect(page.getByTestId('log-grid-page-status')).toContainText(/of 5/, {
    timeout: 30_000,
  });

  // Server sort by score descending
  await page.getByTestId('log-grid-sort-score').click(); // asc
  await page.getByTestId('log-grid-sort-score').click(); // desc
  const firstRow = page.locator('[data-testid^="log-grid-row-"]').first();
  await expect(firstRow).toContainText('97', { timeout: 30_000 });
  await expect(firstRow).toContainText('Katherine');

  // Derived column — always in More menu
  await clickToolbarControl(page, 'log-grid-derived-open');
  await page.getByTestId('log-grid-derived-name').fill('doubleScore');
  await page.getByTestId('log-grid-derived-expression').fill('score * 2');
  await page.getByTestId('log-grid-derived-submit').click();

  // Backend first — UI may take a moment to pick up the new field
  await expect
    .poll(
      async () => {
        const fieldsRes = await orchestraFetch(
          `/v0/logs/fields?project_name=Assistants&context=${encodeURIComponent(contextPath)}`,
          { method: 'GET' },
          user.apiKey
        );
        if (!fieldsRes.ok) return false;
        const fields = (await fieldsRes.json()) as Record<string, unknown>;
        return (
          Object.prototype.hasOwnProperty.call(fields, 'doubleScore') ||
          Object.prototype.hasOwnProperty.call(fields, 'double_score')
        );
      },
      { timeout: 60_000 }
    )
    .toBe(true);

  await expect(page.getByTestId('log-grid-derived-dialog')).toHaveCount(0, {
    timeout: 15_000,
  });

  // Wait until the grid shows the new column header (appended to columnOrder on fields refresh)
  await expect(page.getByTestId('log-grid-sort-doubleScore')).toBeVisible({
    timeout: 60_000,
  });

  // Cell selection opens Interfaces-style view panel; Clear dismisses it
  const nameCell = firstRow
    .locator('[data-testid^="log-grid-cell-"]')
    .filter({ hasText: 'Katherine' });
  await nameCell.click();
  await expect(page.getByTestId('log-cell-view-panel')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('log-cell-view-clear').click();
  await expect(page.getByTestId('log-cell-view-panel')).toHaveCount(0);

  await nameCell.click();
  await expect(page.getByTestId('log-cell-view-panel')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('log-cell-view-edit-row').click();
  await expect(page.getByTestId('data-row-detail')).toBeVisible({ timeout: 15_000 });
});

test('common text filter narrows rows', async ({ authedPage: page }) => {
  await openPeopleTable(page);
  await page.getByTestId('log-grid-common-filter').fill('London');
  await expect(page.getByTestId('log-grid-page-status')).toContainText(/of 1/, {
    timeout: 30_000,
  });
  await expect(page.getByText('Ada Lovelace')).toBeVisible();
});

test('metric footer, page size, and create row', async ({ authedPage: page }) => {
  await openPeopleTable(page);

  await clickToolbarControl(page, 'log-grid-metric');
  await page.getByRole('option', { name: 'count' }).click();
  await expect(page.getByTestId('log-grid-metric-cell-score')).toBeVisible({ timeout: 30_000 });

  await clickToolbarControl(page, 'log-grid-page-size');
  await page.getByRole('option', { name: '20/page' }).click();

  const beforeCreate = await page.getByTestId('log-grid-page-status').textContent();
  await clickToolbarControl(page, 'log-grid-create-row');
  await expect
    .poll(
      async () => {
        const status = await page.getByTestId('log-grid-page-status').textContent();
        return status !== beforeCreate && /of 6/.test(status ?? '');
      },
      { timeout: 30_000 }
    )
    .toBe(true);

  const listRes = await orchestraFetch(
    `/v0/logs?project_name=Assistants&context=${encodeURIComponent(contextPath)}&limit=20`,
    { method: 'GET' },
    user.apiKey
  );
  expect(listRes.ok).toBe(true);
  const body = (await listRes.json()) as { count?: number; logs?: unknown[] };
  const count = body.count ?? body.logs?.length ?? 0;
  expect(count).toBeGreaterThanOrEqual(6);
});

test('column search works', async ({ authedPage: page }) => {
  await openPeopleTable(page);

  await expect(page.getByTestId('log-grid-page-status')).toContainText(/of \d+/, {
    timeout: 30_000,
  });

  await page.getByTestId('log-grid-columns').click();
  await page.getByTestId('log-grid-columns-search').fill('score');
  await expect(page.getByTestId('log-grid-column-toggle-score')).toBeVisible();
  await expect(page.getByTestId('log-grid-column-toggle-name')).toHaveCount(0);
  await page.keyboard.press('Escape');
});

test('derived column edit updates equation', async ({ authedPage: page }) => {
  await openPeopleTable(page);

  // Ensure derived column exists (created in earlier serial test, or create here)
  const derivedHeader = page.getByTestId('log-grid-sort-doubleScore');
  if (!(await derivedHeader.isVisible().catch(() => false))) {
    await clickToolbarControl(page, 'log-grid-derived-open');
    await page.getByTestId('log-grid-derived-name').fill('doubleScore');
    await page.getByTestId('log-grid-derived-expression').fill('score * 2');
    await page.getByTestId('log-grid-derived-submit').click();
    await expect(page.getByTestId('log-grid-sort-doubleScore')).toBeVisible({ timeout: 60_000 });
  }

  const editBtn = page.getByTestId('log-grid-derived-edit-doubleScore');
  await expect(editBtn).toBeVisible({ timeout: 15_000 });
  await editBtn.evaluate((el: HTMLElement) => el.click());
  await expect(page.getByTestId('log-grid-derived-dialog')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('log-grid-derived-expression').fill('score * 3');
  await page.getByTestId('log-grid-derived-submit').click();
  await expect(page.getByTestId('log-grid-derived-dialog')).toHaveCount(0, { timeout: 30_000 });

  await expect
    .poll(
      async () => {
        const fieldsRes = await orchestraFetch(
          `/v0/logs/fields?project_name=Assistants&context=${encodeURIComponent(contextPath)}`,
          { method: 'GET' },
          user.apiKey
        );
        if (!fieldsRes.ok) return false;
        const fields = (await fieldsRes.json()) as Record<string, { artifacts?: string }>;
        const art = fields.doubleScore?.artifacts ?? fields.double_score?.artifacts ?? '';
        return /3/.test(art);
      },
      { timeout: 60_000 }
    )
    .toBe(true);
});
