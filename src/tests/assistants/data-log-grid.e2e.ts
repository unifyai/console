/**
 * Data LogGrid E2E — column visibility, server filters/sort, cell view panel,
 * infinite-scroll status, and cell/row range selection on the Assistants Data tab.
 *
 * Run: npx playwright test src/tests/assistants/data-log-grid.e2e.ts
 */

import { expect, type Page } from '@playwright/test';
import { DEFAULT_LOG_PAGE_SIZE } from '@/lib/logs/types';
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
  { name: 'Ada Lovelace', city: 'London', score: 95, team_id: 1 },
  // Shared city with Ada so multi-row selection can collapse city into one value group
  { name: 'Alan Turing', city: 'London', score: 88, team_id: 1 },
  { name: 'Grace Hopper', city: 'New York', score: 91, team_id: 2 },
  { name: 'Katherine Johnson', city: 'Hampton', score: 97, team_id: 2 },
  { name: 'Donald Knuth', city: 'Stanford', score: 84, team_id: 0 },
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

/** Selection does not auto-open the pane — unfold via toolbar. Multi-cell Enter also opens. */
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

  // Sort submenu mirrors active direction with a tick (data-active)
  await scoreHeader.hover();
  await page.getByTestId('log-grid-column-menu-score').click({ force: true });
  await page.getByTestId('log-grid-sort-menu-score').hover();
  await expect(page.getByTestId('log-grid-sort-desc-score')).toHaveAttribute('data-active', 'true');
  await expect(page.getByTestId('log-grid-sort-asc-score')).toHaveAttribute('data-active', 'false');
  await page.keyboard.press('Escape');

  // Single click selects but does not open the pane; unfold via toolbar toggle
  const nameCell = firstRow
    .locator('[data-testid^="log-grid-cell-"]')
    .filter({ hasText: 'Katherine' });
  await nameCell.click();
  await expect(page.getByTestId('log-cell-view-panel')).toHaveCount(0);
  await openCellViewPanel(page);
  await page.getByTestId('log-cell-view-panel').getByRole('button', { name: 'Close' }).click();
  await expect(page.getByTestId('log-cell-view-panel')).toHaveCount(0);

  await nameCell.click();
  await openCellViewPanel(page);
  const valueBox = page.getByTestId('log-cell-view-value').first();
  await expect(valueBox).toHaveAttribute('data-editable', 'true');
  await valueBox.click();
  await expect(page.getByTestId('log-cell-view-editor')).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('log-cell-view-editor')).toHaveCount(0);
});

test('double-click and Enter edit in place; multi-cell Enter opens the pane', async ({
  authedPage: page,
}) => {
  await openPeopleTable(page);

  const firstRow = logGridRows(page).first();
  await expect(firstRow).toBeVisible({ timeout: 30_000 });
  const nameCell = firstRow.locator('[data-testid^="log-grid-cell-"]').first();

  await nameCell.dblclick();
  await expect(page.getByTestId('log-grid-inline-editor')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('log-cell-view-panel')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('log-grid-inline-editor')).toHaveCount(0);

  // Escape keeps the cell selected (a second click would toggle it off).
  await expect(page.getByTestId('log-grid-view-panel-toggle')).toBeEnabled({ timeout: 10_000 });
  await page.getByTestId('data-leaf-table').press('Enter');
  await expect(page.getByTestId('log-grid-inline-editor')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('log-cell-view-panel')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('log-grid-inline-editor')).toHaveCount(0);

  // Multi-cell selection: Enter opens the RHS panel (not inline edit).
  const secondRow = logGridRows(page).nth(1);
  const secondCell = secondRow.locator('[data-testid^="log-grid-cell-"]').first();
  await secondCell.click({ modifiers: ['Shift'] });
  await expect(page.getByTestId('log-grid-view-panel-toggle')).toBeEnabled({ timeout: 10_000 });
  await page.getByTestId('data-leaf-table').press('Enter');
  await expect(page.getByTestId('log-cell-view-panel')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('log-grid-inline-editor')).toHaveCount(0);
  await page.getByTestId('log-cell-view-panel').getByRole('button', { name: 'Close' }).click();
  await expect(page.getByTestId('log-cell-view-panel')).toHaveCount(0);

  // Click a different cell so selection is a fresh single cell (not a toggle-off).
  await secondCell.click();
  await openCellViewPanel(page);
  await expect(page.getByTestId('log-cell-view-editor')).toHaveCount(0);
  await expect(page.getByTestId('log-grid-inline-editor')).toHaveCount(0);
});

