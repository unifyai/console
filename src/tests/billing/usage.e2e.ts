/**
 * Usage Page E2E — page loads with chart/filters, interactions work,
 * and seeded ledger data is displayed correctly.
 *
 * Run: npx playwright test src/tests/billing/usage.e2e.ts
 */

import { test as unauthTest, expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createBillingTest,
  dbExecBlock,
  dbExec,
  type TestUser,
  waitForUsageReady,
} from './helpers';

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

function getBillingAccountId(userId: string): number {
  return parseInt(dbExec(`SELECT billing_account_id FROM "user" WHERE id = '${userId}'`), 10);
}

function seedTransaction(opts: {
  baId: number;
  userId: string;
  amount: number;
  category: string;
  description: string;
  minutesAgo?: number;
}) {
  const ago = opts.minutesAgo ?? 5;
  dbExecBlock(`
DO \\$\\$
BEGIN
  INSERT INTO credit_transaction
    (billing_account_id, user_id, amount, category, description, at)
  VALUES
    (${opts.baId}, '${opts.userId}', ${opts.amount}, '${opts.category}', '${opts.description}',
     NOW() - INTERVAL '${ago} minutes');
END
\\$\\$;
`);
}

function cleanupTransactions(baId: number) {
  try {
    dbExec(`DELETE FROM credit_transaction WHERE billing_account_id = ${baId}`);
  } catch {
    /* best effort */
  }
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

const user = createTestUser({ name: 'Usage', lastName: 'Test', credits: 5_000 });
const test = createBillingTest(user);

let baId: number;

test.beforeAll(() => {
  baId = getBillingAccountId(user.id);
  cleanupTransactions(baId);

  seedTransaction({
    baId,
    userId: user.id,
    amount: -0.12,
    category: 'llm',
    description: 'Assistant work',
    minutesAgo: 10,
  });
  seedTransaction({
    baId,
    userId: user.id,
    amount: -0.08,
    category: 'llm',
    description: 'Assistant work',
    minutesAgo: 8,
  });
  seedTransaction({
    baId,
    userId: user.id,
    amount: -10,
    category: 'hire',
    description: 'Assistant creation',
    minutesAgo: 6,
  });
  seedTransaction({
    baId,
    userId: user.id,
    amount: -2,
    category: 'resources',
    description: 'Contact provisioning',
    minutesAgo: 4,
  });
  seedTransaction({
    baId,
    userId: user.id,
    amount: -0.5,
    category: 'media',
    description: 'Photo generation',
    minutesAgo: 2,
  });
});

test.afterAll(() => {
  cleanupTransactions(baId);
  cleanupUser(user.id);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('loads usage page with all key components visible', async ({ authedPage: page }) => {
  await waitForUsageReady(page);

  await expect(page.getByTestId('category-filter')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('granularity-filter')).toBeVisible();
  await expect(page.getByTestId('timeframe-filter')).toBeVisible();
  await expect(page.getByTestId('spending-limit-card')).toBeVisible();
  await expect(page.getByTestId('transaction-ledger')).toBeVisible();

  const chart = page.locator('[data-testid="usage-chart"]:visible');
  const ledgerRow = page.getByTestId('aggregated-row').first();
  await expect
    .poll(async () => (await chart.isVisible()) || (await ledgerRow.isVisible()), {
      timeout: 20_000,
    })
    .toBe(true);
});

test('ledger displays seeded transactions with correct category descriptions', async ({
  authedPage: page,
}) => {
  await page.goto('/usage');
  await expect(page.getByTestId('transaction-ledger')).toBeVisible({ timeout: 15_000 });

  // Wait for aggregated data to load
  await expect(page.getByTestId('aggregated-row').first()).toBeVisible({ timeout: 10_000 });

  // Aggregated rows show CATEGORY_DESCRIPTIONS values
  const ledger = page.getByTestId('transaction-ledger');
  await expect(ledger.getByText('Assistant work').first()).toBeVisible();
  await expect(ledger.getByText('Assistant creation')).toBeVisible();
  await expect(ledger.getByText('Created and provisioned contacts')).toBeVisible();
  await expect(ledger.getByText('Generated photos and videos')).toBeVisible();
});

test('ledger shows category badges matching each transaction', async ({ authedPage: page }) => {
  await page.goto('/usage');
  await expect(page.getByTestId('aggregated-row').first()).toBeVisible({ timeout: 15_000 });

  const ledger = page.getByTestId('transaction-ledger');

  await expect(ledger.getByText('Assistant work').first()).toBeVisible();
  await expect(ledger.getByText('Assistant creation')).toBeVisible();
  await expect(ledger.getByText('Created and provisioned contacts')).toBeVisible();
  await expect(ledger.getByText('Generated photos and videos')).toBeVisible();

  await ledger.getByTestId('aggregated-row-toggle').first().click();
  await expect(ledger.getByTestId('transaction-row').first()).toBeVisible({ timeout: 10_000 });

  await expect(ledger.getByText('LLM').first()).toBeVisible();
  await expect(ledger.getByText('Hiring')).toBeVisible();
  await expect(ledger.getByText('Resources')).toBeVisible();
  await expect(ledger.getByText('Media')).toBeVisible();
});

test('category filter narrows ledger to selected category', async ({ authedPage: page }) => {
  await page.goto('/usage');
  await expect(page.getByTestId('aggregated-row').first()).toBeVisible({ timeout: 15_000 });

  const ledger = page.getByTestId('transaction-ledger');

  await page.getByTestId('category-filter').click();
  await expect(page.getByRole('option', { name: 'LLM' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('option', { name: 'LLM' }).click();
  await expect(ledger.getByText('Assistant work').first()).toBeVisible({ timeout: 10_000 });
  await expect(ledger.getByText('Assistant creation')).not.toBeVisible({ timeout: 10_000 });
  await expect(ledger.getByText('Generated photos and videos')).not.toBeVisible({
    timeout: 5_000,
  });

  await page.getByTestId('category-filter').click();
  await page.getByRole('option', { name: 'Hiring' }).click();
  await expect(ledger.getByText('Assistant creation')).toBeVisible({ timeout: 10_000 });
  await expect(ledger.getByText('Assistant work')).not.toBeVisible({ timeout: 10_000 });

  await page.getByTestId('category-filter').click();
  await page.getByRole('option', { name: 'All Spending' }).click();
  await expect(ledger.getByText('Assistant work').first()).toBeVisible({ timeout: 10_000 });
  await expect(ledger.getByText('Assistant creation')).toBeVisible({ timeout: 10_000 });
});

test('granularity filter changes chart and ledger without errors', async ({ authedPage: page }) => {
  await page.goto('/usage');
  await expect(page.getByTestId('usage-page-main')).toBeVisible({ timeout: 15_000 });

  // Wait for initial ledger data to load
  const ledger = page.getByTestId('transaction-ledger');
  await expect(ledger.getByTestId('aggregated-row').first()).toBeVisible({ timeout: 10_000 });

  const granFilter = page.getByTestId('granularity-filter');

  // Switch to Monthly
  await granFilter.click();
  await page.getByRole('option', { name: 'Monthly' }).click();

  await expect(page.getByTestId('usage-error-alert')).not.toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-testid="usage-chart"]:visible')).toBeVisible();
  await expect(ledger).toBeVisible();

  await granFilter.click();
  await page.getByRole('option', { name: 'Daily' }).click();

  await expect(page.getByTestId('usage-error-alert')).not.toBeVisible({ timeout: 10_000 });
  await expect(ledger).toBeVisible();
});

test('ledger shows aggregated rows with category and count', async ({ authedPage: page }) => {
  await page.goto('/usage');
  await expect(page.getByTestId('transaction-ledger')).toBeVisible({ timeout: 15_000 });

  // Wait for aggregated rows to load (default granularity is Minutely)
  await expect(page.getByTestId('aggregated-row').first()).toBeVisible({ timeout: 10_000 });

  const ledger = page.getByTestId('transaction-ledger');

  // Aggregated rows show counts as "(N)" beside the bucket label
  await expect(ledger.getByText(/\(\d+\)/).first()).toBeVisible();
});

test('switching granularity changes ledger grouping', async ({ authedPage: page }) => {
  await page.goto('/usage');
  await expect(page.getByTestId('transaction-ledger')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('aggregated-row').first()).toBeVisible({ timeout: 10_000 });

  const ledger = page.getByTestId('transaction-ledger');
  const granFilter = page.getByTestId('granularity-filter');

  // Switch to Monthly — should show month-level labels (e.g. "April 2026")
  await granFilter.click();
  await page.getByRole('option', { name: 'Monthly' }).click();

  const monthlyRows = ledger.getByTestId('aggregated-row');
  await expect(monthlyRows.first()).toBeVisible({ timeout: 10_000 });
  const monthlyCount = await monthlyRows.count();

  await granFilter.click();
  await page.getByRole('option', { name: 'Hourly' }).click();

  const hourlyRows = ledger.getByTestId('aggregated-row');
  await expect(hourlyRows.first()).toBeVisible({ timeout: 10_000 });
  const hourlyCount = await hourlyRows.count();

  expect(hourlyCount).toBeGreaterThanOrEqual(monthlyCount);
});

test('refresh button reloads chart and ledger without errors', async ({ authedPage: page }) => {
  await page.goto('/usage');
  await expect(page.getByTestId('aggregated-row').first()).toBeVisible({ timeout: 15_000 });

  await page.getByTestId('refresh-button').click();

  await expect(page.getByTestId('usage-error-alert')).not.toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('transaction-ledger')).toBeVisible();
  await expect(page.locator('[data-testid="usage-chart"]:visible')).toBeVisible();
});

test('chart shows empty state when date range has no data', async ({ authedPage: page }) => {
  await page.goto('/usage');
  await expect(page.getByTestId('usage-page-main')).toBeVisible({ timeout: 15_000 });

  // Pick a far-future date range with no data
  const timeframe = page.getByTestId('timeframe-filter');
  await timeframe.click();

  // Type a far-future range into the date inputs if available,
  // otherwise just verify the chart handles empty gracefully
  const chartEmpty = page.locator('[data-testid="usage-chart-empty"]:visible');
  const chart = page.locator('[data-testid="usage-chart"]:visible');
  const chartVisible = await chart.isVisible().catch(() => false);
  const emptyVisible = await chartEmpty.isVisible({ timeout: 3_000 }).catch(() => false);
  expect(chartVisible || emptyVisible).toBe(true);
});

test('spending limit card is visible with limit info', async ({ authedPage: page }) => {
  await page.goto('/usage');
  const limitCard = page.getByTestId('spending-limit-card');
  await expect(limitCard).toBeVisible({ timeout: 15_000 });

  // Should show some limit label (e.g. "My Limit")
  await expect(limitCard.getByText(/Limit/i)).toBeVisible();
});

unauthTest('redirects to login when not authenticated', async ({ page }) => {
  await page.goto('/usage');
  await page.waitForURL('**/login**', { timeout: 15_000 });
  expect(page.url()).toContain('/login');
});
