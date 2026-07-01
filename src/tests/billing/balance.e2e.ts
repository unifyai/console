/**
 * Balance & Credits E2E — displays balance, refreshes after DB change.
 *
 * Run: npx playwright test src/tests/billing/balance.e2e.ts
 */

import { expect } from '@playwright/test';
import { createTestUser, cleanupUser, setUserCredits, createBillingTest, dbExec } from './helpers';

const user = createTestUser({ name: 'Balance', lastName: 'Test', credits: 5_000 });
const test = createBillingTest(user);

function walletUsd(userId: string): number {
  const balanceInDb = dbExec(
    `SELECT credits FROM billing_account WHERE id = (SELECT billing_account_id FROM "user" WHERE id = '${userId}')`
  );
  return parseFloat(balanceInDb);
}

function expectedCreditLabel(usd: number): string {
  return `${(usd * 400).toLocaleString('en-US')} credits`;
}

test.afterAll(() => cleanupUser(user.id));

test('shows credit balance on the billing page matching the DB', async ({ authedPage: page }) => {
  const usd = walletUsd(user.id);

  await page.goto('/billing');
  await expect(page.getByTestId('credits-balance-section')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(expectedCreditLabel(usd), { exact: false })).toBeVisible({
    timeout: 10_000,
  });
});

test('updates balance display after credits change in DB', async ({ authedPage: page }) => {
  setUserCredits(user.id, 99);

  await page.goto('/billing');
  await expect(page.getByTestId('credits-balance-section')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('39,600 credits')).toBeVisible({ timeout: 10_000 });
  expect(walletUsd(user.id)).toBe(99);

  setUserCredits(user.id, 5_000);
});