test('clicking empty space outside cells clears the selection', async ({ authedPage: page }) => {
  await openPeopleTable(page);

  const firstRow = logGridRows(page).first();
  await expect(firstRow).toBeVisible({ timeout: 30_000 });
  const nameCell = firstRow.locator('[data-testid^="log-grid-cell-"]').first();
  await nameCell.click();
  await expect(page.getByTestId('log-grid-view-panel-toggle')).toBeEnabled({ timeout: 10_000 });

  const background = page.getByTestId('log-grid-background');
  await expect(background).toBeVisible();
  const box = await background.boundingBox();
  expect(box).toBeTruthy();
  // Click in the empty region below the short table body.
  await background.click({
    position: {
      x: Math.min(40, box!.width / 2),
      y: Math.max(box!.height - 24, box!.height * 0.85),
    },
  });
  await expect(page.getByTestId('log-grid-view-panel-toggle')).toBeDisabled({ timeout: 10_000 });
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
  // People has name/city/score → 3 column headings, one value each
  await expect(page.getByTestId('log-cell-view-panel')).toContainText(
    '1 row · 3 columns · 3 cells'
  );
  await expect(page.getByTestId('log-cell-view-column')).toHaveCount(3);
  await expect(page.getByTestId('log-cell-view-group')).toHaveCount(3);

  await thirdIndex.click({ modifiers: ['Shift'] });
  await expect(page.getByTestId('log-cell-view-panel')).toContainText(
    '3 rows · 3 columns · 9 cells',
    {
      timeout: 15_000,
    }
  );
  // Still 3 columns; distinct values across 3 rows → 9 value entries
  await expect(page.getByTestId('log-cell-view-column')).toHaveCount(3);
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
  await expect(page.getByTestId('log-cell-view-panel')).toContainText(
    '2 rows · 3 columns · 6 cells',
    {
      timeout: 15_000,
    }
  );
  // 3 columns; city collapses to 1 value entry → 5 total
  await expect(page.getByTestId('log-cell-view-column')).toHaveCount(3);
  await expect(page.getByTestId('log-cell-view-group')).toHaveCount(5);
  // Collapsed city value shows compressed `#` range in the in-box gutter.
  await expect(
    page.getByTestId('log-cell-view-row-label').filter({ hasText: rowRangeLabel })
  ).toBeVisible();
});

test('column header selects whole columns with click, ctrl, and shift', async ({
  authedPage: page,
}) => {
  await openPeopleTable(page);
  await expect(logGridRows(page).first()).toBeVisible({ timeout: 30_000 });

  // 5 seeded people → clicking city selects 5 cells in that column.
  await page.getByTestId('log-grid-header-city').click();
  await openCellViewPanel(page);
  await expect(page.getByTestId('log-cell-view-panel')).toContainText(
    '5 rows · 1 column · 5 cells',
    {
      timeout: 15_000,
    }
  );
  await expect(page.getByTestId('log-cell-view-column')).toHaveCount(1);
  // Ada+Alan share London → 4 distinct city values across 5 rows.
  await expect(page.getByTestId('log-cell-view-group')).toHaveCount(4);

  // Shift from city → score selects both columns (10 cells).
  await page.getByTestId('log-grid-header-score').click({ modifiers: ['Shift'] });
  await expect(page.getByTestId('log-cell-view-panel')).toContainText(
    '5 rows · 2 columns · 10 cells',
    {
      timeout: 15_000,
    }
  );
  await expect(page.getByTestId('log-cell-view-column')).toHaveCount(2);

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('log-cell-view-panel')).toHaveCount(0);

  // Ctrl/Cmd additive: name + city → 10 cells.
  await page.getByTestId('log-grid-header-name').click();
  await page.getByTestId('log-grid-header-city').click({ modifiers: ['Control'] });
  await openCellViewPanel(page);
  await expect(page.getByTestId('log-cell-view-panel')).toContainText(
    '5 rows · 2 columns · 10 cells',
    {
      timeout: 15_000,
    }
  );
  await expect(page.getByTestId('log-cell-view-column')).toHaveCount(2);
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
  await expect(page.getByTestId('log-cell-view-panel')).toContainText('1 row · 1 column · 1 cell');

  await endCell.click({ modifiers: ['Shift'] });
  await expect(page.getByTestId('log-cell-view-panel')).toContainText(
    '3 rows · 2 columns · 6 cells',
    {
      timeout: 15_000,
    }
  );
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
  await expect(page.getByTestId('log-cell-view-panel')).toContainText(
    '3 rows · 2 columns · 6 cells',
    {
      timeout: 15_000,
    }
  );
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

  const headerLabels = () =>
    page
      .locator('[data-testid^="log-grid-label-"]')
      .evaluateAll((els) =>
        els.map((el) => el.getAttribute('data-testid')?.replace('log-grid-label-', '') ?? '')
      );

  const orderBefore = await headerLabels();

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

  // Grouped column is shown first while grouped (display-only pin)
  await expect.poll(async () => (await headerLabels())[0], { timeout: 10_000 }).toBe('city');

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

  // Ungroup city (leaves name grouping) — name stays front-pinned for display
  await cityHeader.hover();
  await page.getByTestId('log-grid-column-menu-city').click({ force: true });
  await page.getByTestId('log-grid-group-by-city').click({ force: true });
  await expect(page.getByTestId('log-grid-group-expand-name').first()).toBeVisible({
    timeout: 30_000,
  });
  await expect.poll(async () => (await headerLabels())[0], { timeout: 10_000 }).toBe('name');

  // Full ungroup restores canonical (pre-group) column order
  await nameHeader.hover();
  await page.getByTestId('log-grid-column-menu-name').click({ force: true });
  await page.getByTestId('log-grid-group-by-name').click({ force: true });
  await expect(page.getByTestId('log-grid-group-expand-name')).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect.poll(async () => headerLabels(), { timeout: 10_000 }).toEqual(orderBefore);
  // Ungroup must not fall through to header column-select (modal={false} menus).
  await expect(page.locator('[data-testid^="log-grid-cell-"].bg-primary-tint-10')).toHaveCount(0);
});

