/**
 * Data LogGrid E2E — column visibility, server filters/sort, cell view panel,
 * infinite-scroll status, and cell/row range selection on the Assistants Data tab.
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
  // Shared city with Ada so multi-row selection can collapse city into one value group
  { name: 'Alan Turing', city: 'London', score: 88 },
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

/** Selection no longer auto-opens the pane — unfold via the toolbar toggle. */
async function openCellViewPanel(page: Page) {
  const toggle = page.getByTestId('log-grid-view-panel-toggle');
  await expect(toggle).toBeEnabled({ timeout: 10_000 });
  await expect(page.getByTestId('log-grid-view-panel-dot')).toBeVisible();
  await toggle.click();
  await expect(page.getByTestId('log-cell-view-panel')).toBeVisible({ timeout: 15_000 });
}

/** Body rows only — excludes `log-grid-row-index-header` which also matches the prefix. */
function logGridRows(page: Page) {
  return page.locator('tr[data-testid^="log-grid-row-"]');
}

test('hides a column, filters, sorts, and opens row detail via cell panel', async ({
  authedPage: page,
}) => {
  await openPeopleTable(page);

  // View pane stays closed until the toolbar unfold control is used
  await expect(page.getByTestId('log-cell-view-panel')).toHaveCount(0);
  await expect(page.getByTestId('log-cell-view-panel-empty')).toHaveCount(0);
  await expect(page.getByTestId('log-grid-page-status')).toBeVisible();
  await expect(page.getByTestId('log-grid-view-panel-toggle')).toBeDisabled();
  await expect(page.getByTestId('log-grid-page-size')).toHaveCount(0);
  await expect(page.getByTestId('log-grid-prev')).toHaveCount(0);
  await expect(page.getByTestId('log-grid-next')).toHaveCount(0);

  // Column visibility: hide city via column ⋯ menu
  const cityHeader = page.getByTestId('log-grid-header-city');
  await cityHeader.hover();
  await page.getByTestId('log-grid-column-menu-city').click({ force: true });
  await page.getByTestId('log-grid-hide-column-city').click({ force: true });
  await expect(page.getByTestId('log-grid-label-city')).toHaveCount(0);
  await expect(page.getByTestId('log-grid-label-name')).toBeVisible();

  // Server filter via column ⋯ menu
  const nameHeader = page.getByTestId('log-grid-header-name');
  await nameHeader.hover();
  await page.getByTestId('log-grid-column-menu-name').click({ force: true });
  await expect(page.getByTestId('log-grid-filter-open-name')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('log-grid-filter-open-name').click({ force: true });
  const filterValue = page.getByTestId('log-grid-filter-value');
  await expect(filterValue).toBeVisible({ timeout: 15_000 });
  await filterValue.fill('Ada');
  await filterValue.press('Enter');
  await expect(page.getByTestId('log-grid-page-status')).toContainText(/of 1/, {
    timeout: 30_000,
  });
  await expect(page.getByText('Ada Lovelace')).toBeVisible();
  await expect(page.getByText('Alan Turing')).toHaveCount(0);

  // Clear column filter (active filter icon)
  await page.getByTestId('log-grid-filter-name').click();
  await page.getByTestId('log-grid-filter-clear').click({ force: true });
  await expect(page.getByTestId('log-grid-page-status')).toContainText(/of 5/, {
    timeout: 30_000,
  });

  // Server sort by score descending via column ⋯ → Sort submenu
  const scoreHeader = page.getByTestId('log-grid-header-score');
  await scoreHeader.hover();
  await page.getByTestId('log-grid-column-menu-score').click({ force: true });
  await page.getByTestId('log-grid-sort-menu-score').hover();
  await page.getByTestId('log-grid-sort-desc-score').click({ force: true });
  const firstRow = logGridRows(page).first();
  await expect(firstRow).toContainText('97', { timeout: 30_000 });
  await expect(firstRow).toContainText('Katherine');

  // Cell selection does not auto-open the pane; unfold via toolbar toggle
  const nameCell = firstRow
    .locator('[data-testid^="log-grid-cell-"]')
    .filter({ hasText: 'Katherine' });
  await nameCell.click();
  await expect(page.getByTestId('log-cell-view-panel')).toHaveCount(0);
  await openCellViewPanel(page);
  await page.getByTestId('log-cell-view-clear').click();
  await expect(page.getByTestId('log-cell-view-panel')).toHaveCount(0);
  await expect(page.getByTestId('log-grid-view-panel-toggle')).toBeDisabled();

  await nameCell.click();
  await openCellViewPanel(page);
  await page.getByTestId('log-cell-view-edit-row').click();
  await expect(page.getByTestId('data-row-detail')).toBeVisible({ timeout: 15_000 });
});

test('common text filter narrows rows', async ({ authedPage: page }) => {
  await openPeopleTable(page);
  await page.getByTestId('log-grid-common-filter').fill('London');
  await expect(page.getByTestId('log-grid-page-status')).toContainText(/of 2/, {
    timeout: 30_000,
  });
  await expect(page.getByText('Ada Lovelace')).toBeVisible();
  await expect(page.getByText('Alan Turing')).toBeVisible();
});

test('column filter supports grouped or and top-level and', async ({ authedPage: page }) => {
  await openPeopleTable(page);

  const nameHeader = page.getByTestId('log-grid-header-name');
  await nameHeader.hover();
  await page.getByTestId('log-grid-column-menu-name').click({ force: true });
  await page.getByTestId('log-grid-filter-open-name').click({ force: true });

  await expect(page.getByTestId('log-grid-filter-value')).toBeVisible({ timeout: 15_000 });
  // Add the second clause before editing values so the popover layout stays stable.
  await page.getByTestId('log-grid-filter-add-clause').click({ force: true });
  await expect(page.getByTestId('log-grid-filter-value-1')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('log-grid-filter-value').fill('Ada');
  await page.getByTestId('log-grid-filter-value-1').fill('Alan');
  await page.getByTestId('log-grid-filter-join-1').click({ force: true }); // and → or
  await expect(page.getByTestId('log-grid-filter-join-1')).toHaveText('or');
  await page.getByTestId('log-grid-filter-group-1').click({ force: true });
  await expect(page.getByTestId('log-grid-filter-span-0')).toBeVisible();
  await page.getByTestId('log-grid-filter-apply').click({ force: true });

  await expect(page.getByTestId('log-grid-page-status')).toContainText(/of 2/, {
    timeout: 30_000,
  });
  await expect(page.getByText('Ada Lovelace')).toBeVisible();
  await expect(page.getByText('Alan Turing')).toBeVisible();
  await expect(page.getByText('Grace Hopper')).toHaveCount(0);

  // Re-open and add an ungrouped AND clause that excludes Ada → only Alan remains
  await page.getByTestId('log-grid-filter-name').click({ force: true });
  await expect(page.getByTestId('log-grid-filter-add-clause')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('log-grid-filter-add-clause').click({ force: true });
  await expect(page.getByTestId('log-grid-filter-fn-2')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('log-grid-filter-fn-2').click({ force: true });
  await page.getByRole('option', { name: 'does not contain' }).click({ force: true });
  await page.getByTestId('log-grid-filter-value-2').fill('Ada');
  await expect(page.getByTestId('log-grid-filter-join-2')).toHaveText('and');
  await page.getByTestId('log-grid-filter-apply').click({ force: true });

  await expect(page.getByTestId('log-grid-page-status')).toContainText(/of 1/, {
    timeout: 30_000,
  });
  await expect(page.getByText('Alan Turing')).toBeVisible();
  await expect(page.getByText('Ada Lovelace')).toHaveCount(0);
});

test('loaded status shows 1–N of total without page controls', async ({ authedPage: page }) => {
  await openPeopleTable(page);

  await expect(page.getByTestId('log-grid-page-status')).toContainText(/1–5 of 5/, {
    timeout: 30_000,
  });
  await expect(page.getByTestId('log-grid-page-size')).toHaveCount(0);
  await expect(page.getByTestId('log-grid-prev')).toHaveCount(0);
  await expect(page.getByTestId('log-grid-next')).toHaveCount(0);
});

test('row index selects whole rows with click, ctrl, and shift', async ({ authedPage: page }) => {
  await openPeopleTable(page);

  const firstRow = logGridRows(page).nth(0);
  const thirdRow = logGridRows(page).nth(2);
  await expect(firstRow).toBeVisible({ timeout: 30_000 });

  const firstIndex = firstRow.locator('[data-testid^="log-grid-row-index-"]');
  const thirdIndex = thirdRow.locator('[data-testid^="log-grid-row-index-"]');

  await firstIndex.click();
  await expect(page.getByTestId('log-cell-view-panel')).toHaveCount(0);
  await openCellViewPanel(page);
  // People has name/city/score → 3 cells for one row → 3 value groups
  await expect(page.getByTestId('log-cell-view-panel')).toContainText('3 cells');
  await expect(page.getByTestId('log-cell-view-group')).toHaveCount(3);

  await thirdIndex.click({ modifiers: ['Shift'] });
  await expect(page.getByTestId('log-cell-view-panel')).toContainText('9 cells', {
    timeout: 15_000,
  });
  // Distinct values across 3 rows → still 9 groups (no collapse)
  await expect(page.getByTestId('log-cell-view-group')).toHaveCount(9);

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('log-cell-view-panel')).toHaveCount(0);

  // Ada + Alan share city=London → city collapses to 1 group; name/score stay distinct.
  // View pane uses the same `#` display indices as the grid (not Orchestra log ids).
  const adaRow = logGridRows(page).filter({ hasText: 'Ada Lovelace' });
  const alanRow = logGridRows(page).filter({ hasText: 'Alan Turing' });
  const adaNum = Number(
    (await adaRow.locator('[data-testid^="log-grid-row-index-"]').textContent())?.trim()
  );
  const alanNum = Number(
    (await alanRow.locator('[data-testid^="log-grid-row-index-"]').textContent())?.trim()
  );
  expect(adaNum).toBeGreaterThan(0);
  expect(alanNum).toBeGreaterThan(0);
  const [lo, hi] = adaNum < alanNum ? [adaNum, alanNum] : [alanNum, adaNum];
  const rowRangeLabel = hi === lo + 1 ? `${lo}-${hi}` : `${lo}, ${hi}`;

  await adaRow.locator('[data-testid^="log-grid-row-index-"]').click();
  await alanRow.locator('[data-testid^="log-grid-row-index-"]').click({ modifiers: ['Control'] });
  await openCellViewPanel(page);
  await expect(page.getByTestId('log-cell-view-panel')).toContainText('6 cells', {
    timeout: 15_000,
  });
  await expect(page.getByTestId('log-cell-view-group')).toHaveCount(5);
  await expect(page.getByTestId('log-cell-view-panel')).toContainText(`rows [${rowRangeLabel}]`);
});

test('shift-click selects the bounding cell region', async ({ authedPage: page }) => {
  await openPeopleTable(page);

  const firstRow = logGridRows(page).nth(0);
  const thirdRow = logGridRows(page).nth(2);
  await expect(firstRow).toBeVisible({ timeout: 30_000 });

  const startCell = firstRow.locator('[data-testid^="log-grid-cell-"]').first();
  const endCell = thirdRow.locator('[data-testid^="log-grid-cell-"]').nth(1);
  await startCell.click();
  await expect(page.getByTestId('log-cell-view-panel')).toHaveCount(0);
  await openCellViewPanel(page);
  await expect(page.getByTestId('log-cell-view-panel')).toContainText('Selected cell');

  await endCell.click({ modifiers: ['Shift'] });
  await expect(page.getByTestId('log-cell-view-panel')).toContainText('6 cells', {
    timeout: 15_000,
  });
});

test('click-drag selects the bounding cell region', async ({ authedPage: page }) => {
  await openPeopleTable(page);

  const firstRow = logGridRows(page).nth(0);
  const thirdRow = logGridRows(page).nth(2);
  await expect(firstRow).toBeVisible({ timeout: 30_000 });

  const startCell = firstRow.locator('[data-testid^="log-grid-cell-"]').first();
  const endCell = thirdRow.locator('[data-testid^="log-grid-cell-"]').nth(1);

  const startBox = await startCell.boundingBox();
  const endBox = await endCell.boundingBox();
  expect(startBox).toBeTruthy();
  expect(endBox).toBeTruthy();

  await page.mouse.move(startBox!.x + startBox!.width / 2, startBox!.y + startBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox!.x + endBox!.width / 2, endBox!.y + endBox!.height / 2, {
    steps: 12,
  });
  await page.mouse.up();

  await expect(page.getByTestId('log-cell-view-panel')).toHaveCount(0);
  await openCellViewPanel(page);
  await expect(page.getByTestId('log-cell-view-panel')).toContainText('6 cells', {
    timeout: 15_000,
  });
});

test('creates a derived column from the toolbar and pins it on the far right', async ({
  authedPage: page,
}) => {
  await openPeopleTable(page);

  const derivedKey = `doubled_score_${Date.now()}`;
  // Console field keys are camelCased at the Orchestra boundary.
  const derivedColumnId = derivedKey.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

  await page.getByTestId('log-grid-derived-open').click();
  await expect(page.getByTestId('log-grid-derived-dialog')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('log-grid-derived-name').fill(derivedKey);
  await page.getByTestId('log-grid-derived-expression').locator('input').fill('score * 2');
  await page.getByTestId('log-grid-derived-submit').click();

  await expect(page.getByTestId('log-grid-derived-dialog')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByTestId(`log-grid-header-${derivedColumnId}`)).toBeVisible({
    timeout: 30_000,
  });

  // New derived column is the last data header (after name/city/score).
  const headers = page.locator('thead [data-testid^="log-grid-header-"]');
  await expect(headers.last()).toHaveAttribute('data-testid', `log-grid-header-${derivedColumnId}`);

  // Ada's score is 95 → derived value 190 should appear in the grid.
  await expect(logGridRows(page).filter({ hasText: 'Ada Lovelace' })).toContainText('190', {
    timeout: 30_000,
  });

  const fieldsRes = await orchestraFetch(
    `/v0/logs/fields?${new URLSearchParams({
      project_name: 'Assistants',
      context: contextPath,
    }).toString()}`,
    { method: 'GET' },
    user.apiKey
  );
  expect(fieldsRes.ok).toBe(true);
  const fields = (await fieldsRes.json()) as Record<string, { field_type?: string }>;
  // Orchestra stores the snake_case key the client submitted.
  expect(fields[derivedKey]?.field_type).toBe('derived_entry');
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

test('group by nests columns and expands leaf rows', async ({ authedPage: page }) => {
  await openPeopleTable(page);

  const cityHeader = page.getByTestId('log-grid-header-city');
  await cityHeader.hover();
  await page.getByTestId('log-grid-column-menu-city').click({ force: true });
  await page.getByTestId('log-grid-group-by-city').click({ force: true });

  await expect(page.getByTestId('log-grid-page-status')).toContainText(/of \d+/, {
    timeout: 30_000,
  });
  // Ada + Alan both London → one London group among others
  await expect(page.getByText('London').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('log-grid-group-expand-city').first()).toBeVisible();

  // Nested group-by: append name under city
  const nameHeader = page.getByTestId('log-grid-header-name');
  await nameHeader.hover();
  await page.getByTestId('log-grid-column-menu-name').click({ force: true });
  await page.getByTestId('log-grid-group-by-name').click({ force: true });

  const cityExpand = page.getByTestId('log-grid-group-expand-city').first();
  await cityExpand.click();
  await expect(page.getByTestId('log-grid-group-expand-name').first()).toBeVisible({
    timeout: 30_000,
  });

  await page.getByTestId('log-grid-group-expand-name').first().click();
  await expect(logGridRows(page).first()).toBeVisible({ timeout: 30_000 });

  // Ungroup city (leaves name grouping)
  await cityHeader.hover();
  await page.getByTestId('log-grid-column-menu-city').click({ force: true });
  await page.getByTestId('log-grid-group-by-city').click({ force: true });
  await expect(page.getByTestId('log-grid-group-expand-name').first()).toBeVisible({
    timeout: 30_000,
  });
});

test('row index column stays pinned while scrolling horizontally', async ({ authedPage: page }) => {
  await openPeopleTable(page);

  const viewport = page.getByTestId('log-grid-scroll-viewport');
  const indexHeader = page.getByTestId('log-grid-row-index-header');
  const firstIndex = logGridRows(page).first().locator('[data-testid^="log-grid-row-index-"]');
  await expect(indexHeader).toBeVisible({ timeout: 30_000 });

  // Force horizontal overflow so scrollLeft is meaningful on a narrow People table.
  await page.locator('[data-testid="data-leaf-table"] table').evaluate((table) => {
    table.style.width = '2400px';
  });

  const before = await indexHeader.boundingBox();
  expect(before).toBeTruthy();

  await viewport.evaluate((el) => {
    el.scrollLeft = 600;
  });
  await expect.poll(async () => viewport.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);

  const afterHeader = await indexHeader.boundingBox();
  const afterCell = await firstIndex.boundingBox();
  const viewportBox = await viewport.boundingBox();
  expect(afterHeader).toBeTruthy();
  expect(afterCell).toBeTruthy();
  expect(viewportBox).toBeTruthy();

  // Pinned column should remain at the left edge of the scroll viewport.
  expect(Math.abs(afterHeader!.x - viewportBox!.x)).toBeLessThan(4);
  expect(Math.abs(afterCell!.x - viewportBox!.x)).toBeLessThan(4);
  expect(Math.abs(afterHeader!.x - before!.x)).toBeLessThan(4);

  // Row selection via the pinned index still works after scroll.
  await firstIndex.click();
  await openCellViewPanel(page);
  await expect(page.getByTestId('log-cell-view-panel')).toContainText('3 cells');
});
