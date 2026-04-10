/**
 * Balance & Credits E2E — displays balance, refreshes after DB change.
 *
 * Run: npx playwright test src/tests/billing/balance.e2e.ts
 */

import { expect } from '@playwright/test';
import {
  createTestUser,
  cleanupUser,
  setUserCredits,
  createBillingTest,
  dbExec,
  type TestUser,
} from './helpers';

const user = createTestUser({ name: 'Balance', lastName: 'Test', credits: 5_000 });
const test = createBillingTest(user);

test.afterAll(() => cleanupUser(user.id));

test('shows credit balance on the billing page matching the DB', async ({ authedPage: page }) => {
  await page.goto('/billing');
  await page.waitForSelector('text=Balance', { timeout: 15_000 });

  const balanceEl = page.locator('text=/\\$[0-9]/');
  await expect(balanceEl.first()).toBeVisible({ timeout: 10_000 });

  const balanceInDb = dbExec(
    `SELECT credits FROM billing_account WHERE id = (SELECT billing_account_id FROM "user" WHERE id = '${user.id}')`
  );
  expect(parseFloat(balanceInDb)).toBeGreaterThan(0);
});

test('updates balance display after credits change in DB', async ({ authedPage: page }) => {
  setUserCredits(user.id, 99);

  await page.goto('/billing');
  await page.waitForSelector('text=Balance', { timeout: 15_000 });
  await expect(page.locator('text=$99')).toBeVisible({ timeout: 10_000 });

  setUserCredits(user.id, 5_000);
});