test('ungroup clears grouping without selecting the column', async ({ authedPage: page }) => {
  await openPeopleTable(page);

  const cityHeader = page.getByTestId('log-grid-header-city');
  await cityHeader.hover();
  await page.getByTestId('log-grid-column-menu-city').click({ force: true });
  await page.getByTestId('log-grid-group-by-city').click({ force: true });
  await expect(page.getByTestId('log-grid-group-expand-city').first()).toBeVisible({
    timeout: 30_000,
  });

  await cityHeader.hover();
  await page.getByTestId('log-grid-column-menu-city').click({ force: true });
  await page.getByTestId('log-grid-group-by-city').click({ force: true });
  await expect(page.getByTestId('log-grid-group-expand-city')).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(page.getByTestId('log-grid-page-status')).toContainText(/of \d+/, {
    timeout: 30_000,
  });
  await expect(page.locator('[data-testid^="log-grid-cell-"].bg-primary-tint-10')).toHaveCount(0);
});

test('group by snake_case field uses Orchestra keys not camelCase', async ({
  authedPage: page,
}) => {
  // Regression: response casing turns team_id → teamId in the UI; group_by must
  // send Entries/team_id or Orchestra collapses every row into a single null group.
  await openPeopleTable(page);

  const teamHeader = page.getByTestId('log-grid-header-teamId');
  await expect(teamHeader).toBeVisible({ timeout: 30_000 });
  await teamHeader.hover();
  await page.getByTestId('log-grid-column-menu-teamId').click({ force: true });
  await page.getByTestId('log-grid-group-by-teamId').click({ force: true });

  await expect(page.getByTestId('log-grid-page-status')).toContainText(/of \d+/, {
    timeout: 30_000,
  });
  // Three team_id values (0, 1, 2) — must not collapse to a single "(n) null" group.
  await expect(page.getByTestId('log-grid-group-expand-teamId')).toHaveCount(3, {
    timeout: 30_000,
  });
  await expect(page.getByText('null')).toHaveCount(0);

  await page.getByTestId('log-grid-group-expand-teamId').first().click();
  await expect(logGridRows(page).first()).toBeVisible({ timeout: 30_000 });
});

