/**
 * Usage Page E2E — page loads with chart/filters, interactions work.
 *
 * Run: npx playwright test src/tests/billing/usage.e2e.ts
 */

import { test as unauthTest, expect } from '@playwright/test';
import { createTestUser, cleanupUser, createBillingTest, type TestUser } from './helpers';

const user = createTestUser({ name: 'Usage', lastName: 'Test', credits: 5_000 });
const test = createBillingTest(user);

test.afterAll(() => cleanupUser(user.id));

test('loads usage page with filters, chart, and spending limit', async ({ authedPage: page }) => {
  await page.goto('/usage');

  await expect(page.getByTestId('usage-page-main')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('usage-filters-bar')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('timeframe-filter')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('granularity-filter')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('spending-limit-card')).toBeVisible({ timeout: 10_000 });

  const chart = page.getByTestId('usage-chart');
  const chartEmpty = page.getByTestId('usage-chart-empty');
  const chartVisible = await chart.isVisible({ timeout: 10_000 }).catch(() => false);
  const emptyVisible = await chartEmpty.isVisible({ timeout: 3_000 }).catch(() => false);
  expect(chartVisible || emptyVisible).toBe(true);
});

test('refresh button reloads data without errors', async ({ authedPage: page }) => {
  await page.goto('/usage');
  await expect(page.getByTestId('usage-page-main')).toBeVisible({ timeout: 15_000 });

  const refreshBtn = page.getByTestId('refresh-button');
  await expect(refreshBtn).toBeVisible({ timeout: 10_000 });
  await refreshBtn.click();

  await expect(page.getByTestId('usage-error-alert')).not.toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('usage-page-main')).toBeVisible({ timeout: 5_000 });
});

test('granularity filter dropdown opens and an option can be selected', async ({
  authedPage: page,
}) => {
  await page.goto('/usage');
  await expect(page.getByTestId('usage-page-main')).toBeVisible({ timeout: 15_000 });

  const granFilter = page.getByTestId('granularity-filter');
  await expect(granFilter).toBeVisible({ timeout: 10_000 });
  await granFilter.click();

  const option = page.locator('[role="option"]').first();
  await expect(option).toBeVisible({ timeout: 5_000 });
  await option.click();

  await expect(page.getByTestId('usage-error-alert')).not.toBeVisible({ timeout: 5_000 });
  await expect(page.getByTestId('usage-page-main')).toBeVisible({ timeout: 5_000 });
});

unauthTest('redirects to login when not authenticated', async ({ page }) => {
  await page.goto('/usage');
  await page.waitForURL('**/login**', { timeout: 15_000 });
  expect(page.url()).toContain('/login');
});
