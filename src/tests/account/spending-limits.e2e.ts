/**
 * Spending Limits E2E — set, update, and remove personal spending limit via Usage UI.
 *
 * Run: npx playwright test src/tests/account/spending-limits.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  createAccountTest,
  getUserSpendingCap,
  dbExec,
  navigateToAppShellRoute,
} from './helpers';

const DISPLAY_CREDITS_PER_USD = 400;

function toDisplayCredits(usd: number): number {
  return usd * DISPLAY_CREDITS_PER_USD;
}

const user = createTestUser({ name: 'Spending', lastName: 'Limit', credits: 5_000 });
const test = createAccountTest(user);
test.setTimeout(90_000);

const shellOpts = { userId: user.id, apiKey: user.apiKey };

test.afterAll(() => cleanupUser(user.id));

async function openUsagePage(page: import('@playwright/test').Page) {
  await navigateToAppShellRoute(page, '/usage', shellOpts);
  await expect(page.getByTestId('usage-page-main')).toBeVisible({ timeout: 30_000 });
}

async function openUsageSpendingLimitEditor(page: import('@playwright/test').Page) {
  await openUsagePage(page);
  await expect(page.getByTestId('spending-limit-card')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('edit-user-limit-button').click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
}

async function saveSpendingLimitDialog(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Save Limit' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 15_000 });
}

test('usage page shows spending limit card with edit control', async ({ authedPage: page }) => {
  await openUsagePage(page);
  await expect(page.getByTestId('spending-limit-card')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('edit-user-limit-button')).toBeVisible();
});

test('setting a personal spending limit via Usage UI persists to DB', async ({
  authedPage: page,
}) => {
  dbExec(`UPDATE "user" SET monthly_spending_cap = NULL WHERE id = '${user.id}'`);

  await openUsageSpendingLimitEditor(page);
  await page.locator('#spending-limit').fill(String(toDisplayCredits(100)));
  await saveSpendingLimitDialog(page);

  expect(getUserSpendingCap(user.id)).toBe(100);
  await expect(page.getByTestId('spending-limit-card')).toContainText('My Limit');
});

test('updating spending limit via Usage UI changes the value in DB', async ({
  authedPage: page,
}) => {
  dbExec(`UPDATE "user" SET monthly_spending_cap = 100 WHERE id = '${user.id}'`);

  await openUsageSpendingLimitEditor(page);
  await page.locator('#spending-limit').fill(String(toDisplayCredits(250)));
  await saveSpendingLimitDialog(page);

  expect(getUserSpendingCap(user.id)).toBe(250);
});

test('removing spending limit via Unlimited toggle clears it from DB', async ({
  authedPage: page,
}) => {
  dbExec(`UPDATE "user" SET monthly_spending_cap = 200 WHERE id = '${user.id}'`);

  await openUsageSpendingLimitEditor(page);
  await page.getByRole('button', { name: 'Unlimited' }).click();
  await saveSpendingLimitDialog(page);

  expect(getUserSpendingCap(user.id)).toBeNull();
});