test('grouped rows use nested x.y.z labels in grid and view pane', async ({ authedPage: page }) => {
  await openPeopleTable(page);

  const cityHeader = page.getByTestId('log-grid-header-city');
  await cityHeader.hover();
  await page.getByTestId('log-grid-column-menu-city').click({ force: true });
  await page.getByTestId('log-grid-group-by-city').click({ force: true });

  const groupIndexes = page.locator('[data-testid^="log-grid-group-index-"]');
  await expect(groupIndexes.first()).toBeVisible({ timeout: 30_000 });
  // Top-level group headers are single-segment labels (1, 2, …) — not dotted.
  await expect(groupIndexes.first()).toHaveText(/^\d+$/);

  await page.getByTestId('log-grid-group-expand-city').first().click();
  const firstLeafIndex = logGridRows(page).first().locator('[data-testid^="log-grid-row-index-"]');
  await expect(firstLeafIndex).toHaveText(/^\d+\.\d+$/, { timeout: 30_000 });

  const groupLabel = ((await groupIndexes.first().textContent()) ?? '').trim();
  const leafLabel = ((await firstLeafIndex.textContent()) ?? '').trim();
  expect(leafLabel.startsWith(`${groupLabel}.`)).toBe(true);

  // Expand a second city group so we can select across nests.
  const expands = page.getByTestId('log-grid-group-expand-city');
  expect(await expands.count()).toBeGreaterThanOrEqual(2);
  await expands.nth(1).click();

  const leafRows = logGridRows(page);
  await expect(leafRows.first()).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => leafRows.count()).toBeGreaterThanOrEqual(2);

  const rowA = leafRows.first();
  const rowB = leafRows.last();
  const labelA = (
    (await rowA.locator('[data-testid^="log-grid-row-index-"]').textContent()) ?? ''
  ).trim();
  const labelB = (
    (await rowB.locator('[data-testid^="log-grid-row-index-"]').textContent()) ?? ''
  ).trim();
  expect(labelA).toMatch(/^\d+\.\d+$/);
  expect(labelB).toMatch(/^\d+\.\d+$/);
  expect(labelA).not.toBe(labelB);

  await rowA.locator('[data-testid^="log-grid-cell-"]').first().click();
  await rowB
    .locator('[data-testid^="log-grid-cell-"]')
    .first()
    .click({ modifiers: ['Control'] });
  await openCellViewPanel(page);

  const panel = page.getByTestId('log-cell-view-panel');
  await expect(panel).toContainText(labelA);
  await expect(panel).toContainText(labelB);
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
  await expect(page.getByTestId('log-cell-view-panel')).toContainText(
    '1 row · 3 columns · 3 cells'
  );
});

test('refresh mode menu supports Refresh, Freeze, and Live', async ({ authedPage: page }) => {
  await openPeopleTable(page);

  const modeBtn = page.getByTestId('log-grid-refresh-mode');
  await expect(modeBtn).toBeVisible({ timeout: 30_000 });

  // Sit between Columns and derived +
  const columnsBtn = page.getByTestId('log-grid-columns');
  const derivedBtn = page.getByTestId('log-grid-derived-open');
  const modeBox = await modeBtn.boundingBox();
  const columnsBox = await columnsBtn.boundingBox();
  const derivedBox = await derivedBtn.boundingBox();
  expect(modeBox).toBeTruthy();
  expect(columnsBox).toBeTruthy();
  expect(derivedBox).toBeTruthy();
  expect(modeBox!.x).toBeGreaterThan(columnsBox!.x);
  expect(modeBox!.x).toBeLessThan(derivedBox!.x);

  await modeBtn.click();
  // Refresh is an action, not a selectable mode — no checkmark while idle
  await expect(
    page.getByTestId('log-grid-refresh-mode-refresh').locator('.lucide-check')
  ).toHaveCount(0);
  await expect(page.getByTestId('log-grid-refresh-mode-freeze')).toHaveAttribute(
    'data-active',
    'false'
  );
  await expect(page.getByTestId('log-grid-refresh-mode-live')).toHaveAttribute(
    'data-active',
    'false'
  );

  await page.getByTestId('log-grid-refresh-mode-freeze').click();
  await modeBtn.click();
  await expect(page.getByTestId('log-grid-refresh-mode-freeze')).toHaveAttribute(
    'data-active',
    'true'
  );
  await expect(page.getByTestId('log-grid-refresh-mode-live')).toHaveAttribute(
    'data-active',
    'false'
  );
  await expect(
    page.getByTestId('log-grid-refresh-mode-freeze').locator('.lucide-check')
  ).toBeVisible();
  await expect(
    page.getByTestId('log-grid-refresh-mode-refresh').locator('.lucide-check')
  ).toHaveCount(0);

  await page.getByTestId('log-grid-refresh-mode-live').click();
  await modeBtn.click();
  await expect(page.getByTestId('log-grid-refresh-mode-live')).toHaveAttribute(
    'data-active',
    'true'
  );
  await expect(page.getByTestId('log-grid-refresh-mode-freeze')).toHaveAttribute(
    'data-active',
    'false'
  );
  await expect(
    page.getByTestId('log-grid-refresh-mode-live').locator('.lucide-check')
  ).toBeVisible();

  await page.getByTestId('log-grid-refresh-mode-refresh').click();
  await expect(page.getByTestId('log-grid-page-status')).toContainText(/of \d+/, {
    timeout: 30_000,
  });
  await modeBtn.click();
  await expect(page.getByTestId('log-grid-refresh-mode-freeze')).toHaveAttribute(
    'data-active',
    'false'
  );
  await expect(page.getByTestId('log-grid-refresh-mode-live')).toHaveAttribute(
    'data-active',
    'false'
  );
  await expect(
    page.getByTestId('log-grid-refresh-mode-refresh').locator('.lucide-check')
  ).toHaveCount(0);
});

test('resizes a column by dragging the boundary in the body', async ({ authedPage: page }) => {
  await openPeopleTable(page);

  const header = page.getByTestId('log-grid-header-name');
  const resizer = page.getByTestId('log-grid-resize-name');
  await expect(header).toBeVisible();
  await expect(resizer).toBeVisible();

  // Full-height handle spans header + body (header alone is ~32px).
  await expect.poll(async () => (await resizer.boundingBox())?.height ?? 0).toBeGreaterThan(80);

  const before = await header.boundingBox();
  expect(before).toBeTruthy();
  const handle = await resizer.boundingBox();
  expect(handle).toBeTruthy();

  const startX = handle!.x + handle!.width / 2;
  // Drag from well below the header so this exercises the body edge, not the header.
  const startY = handle!.y + Math.min(handle!.height - 8, 120);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 80, startY, { steps: 8 });
  await page.mouse.up();

  await expect
    .poll(async () => (await header.boundingBox())?.width ?? 0)
    .toBeGreaterThan((before?.width ?? 0) + 40);
});

test('expanded group load more fetches remaining children from Orchestra', async ({
  authedPage: page,
}) => {
  // Page size is DEFAULT_LOG_PAGE_SIZE (50). Seed an oversized city into the
  // existing People table so Group by uses the same path as other specs.
  const bulkTotal = DEFAULT_LOG_PAGE_SIZE + 5;
  const bulkCity = 'Bulkville';
  const bulkRows = Array.from({ length: bulkTotal }, (_, i) => ({
    name: `Bulk Person ${i}`,
    city: bulkCity,
    score: 50 + (i % 40),
    team_id: 9,
  }));
  const seedRes = await orchestraFetch(
    '/v0/logs',
    {
      method: 'POST',
      body: JSON.stringify({
        project_name: 'Assistants',
        context: contextPath,
        entries: bulkRows,
      }),
    },
    user.apiKey
  );
  expect(seedRes.ok).toBe(true);

  await openPeopleTable(page);

  const cityHeader = page.getByTestId('log-grid-header-city');
  await expect(cityHeader).toBeVisible({ timeout: 30_000 });
  await cityHeader.hover();
  await page.getByTestId('log-grid-column-menu-city').click({ force: true });
  await page.getByTestId('log-grid-group-by-city').click({ force: true });

  await expect(page.getByText(bulkCity).first()).toBeVisible({ timeout: 30_000 });
  // Bulkville sorts first among city groups — expand it.
  await page.getByTestId('log-grid-group-expand-city').first().click();

  await expect(logGridRows(page)).toHaveCount(DEFAULT_LOG_PAGE_SIZE, { timeout: 30_000 });
  const loadMore = page.getByTestId('log-grid-group-load-more-btn-city');
  await expect(loadMore).toBeVisible({ timeout: 15_000 });
  await loadMore.click();

  await expect(logGridRows(page)).toHaveCount(bulkTotal, { timeout: 30_000 });
  await expect(loadMore).toHaveCount(0);

  const params = new URLSearchParams({
    project_name: 'Assistants',
    context: contextPath,
    filter: `city == "${bulkCity}"`,
    limit: '1',
  });
  const listRes = await orchestraFetch(
    `/v0/logs?${params.toString()}`,
    { method: 'GET' },
    user.apiKey
  );
  expect(listRes.ok).toBe(true);
  const listJson = (await listRes.json()) as { count?: number };
  expect(listJson.count).toBe(bulkTotal);
});
